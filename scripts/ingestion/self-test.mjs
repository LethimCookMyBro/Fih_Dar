// Deterministic unit tests for the ingestion orchestration modules.
//
//   npm run ingest:test
//
// No network, no real database — sources are fetched through an injected
// fetchFn and persistence through a fake in-memory prisma. Exit code is
// non-zero when any assertion fails.

import assert from 'node:assert/strict';

import { parseRssItems, provinceFromText, fetchGoogleNews, fetchDataGoTh } from './sources.mjs';
import { passesNewsPrefilter } from './adapters/common.mjs';
import { fetchRssFeed } from './adapters/rss.mjs';
import { fetchJsonApi } from './adapters/json-api.mjs';
import { syncSourceRegistry } from './registry.mjs';
import { exitCodeForStatus } from './exit-code.mjs';
import { ingestionStatus, runIngestion, upsertObservations } from './run-ingestion.mjs';

let failures = 0;
function check(condition, message) {
  if (condition) {
    console.log(`  ok — ${message}`);
  } else {
    failures += 1;
    console.error(`  FAIL — ${message}`);
  }
}

// --- fake prisma: in-memory map keyed by `${sourceName}|${sourceExternalId}` ---
function fakePrisma() {
  const rows = new Map();
  const sourceRows = new Map();
  return {
    __rows: rows,
    __sources: sourceRows,
    dataSource: {
      async upsert({ where, update, create }) {
        const slug = where.slug;
        const existing = sourceRows.get(slug);
        const row = existing ? { ...existing, ...update } : { id: `ds-${slug}`, slug, ...create };
        sourceRows.set(slug, row);
        return row;
      }
    },
    externalObservation: {
      async findUnique({ where }) {
        const key = where.sourceName_sourceExternalId
          ? `${where.sourceName_sourceExternalId.sourceName}|${where.sourceName_sourceExternalId.sourceExternalId}`
          : null;
        const row = key ? rows.get(key) : null;
        return row ? { id: row.id } : null;
      },
      async create({ data }) {
        const id = `id-${rows.size + 1}`;
        const row = { id, ...data };
        rows.set(`${data.sourceName}|${data.sourceExternalId}`, row);
        return row;
      }
    }
  };
}

function stubFetch(map) {
  return async (url) => {
    const entry = map[url];
    if (!entry) throw new Error(`unexpected url ${url}`);
    if (entry.error) throw entry.error;
    return { ok: true, text: async () => entry.body };
  };
}

// --- province extraction ------------------------------------------------------
console.log('provinceFromText');
check(provinceFromText('จังหวัดฉะเชิงเทรา พบปลาหมอคางดำ') === 'ฉะเชิงเทรา', 'จังหวัดฉะเชิงเทรา → ฉะเชิงเทรา');
check(provinceFromText('จ.ชลบุรี ชาวบ้านพบปลาหมอคางดำ') === 'ชลบุรี', 'จ.ชลบุรี → ชลบุรี');
check(provinceFromText('พบปลาหมอคางดำที่ระยอง') === 'ระยอง', 'bare ระยอง → ระยอง');
check(provinceFromText('พบปลาหมอคางดำที่กรุงเทพฯ') === null, 'non-EEC text → null');
check(provinceFromText('') === null, 'empty text → null');

// --- RSS parsing --------------------------------------------------------------
console.log('parseRssItems');
const rss = `<?xml version="1.0"?>
<rss version="2.0"><channel>
<item>
  <title>ปลาหมอคางดำระบาด &amp; ชลบุรี</title>
  <link>https://example.com/a</link>
  <guid>g-1</guid>
  <pubDate>Thu, 15 Aug 2026 07:00:00 GMT</pubDate>
  <description><p>พบปลา</p> จำนวนมาก</description>
</item>
<item>
  <title>ข่าวสอง</title>
  <link>https://example.com/b</link>
</item>
</channel></rss>`;
const items = parseRssItems(rss);
check(items.length === 2, `two items parsed (got ${items.length})`);
check(items[0].title === 'ปลาหมอคางดำระบาด & ชลบุรี', 'entity &amp; decoded');
check(items[0].description === 'พบปลา จำนวนมาก', 'html stripped from description');
check(items[0].guid === 'g-1', 'guid preserved');
check(items[1].guid === 'https://example.com/b', 'guid falls back to link');
check(items[0].pubDate instanceof Date && items[0].pubDate.toISOString().startsWith('2026-08-15'), 'pubDate parsed');

// --- news prefilter -----------------------------------------------------------
console.log('passesNewsPrefilter');
check(passesNewsPrefilter('กรมประมง เร่งกำจัดปลาหมอคางดำในคลองบางปะกง'), 'species term kept');
check(passesNewsPrefilter('พบปลาหมอคางดำที่ จ.ชลบุรี จำนวนมาก'), 'species term + province kept');
check(passesNewsPrefilter('ราคาปลานิลวันนี้ ตลาด จ.ระยอง'), 'generic tilapia + EEC province kept');
check(!passesNewsPrefilter('ราคาปลานิลวันนี้ ตลาดกรุงเทพ'), 'generic tilapia without EEC province dropped');
check(!passesNewsPrefilter('ฟุตบอลไทยลีก นัดชี้ขาดวันนี้'), 'unrelated football dropped');
check(!passesNewsPrefilter(''), 'empty text dropped');

// --- RSS adapter with prefilter -----------------------------------------------
console.log('fetchRssFeed (prefiltered outlet feed)');
const outletXml = `<?xml version="1.0"?><rss version="2.0"><channel>
<item><title>ชาวบ้านพบปลาหมอคางดำในคลองที่ชลบุรี</title><link>https://www.matichon.co.th/?p=1</link><guid>https://www.matichon.co.th/?p=1</guid><pubDate>Sun, 16 Aug 2026 01:00:00 +0000</pubDate><description>รายละเอียดข่าวปลาหมอคางดำ</description></item>
<item><title>ฟุตบอลไทยลีกนัดชี้ขาด</title><link>https://www.matichon.co.th/?p=2</link><guid>https://www.matichon.co.th/?p=2</guid><pubDate>Sun, 16 Aug 2026 02:00:00 +0000</pubDate><description>ข่าวกีฬา</description></item>
</channel></rss>`;
const outletRows = await fetchRssFeed({
  fetchFn: stubFetch({ 'https://www.matichon.co.th/feed': { body: outletXml } }),
  url: 'https://www.matichon.co.th/feed',
  sourceName: 'matichon',
  queryLabel: 'Matichon RSS (prefiltered)',
  prefilter: true
});
check(outletRows.length === 1, `prefilter keeps 1 of 2 items (got ${outletRows.length})`);
check(outletRows[0].sourceName === 'matichon', 'outlet rows tagged with source slug');
check(outletRows[0].sourceExternalId === 'https://www.matichon.co.th/?p=1', 'guid is deterministic external id');
check(outletRows[0].province === 'ชลบุรี', 'province extracted from outlet item text');

// --- JSON API adapter (iNaturalist mapper) ------------------------------------
console.log('fetchJsonApi / iNaturalist');
const inatBody = {
  total_results: 2,
  results: [
    {
      id: 391157436,
      observed_on: '2026-08-14',
      place_guess: 'ชายหาดบางเสร่, อ.สัตหีบ, จ.ชลบุรี, TH',
      location: '12.776572807,100.9024785497',
      quality_grade: 'needs_id',
      uri: 'https://www.inaturalist.org/observations/391157436'
    },
    {
      id: 390367630,
      observed_on: '2026-08-11',
      place_guess: 'Sathon District, Bangkok, TH',
      location: '13.718825,100.5434333333',
      quality_grade: 'research',
      uri: 'https://www.inaturalist.org/observations/390367630'
    }
  ]
};
const inatRows = await fetchJsonApi({
  fetchFn: stubFetch({ 'https://api.inaturalist.org/v1/observations?page=1': { body: JSON.stringify(inatBody) } }),
  sourceName: 'inaturalist',
  urlTemplate: 'https://api.inaturalist.org/v1/observations?page={page}',
  mapItem: (obs) => {
    const { latitude, longitude } = parseLoc(obs.location);
    return {
      sourceName: 'inaturalist',
      sourceExternalId: `inat-${obs.id}`,
      sourceUrl: obs.uri,
      title: `การพบปลาหมอคางดำ (Sarotherodon melanotheron) — ${obs.place_guess}`,
      province: provinceFromText(obs.place_guess),
      latitude,
      longitude,
      publishedAt: obs.observed_on ? new Date(obs.observed_on) : null,
      status: 'NEW',
      rawMetadata: { via: 'iNaturalist API' }
    };
  },
  maxPages: 1,
  perPage: 200
});
check(inatRows.length === 2, `two iNaturalist rows mapped (got ${inatRows.length})`);
check(inatRows[0].sourceExternalId === 'inat-391157436', 'iNaturalist external id deterministic');
check(inatRows[0].province === 'ชลบุรี', 'Thai place_guess province extracted');
check(inatRows[0].latitude === 12.776572807 && inatRows[0].longitude === 100.9024785497, 'coordinates parsed from source');
check(inatRows[0].publishedAt.toISOString().startsWith('2026-08-14'), 'observed_on → publishedAt');
check(inatRows[1].sourceExternalId === 'inat-390367630', 'second row mapped');

function parseLoc(location) {
  const [lat, lng] = String(location).split(',').map((part) => Number(part.trim()));
  return { latitude: lat, longitude: lng };
}

// --- status aggregation -------------------------------------------------------
console.log('ingestionStatus');
check(ingestionStatus([]) === 'FAILED', 'zero sources → FAILED');
check(
  ingestionStatus([{ ok: true }, { ok: true }]) === 'SUCCEEDED',
  'all sources ok → SUCCEEDED'
);
check(
  ingestionStatus([{ ok: true }, { ok: false }]) === 'PARTIAL',
  'one ok + one failed → PARTIAL'
);
check(
  ingestionStatus([{ ok: false }, { ok: false }]) === 'FAILED',
  'all sources failed → FAILED'
);

// --- runIngestion: duplicate-safe + failure isolation over all 6 sources -------
console.log('runIngestion (6 sources)');
const newsQuery = encodeURIComponent('ปลาหมอคางดำ (ฉะเชิงเทรา OR ชลบุรี OR ระยอง)');
const newsUrl = `https://news.google.com/rss/search?q=${newsQuery}&hl=th&gl=TH&ceid=TH:th`;
const dgothTilapiaUrl = `https://data.go.th/api/3/action/package_search?q=${encodeURIComponent('tilapia')}&rows=10`;
const dgothNileUrl = `https://data.go.th/api/3/action/package_search?q=${encodeURIComponent('ปลานิล')}&rows=10`;
const dgothBlackchinThaiUrl = `https://data.go.th/api/3/action/package_search?q=${encodeURIComponent('ปลาหมอคางดำ')}&rows=10`;
const dgothBlackchinShortUrl = `https://data.go.th/api/3/action/package_search?q=${encodeURIComponent('หมอคางดำ')}&rows=10`;
const dgothBlackchinEnUrl = `https://data.go.th/api/3/action/package_search?q=${encodeURIComponent('blackchin tilapia')}&rows=10`;
const inatUrl1 = 'https://api.inaturalist.org/v1/observations?taxon_id=230431&nelat=20.7&nelng=105.8&swlat=5.5&swlng=96.5&per_page=200&page=1&order=desc&order_by=observed_on';
const inatUrl2 = inatUrl1.replace('page=1', 'page=2');
const outletFeedXml = `<?xml version="1.0"?><rss version="2.0"><channel>
<item><title>พบปลาหมอคางดำที่ชลบุรี</title><link>https://ex.com/outlet/1</link><guid>https://ex.com/outlet/1</guid><pubDate>Sun, 16 Aug 2026 02:00:00 GMT</pubDate></item>
<item><title>ข่าวอื่น</title><link>https://ex.com/outlet/2</link><guid>https://ex.com/outlet/2</guid></item>
</channel></rss>`;
const sourcesMap = {
  [newsUrl]: {
    body:
      '<?xml version="1.0"?><rss version="2.0"><channel><item><title>พบปลาหมอคางดำที่ชลบุรี</title><link>https://ex.com/1</link><guid>n-1</guid><pubDate>Sat, 16 Aug 2026 02:00:00 GMT</pubDate></item><item><title>ข่าวอื่น</title><link>https://ex.com/2</link><guid>n-2</guid></item></channel></rss>'
  },
  [dgothTilapiaUrl]: {
    body: JSON.stringify({
      success: true,
      result: {
        results: [
          { id: 'd1', name: 'tilapia-dataset', title: 'ข้อมูลปลา tilapia & นิล', notes: 'รายละเอียด', metadata_modified: '2026-08-10T00:00:00Z', resources: [] }
        ]
      }
    })
  },
  [dgothNileUrl]: { body: JSON.stringify({ success: true, result: { results: [] } }) },
  // Mirrors production reality: the actual invasive-species terms return 0 CKAN
  // results (see registry.mjs's data.go.th query list) — the catalog only has
  // generic Nile-tilapia aquaculture-economics datasets.
  [dgothBlackchinThaiUrl]: { body: JSON.stringify({ success: true, result: { results: [] } }) },
  [dgothBlackchinShortUrl]: { body: JSON.stringify({ success: true, result: { results: [] } }) },
  [dgothBlackchinEnUrl]: { body: JSON.stringify({ success: true, result: { results: [] } }) },
  [inatUrl1]: {
    body: JSON.stringify({
      total_results: 1,
      results: [
        { id: 391157436, observed_on: '2026-08-14', place_guess: 'จ.ชลบุรี, TH', location: '12.776,100.902', quality_grade: 'needs_id', uri: 'https://www.inaturalist.org/observations/391157436' }
      ]
    })
  },
  [inatUrl2]: { body: JSON.stringify({ total_results: 1, results: [] }) },
  'https://www.matichon.co.th/feed': { body: outletFeedXml },
  'https://www.khaosod.co.th/feed': { body: outletFeedXml },
  'https://www.prachachat.net/feed': { body: outletFeedXml }
};

// run 1: all sources succeed
const prisma1 = fakePrisma();
const result1 = await runIngestion({ prisma: prisma1, fetchFn: stubFetch(sourcesMap) });
check(result1.status === 'SUCCEEDED', `first run SUCCEEDED (got ${result1.status})`);
check(result1.totalCreated === 7, `first run created 7 (got ${result1.totalCreated})`);
check(result1.totalSkipped === 0, `first run skipped 0 (got ${result1.totalSkipped})`);
check(result1.failedSources === 0, 'first run no failed sources');
check(result1.sources.length === 6, `six source results (got ${result1.sources.length})`);
const gnews = result1.sources.find((s) => s.sourceName === 'google-news-th');
const dgoth = result1.sources.find((s) => s.sourceName === 'data.go.th');
const inat = result1.sources.find((s) => s.sourceName === 'inaturalist');
const matichon = result1.sources.find((s) => s.sourceName === 'matichon');
check(gnews?.matched === 2 && gnews?.created === 2 && gnews?.ok === true, 'google-news-th result structured');
check(dgoth?.matched === 1 && dgoth?.created === 1 && dgoth?.ok === true, 'data.go.th result structured');
check(inat?.matched === 1 && inat?.created === 1 && inat?.ok === true, 'inaturalist result structured');
check(matichon?.matched === 1 && matichon?.ok === true, 'matichon prefiltered to 1 relevant item');
check(prisma1.__sources.size === 6, 'registry synced 6 DataSource rows');

// run 2: identical → everything skipped, no duplicates
const result2 = await runIngestion({ prisma: prisma1, fetchFn: stubFetch(sourcesMap) });
check(result2.status === 'SUCCEEDED', `second run SUCCEEDED (got ${result2.status})`);
check(result2.totalCreated === 0, `second run created 0 (got ${result2.totalCreated})`);
check(result2.totalSkipped === 7, `second run skipped 7 (got ${result2.totalSkipped})`);
check(prisma1.__rows.size === 7, 'no duplicate rows stored');

// run 3: google-news-th fails, others succeed → PARTIAL, data persisted
const failingMap = { ...sourcesMap };
failingMap[newsUrl] = { error: new Error('RSS 500') };
const prisma3 = fakePrisma();
const result3 = await runIngestion({ prisma: prisma3, fetchFn: stubFetch(failingMap) });
check(result3.status === 'PARTIAL', `google fails + rest ok → PARTIAL (got ${result3.status})`);
check(result3.failedSources === 1, 'one failed source counted');
check(result3.totalCreated === 5, 'successful sources still persisted');
const failedSource = result3.sources.find((s) => s.sourceName === 'google-news-th');
check(failedSource?.ok === false && typeof failedSource.error === 'string', 'failed source records error string');

// run 4: all sources fail → FAILED, nothing created
const allFailing = {};
for (const key of Object.keys(failingMap)) {
  allFailing[key] = { error: new Error('boom') };
}
const prisma4 = fakePrisma();
const result4 = await runIngestion({ prisma: prisma4, fetchFn: stubFetch(allFailing) });
check(result4.status === 'FAILED', `all sources fail → FAILED (got ${result4.status})`);
check(result4.failedSources === 6, 'all six sources failed');
check(result4.totalCreated === 0, 'nothing created on total failure');

// --- upsertObservations directly ---------------------------------------------
console.log('upsertObservations');
const prisma5 = fakePrisma();
const first = await upsertObservations(prisma5, [{ sourceName: 's', sourceExternalId: 'x', title: 'เดิม' }], 's');
check(first.created === 1 && first.skipped === 0, 'first upsert creates');
const second = await upsertObservations(prisma5, [{ sourceName: 's', sourceExternalId: 'x', title: 'แก้ไขแล้ว' }], 's');
check(second.created === 0 && second.skipped === 1, 'duplicate upsert skips');
const stored = prisma5.__rows.get('s|x');
check(stored.title === 'เดิม', 'existing row never overwritten');

// --- source registry sync -----------------------------------------------------
console.log('syncSourceRegistry');
const prisma6 = fakePrisma();
const synced = await syncSourceRegistry(prisma6);
check(synced === 6, `registry sync reports ${synced} sources`);
const matichonRow = prisma6.__sources.get('matichon');
check(matichonRow?.label === 'มติชน' && matichonRow?.transport === 'RSS', 'registry metadata persisted without fetch fn');
const raw = JSON.stringify(matichonRow);
check(!raw.includes('fetch') || !raw.includes('function'), 'fetch function never persisted to DB rows');

// --- fetchGoogleNews / fetchDataGoTh with injected fetch ----------------------
console.log('source fetchers (injected fetch)');
const gnewsRows = await fetchGoogleNews(stubFetch(sourcesMap));
check(gnewsRows.length === 2 && gnewsRows[0].sourceName === 'google-news-th', 'google-news-th rows mapped');
check(gnewsRows[0].province === 'ชลบุรี', 'province extracted from google title');
const dgothRows = await fetchDataGoTh(stubFetch(sourcesMap));
check(dgothRows.length === 1 && dgothRows[0].sourceName === 'data.go.th', 'data.go.th rows mapped');
check(dgothRows[0].sourceExternalId === 'd1' && dgothRows[0].title.includes('&'), 'data.go.th id + decoded title');

// --- refresh runner exit-code policy ------------------------------------------
console.log('exit-code policy');
check(exitCodeForStatus('SUCCEEDED') === 0, 'SUCCEEDED exits 0');
check(exitCodeForStatus('PARTIAL') === 0, 'PARTIAL exits 0 (schedule keeps ticking; failure is recorded)');
check(exitCodeForStatus('FAILED') === 1, 'FAILED exits non-zero');

console.log(failures === 0 ? '\nall ingestion self-tests passed' : `\n${failures} assertion(s) FAILED`);
process.exitCode = failures === 0 ? 0 : 1;

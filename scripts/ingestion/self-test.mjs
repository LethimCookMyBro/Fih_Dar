// Deterministic unit tests for the ingestion orchestration modules.
//
//   npm run ingest:test
//
// No network, no real database — sources are fetched through an injected
// fetchFn and persistence through a fake in-memory prisma. Exit code is
// non-zero when any assertion fails.

import assert from 'node:assert/strict';

import { parseRssItems, provinceFromText, fetchGoogleNews, fetchDataGoTh } from './sources.mjs';
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
  return {
    __rows: rows,
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

// --- runIngestion: duplicate-safe + failure isolation -------------------------
console.log('runIngestion');
// Build fixture keys with the same encoding the source fetchers use, so the
// stubs match the real request URLs regardless of encodeURIComponent details.
const newsQuery = encodeURIComponent('ปลาหมอคางดำ (ฉะเชิงเทรา OR ชลบุรี OR ระยอง)');
const newsUrl = `https://news.google.com/rss/search?q=${newsQuery}&hl=th&gl=TH&ceid=TH:th`;
const dgothTilapiaUrl = `https://data.go.th/api/3/action/package_search?q=${encodeURIComponent('tilapia')}&rows=10`;
const dgothNileUrl = `https://data.go.th/api/3/action/package_search?q=${encodeURIComponent('ปลานิล')}&rows=10`;
const sourcesMap = {
  // stubFetch reads entry.body / entry.error — wrap bodies in objects.
  [newsUrl]: {
    body:
      '<?xml version="1.0"?><rss version="2.0"><channel><item><title>พบปลาหมอคางดำที่ชลบุรี</title><link>https://ex.com/1</link><guid>n-1</guid><pubDate>Sat, 16 Aug 2026 02:00:00 GMT</pubDate></item><item><title>ข่าวอื่น</title><link>https://ex.com/2</link><guid>n-2</guid></item></channel></rss>'
  },
  [dgothTilapiaUrl]: {
    body: JSON.stringify({
      success: true,
      result: {
        results: [
          { id: 'd1', name: 'tilapia-dataset', title: 'ข้อมูลปลา tilapia &amp; นิล', notes: 'รายละเอียด', metadata_modified: '2026-08-10T00:00:00Z', resources: [] }
        ]
      }
    })
  },
  [dgothNileUrl]: { body: JSON.stringify({ success: true, result: { results: [] } }) }
};

// run 1: both sources succeed, 2 google + 1 data.go.th created
const prisma1 = fakePrisma();
const result1 = await runIngestion({ prisma: prisma1, fetchFn: stubFetch(sourcesMap) });
check(result1.status === 'SUCCEEDED', `first run SUCCEEDED (got ${result1.status})`);
check(result1.totalCreated === 3, `first run created 3 (got ${result1.totalCreated})`);
check(result1.totalSkipped === 0, `first run skipped 0 (got ${result1.totalSkipped})`);
check(result1.failedSources === 0, 'first run no failed sources');
check(result1.sources.length === 2, 'two source results');
const gnews = result1.sources.find((s) => s.sourceName === 'google-news-th');
const dgoth = result1.sources.find((s) => s.sourceName === 'data.go.th');
check(gnews?.matched === 2 && gnews?.created === 2 && gnews?.ok === true, 'google-news-th result structured');
check(dgoth?.matched === 1 && dgoth?.created === 1 && dgoth?.ok === true, 'data.go.th result structured');

// run 2: identical → everything skipped, no duplicates
const result2 = await runIngestion({ prisma: prisma1, fetchFn: stubFetch(sourcesMap) });
check(result2.status === 'SUCCEEDED', `second run SUCCEEDED (got ${result2.status})`);
check(result2.totalCreated === 0, `second run created 0 (got ${result2.totalCreated})`);
check(result2.totalSkipped === 3, `second run skipped 3 (got ${result2.totalSkipped})`);
check(prisma1.__rows.size === 3, 'no duplicate rows stored');

// run 3: google-news-th fails, data.go.th succeeds → PARTIAL, data persisted
const failingMap = { ...sourcesMap };
failingMap[newsUrl] = {
  error: new Error('RSS 500')
};
const prisma3 = fakePrisma();
const result3 = await runIngestion({ prisma: prisma3, fetchFn: stubFetch(failingMap) });
check(result3.status === 'PARTIAL', `google fails + data ok → PARTIAL (got ${result3.status})`);
check(result3.failedSources === 1, 'one failed source counted');
check(result3.totalCreated === 1, 'successful source still persisted');
const failedSource = result3.sources.find((s) => s.sourceName === 'google-news-th');
check(failedSource?.ok === false && typeof failedSource.error === 'string', 'failed source records error string');

// run 4: both sources fail → FAILED, nothing created
const allFailing = {};
for (const key of Object.keys(failingMap)) {
  allFailing[key] = { error: new Error('boom') };
}
const prisma4 = fakePrisma();
const result4 = await runIngestion({ prisma: prisma4, fetchFn: stubFetch(allFailing) });
check(result4.status === 'FAILED', `all sources fail → FAILED (got ${result4.status})`);
check(result4.failedSources === 2, 'both sources failed');
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

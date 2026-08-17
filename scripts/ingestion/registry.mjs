// SOURCE REGISTRY — the single source of truth for every trusted external
// source.
//
// Security model: ONLY these code-defined definitions can be fetched. A
// database row can never add a URL for the worker to fetch (no SSRF
// surface). The DataSource table mirrors this registry for display/health
// metadata and is kept in sync via syncSourceRegistry() on every ingestion
// run and by the sources API on read.
//
// Each definition configures ONE structured adapter (rss | ckan | json-api).
// There is deliberately no generic scraper: every endpoint is allowlisted
// here, verified, and bounded.

import { provinceFromText } from './adapters/common.mjs';
import { fetchRssFeed, parseRssItems } from './adapters/rss.mjs';
import { fetchCkanPackages } from './adapters/ckan.mjs';
import { fetchJsonApi } from './adapters/json-api.mjs';

// ---------------------------------------------------------------------------
// iNaturalist — citizen-science occurrence observations of S. melanotheron
// within Thailand (bounded to 2 pages × 200). Coordinates are observer-
// entered and come from the source; we never derive them.
// ---------------------------------------------------------------------------
const INAT_TAXON_ID = '230431'; // Sarotherodon melanotheron
const TH_BBOX = { nelat: '20.7', nelng: '105.8', swlat: '5.5', swlng: '96.5' };

/** English province (as written in iNaturalist place_guess) → Thai name. */
const EN_TH_PROVINCES = {
  'Amnat Charoen': 'อำนาจเจริญ',
  'Ang Thong': 'อ่างทอง',
  'Bangkok': 'กรุงเทพมหานคร',
  'Bangkok Metropolis': 'กรุงเทพมหานคร',
  'Bueng Kan': 'บึงกาฬ',
  'Buri Ram': 'บุรีรัมย์',
  'Burirum': 'บุรีรัมย์',
  'Chachoengsao': 'ฉะเชิงเทรา',
  'Chai Nat': 'ชัยนาท',
  'Chaiyaphum': 'ชัยภูมิ',
  'Chanthaburi': 'จันทบุรี',
  'Chiang Mai': 'เชียงใหม่',
  'Chiang Rai': 'เชียงราย',
  'Chon Buri': 'ชลบุรี',
  'Chonburi': 'ชลบุรี',
  'Chumphon': 'ชุมพร',
  'Kalasin': 'กาฬสินธุ์',
  'Kamphaeng Phet': 'กำแพงเพชร',
  'Kanchanaburi': 'กาญจนบุรี',
  'Khon Kaen': 'ขอนแก่น',
  'Krabi': 'กระบี่',
  'Lampang': 'ลำปาง',
  'Lamphun': 'ลำพูน',
  'Loei': 'เลย',
  'Lop Buri': 'ลพบุรี',
  'Lopburi': 'ลพบุรี',
  'Mae Hong Son': 'แม่ฮ่องสอน',
  'Maha Sarakham': 'มหาสารคาม',
  'Mukdahan': 'มุกดาหาร',
  'Nakhon Nayok': 'นครนายก',
  'Nakhon Pathom': 'นครปฐม',
  'Nakhon Phanom': 'นครพนม',
  'Nakhon Ratchasima': 'นครราชสีมา',
  'Nakhon Sawan': 'นครสวรรค์',
  'Nakhon Si Thammarat': 'นครศรีธรรมราช',
  'Nan': 'น่าน',
  'Narathiwat': 'นราธิวาส',
  'Nong Bua Lam Phu': 'หนองบัวลำภู',
  'Nong Khai': 'หนองคาย',
  'Nonthaburi': 'นนทบุรี',
  'Pathum Thani': 'ปทุมธานี',
  'Pattani': 'ปัตตานี',
  'Phang Nga': 'พังงา',
  'Phatthalung': 'พัทลุง',
  'Phayao': 'พะเยา',
  'Phetchabun': 'เพชรบูรณ์',
  'Phetchaburi': 'เพชรบุรี',
  'Phichit': 'พิจิตร',
  'Phitsanulok': 'พิษณุโลก',
  'Phra Nakhon Si Ayutthaya': 'พระนครศรีอยุธยา',
  'Phrae': 'แพร่',
  'Phuket': 'ภูเก็ต',
  'Prachin Buri': 'ปราจีนบุรี',
  'Prachuap Khiri Khan': 'ประจวบคีรีขันธ์',
  'Ranong': 'ระนอง',
  'Ratchaburi': 'ราชบุรี',
  'Rayong': 'ระยอง',
  'Roi Et': 'ร้อยเอ็ด',
  'Sa Kaeo': 'สระแก้ว',
  'Sakon Nakhon': 'สกลนคร',
  'Samut Prakan': 'สมุทรปราการ',
  'Samut Sakhon': 'สมุทรสาคร',
  'Samut Songkhram': 'สมุทรสงคราม',
  'Saraburi': 'สระบุรี',
  'Satun': 'สตูล',
  'Sing Buri': 'สิงห์บุรี',
  'Sisaket': 'ศรีสะเกษ',
  'Songkhla': 'สงขลา',
  'Sukhothai': 'สุโขทัย',
  'Suphan Buri': 'สุพรรณบุรี',
  'Surat Thani': 'สุราษฎร์ธานี',
  'Surin': 'สุรินทร์',
  'Tak': 'ตาก',
  'Trang': 'ตรัง',
  'Trat': 'ตราด',
  'Ubon Ratchathani': 'อุบลราชธานี',
  'Udon Thani': 'อุดรธานี',
  'Uthai Thani': 'อุทัยธานี',
  'Uttaradit': 'อุตรดิตถ์',
  'Yala': 'ยะลา',
  'Yasothon': 'ยโสธร'
};

function provinceFromPlaceGuess(guess) {
  if (!guess) return null;
  const thai = provinceFromText(guess);
  if (thai) return thai;
  const lower = guess.toLowerCase();
  for (const [en, th] of Object.entries(EN_TH_PROVINCES)) {
    if (lower.includes(en.toLowerCase())) return th;
  }
  return null;
}

function parseInaturalistLocation(location) {
  // iNaturalist returns "lat,lng" as a single string.
  if (!location) return { latitude: null, longitude: null };
  const [lat, lng] = String(location).split(',').map((part) => Number(part.trim()));
  const valid = Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  return valid ? { latitude: lat, longitude: lng } : { latitude: null, longitude: null };
}

function inaturalistMapper(observation) {
  const placeGuess = String(observation.place_guess ?? '').trim();
  const { latitude, longitude } = parseInaturalistLocation(observation.location);
  const observedOn = observation.observed_on ? new Date(observation.observed_on) : null;
  const title = placeGuess
    ? `การพบปลาหมอคางดำ (Sarotherodon melanotheron) — ${placeGuess.slice(0, 120)}`
    : 'การพบปลาหมอคางดำ (Sarotherodon melanotheron) — ไม่ระบุสถานที่';
  return {
    sourceName: 'inaturalist',
    sourceExternalId: `inat-${observation.id}`,
    sourceUrl: observation.uri ?? `https://www.inaturalist.org/observations/${observation.id}`,
    title,
    description:
      `บันทึกการพบจาก iNaturalist (${observation.quality_grade ?? 'unknown'})` +
      `${observedOn ? ` วันที่พบ ${observedOn.toISOString().slice(0, 10)}` : ''}` +
      `${placeGuess ? ` สถานที่: ${placeGuess}` : ''}`,
    province: provinceFromPlaceGuess(placeGuess),
    latitude,
    longitude,
    publishedAt: observedOn,
    status: 'NEW',
    rawMetadata: {
      via: 'iNaturalist API (occurrence observations)',
      taxonId: Number(INAT_TAXON_ID),
      qualityGrade: observation.quality_grade ?? null,
      placeGuess: placeGuess || null
    }
  };
}

function fetchINaturalist(fetchFn = fetch) {
  return fetchJsonApi({
    fetchFn,
    sourceName: 'inaturalist',
    urlTemplate:
      'https://api.inaturalist.org/v1/observations' +
      `?taxon_id=${INAT_TAXON_ID}` +
      `&nelat=${TH_BBOX.nelat}&nelng=${TH_BBOX.nelng}` +
      `&swlat=${TH_BBOX.swlat}&swlng=${TH_BBOX.swlng}` +
      '&per_page={perPage}&page={page}&order=desc&order_by=observed_on',
    mapItem: inaturalistMapper,
    maxPages: 2,
    perPage: 200,
    listBody: (body) => body.results ?? []
  });
}

// ---------------------------------------------------------------------------
// REGISTRY — metadata + adapter wiring. `id` is the DB sourceName.
// ---------------------------------------------------------------------------
export const SOURCE_REGISTRY = [
  {
    id: 'google-news-th',
    label: 'Google News RSS',
    category: 'ข่าวสาธารณะ',
    transport: 'RSS',
    authorityType: 'news',
    trustTier: 'trusted',
    displayOrder: 10,
    homepage: 'https://news.google.com',
    description:
      'ข่าวสาธารณะภาษาไทยที่กล่าวถึงปลาหมอคางดำในฉะเชิงเทรา ชลบุรี และระยอง ผ่าน RSS Feed ของ Google News',
    enabled: true,
    fetch: (fetchFn = fetch) => {
      const query = 'ปลาหมอคางดำ (ฉะเชิงเทรา OR ชลบุรี OR ระยอง)';
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=th&gl=TH&ceid=TH:th`;
      return fetchRssFeed({
        fetchFn,
        url,
        sourceName: 'google-news-th',
        queryLabel: 'Google News RSS (hl=th, gl=TH)',
        prefilter: false
      });
    }
  },
  {
    id: 'data.go.th',
    label: 'data.go.th',
    category: 'ข้อมูลเปิดภาครัฐ',
    transport: 'CKAN',
    authorityType: 'government',
    trustTier: 'trusted',
    displayOrder: 20,
    homepage: 'https://data.go.th',
    description:
      'ชุดข้อมูลเปิดของภาครัฐที่เผยแพร่ผ่านพอร์ทัลข้อมูลเปิด data.go.th (CKAN API) — ค้นหาชุดข้อมูลที่เกี่ยวกับปลาหมอคางดำและปลานิล',
    enabled: true,
    fetch: (fetchFn = fetch) =>
      fetchCkanPackages({
        fetchFn,
        baseUrl: 'https://data.go.th',
        // ponytail: 'ปลาหมอคางดำ'/'หมอคางดำ'/'blackchin tilapia' (the actual invasive
        // species) currently return 0 CKAN results — the catalog only has generic Nile
        // tilapia aquaculture-economics datasets — but they're the honest query terms
        // for what this source is meant to surveil, so they stay even at zero yield.
        queries: ['tilapia', 'ปลานิล', 'ปลาหมอคางดำ', 'หมอคางดำ', 'blackchin tilapia'],
        rows: 10,
        sourceName: 'data.go.th',
        datasetUrlPrefix: 'https://data.go.th/dataset'
      })
  },
  {
    id: 'inaturalist',
    label: 'iNaturalist',
    category: 'ข้อมูลพลเมือง',
    transport: 'JSON API',
    authorityType: 'citizen-science',
    trustTier: 'trusted',
    displayOrder: 30,
    homepage: 'https://www.inaturalist.org',
    description:
      'บันทึกการพบ Sarotherodon melanotheron (ปลาหมอคางดำ) ในประเทศไทยจากผู้ใช้ iNaturalist — พิกัดเป็นข้อมูลที่ผู้สังเกตระบุโดยตรง',
    enabled: true,
    fetch: fetchINaturalist
  },
  {
    id: 'matichon',
    label: 'มติชน',
    category: 'ข่าวสาธารณะ',
    transport: 'RSS',
    authorityType: 'news',
    trustTier: 'trusted',
    displayOrder: 40,
    homepage: 'https://www.matichon.co.th',
    description:
      'ฟีดข่าวโดยตรงจากมติชน กรองเฉพาะเนื้อหาที่เกี่ยวกับปลาหมอคางดำ / ปลานิลในพื้นที่ EEC',
    enabled: true,
    fetch: (fetchFn = fetch) =>
      fetchRssFeed({
        fetchFn,
        url: 'https://www.matichon.co.th/feed',
        sourceName: 'matichon',
        queryLabel: 'Matichon RSS (prefiltered)',
        prefilter: true
      })
  },
  {
    id: 'khaosod',
    label: 'ข่าวสด',
    category: 'ข่าวสาธารณะ',
    transport: 'RSS',
    authorityType: 'news',
    trustTier: 'trusted',
    displayOrder: 50,
    homepage: 'https://www.khaosod.co.th',
    description:
      'ฟีดข่าวโดยตรงจากข่าวสด กรองเฉพาะเนื้อหาที่เกี่ยวกับปลาหมอคางดำ / ปลานิลในพื้นที่ EEC',
    enabled: true,
    fetch: (fetchFn = fetch) =>
      fetchRssFeed({
        fetchFn,
        url: 'https://www.khaosod.co.th/feed',
        sourceName: 'khaosod',
        queryLabel: 'Khaosod RSS (prefiltered)',
        prefilter: true
      })
  },
  {
    id: 'prachachat',
    label: 'ประชาชาติธุรกิจ',
    category: 'ข่าวสาธารณะ',
    transport: 'RSS',
    authorityType: 'news',
    trustTier: 'trusted',
    displayOrder: 60,
    homepage: 'https://www.prachachat.net',
    description:
      'ฟีดข่าวธุรกิจ-เศรษฐกิจจากประชาชาติธุรกิจ กรองเฉพาะเนื้อหาที่เกี่ยวกับปลาหมอคางดำ / ปลานิลในพื้นที่ EEC',
    enabled: true,
    fetch: (fetchFn = fetch) =>
      fetchRssFeed({
        fetchFn,
        url: 'https://www.prachachat.net/feed',
        sourceName: 'prachachat',
        queryLabel: 'Prachachat RSS (prefiltered)',
        prefilter: true
      })
  }
];

/** Fetch-only definitions for the orchestration pipeline (run-ingestion.mjs). */
export function buildSourceDefinitions() {
  return SOURCE_REGISTRY.filter((source) => source.enabled).map((source) => ({
    id: source.id,
    label: source.label,
    category: source.category,
    fetch: source.fetch
  }));
}

/**
 * Upsert the code-defined registry into the DataSource table so the API and
 * UI can query metadata without ever trusting DB rows for fetch behavior.
 * Cheap (≤ a handful of rows), idempotent, never deletes unknown rows.
 */
export async function syncSourceRegistry(prisma) {
  const upserts = SOURCE_REGISTRY.map((source) => {
    const { id, fetch: _fetch, ...metadata } = source; // never persist the fetch fn
    return prisma.dataSource.upsert({
      where: { slug: id },
      update: {
        label: metadata.label,
        category: metadata.category,
        transport: metadata.transport,
        authorityType: metadata.authorityType,
        trustTier: metadata.trustTier,
        displayOrder: metadata.displayOrder,
        homepage: metadata.homepage,
        description: metadata.description,
        enabled: metadata.enabled
      },
      create: {
        slug: id,
        label: metadata.label,
        category: metadata.category,
        transport: metadata.transport,
        authorityType: metadata.authorityType,
        trustTier: metadata.trustTier,
        displayOrder: metadata.displayOrder,
        homepage: metadata.homepage,
        description: metadata.description,
        enabled: metadata.enabled
      }
    });
  });
  await Promise.all(upserts);
  return SOURCE_REGISTRY.length;
}

// Re-exports for backwards compatibility with existing tests/imports.
export { parseRssItems, provinceFromText };

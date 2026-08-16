// Source definitions + fetchers for the external-data ingestion pipeline.
//
// Both sources are public, structured, and require no auth or anti-bot
// bypass:
//   1. data.go.th — Thai government open-data portal (CKAN JSON API).
//   2. Google News RSS — Thai-language news mentions of ปลาหมอคางดำ.
//
// Every fetcher accepts an injected `fetchFn` so unit tests can stub the
// network; the default is the global fetch. Parsing helpers are pure.
// Rows are keyed on (sourceName, sourceExternalId) — the unique constraint
// in the DB is the final duplicate safety net.

const USER_AGENT =
  'FihDar/0.1 (system-validation ingestion; contact: fihdar@example.local)';

export const EEC_PROVINCES = ['ฉะเชิงเทรา', 'ชลบุรี', 'ระยอง'];
const EEC_PROVINCE_PATTERN = new RegExp(`(${EEC_PROVINCES.join('|')})`);
const PROVINCE_PREFIX_PATTERN = /จังหวัด(ฉะเชิงเทรา|ชลบุรี|ระยอง)|จ\.?(ฉะเชิงเทรา|ชลบุรี|ระยอง)/;

export function provinceFromText(text) {
  if (!text) return null;
  const match = PROVINCE_PREFIX_PATTERN.exec(text) || EEC_PROVINCE_PATTERN.exec(text);
  return match ? (match[1] ?? match[2]) : null;
}

function decodeEntities(text) {
  return String(text ?? '')
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&apos;', "'");
}

function stripHtml(text) {
  return String(text ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

async function fetchWithTimeout(fetchFn, url, timeoutMs = 15000) {
  const response = await fetchFn(url, {
    headers: { 'user-agent': USER_AGENT, accept: 'application/json, application/xml, text/xml' },
    signal: AbortSignal.timeout(timeoutMs),
    redirect: 'follow'
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.text();
}

// --- Source: data.go.th (Thai government open data, CKAN JSON API) -----------
const DATA_GOV_QUERIES = ['tilapia', 'ปลานิล'];
const DATA_GOV_SEARCH_URL = (query) =>
  `https://data.go.th/api/3/action/package_search?q=${encodeURIComponent(query)}&rows=10`;

export async function fetchDataGoTh(fetchFn = fetch) {
  const packages = [];
  for (const q of DATA_GOV_QUERIES) {
    const body = JSON.parse(await fetchWithTimeout(fetchFn, DATA_GOV_SEARCH_URL(q)));
    if (body?.success !== true) throw new Error('data.go.th returned success=false');
    packages.push(...(body.result?.results ?? []));
  }

  // De-duplicate across the two queries by dataset id.
  const seen = new Set();
  const observations = [];
  for (const pkg of packages) {
    if (seen.has(pkg.id)) continue;
    seen.add(pkg.id);
    const resources = pkg.resources ?? [];
    observations.push({
      sourceName: 'data.go.th',
      sourceExternalId: pkg.id,
      sourceUrl: `https://data.go.th/dataset/${pkg.name ?? pkg.id}`,
      title: decodeEntities(pkg.title ?? pkg.name ?? 'Untitled dataset'),
      description: decodeEntities(stripHtml(pkg.notes)) || null,
      province: provinceFromText(pkg.title ?? pkg.notes),
      publishedAt: pkg.metadata_modified ? new Date(pkg.metadata_modified) : null,
      status: 'NEW',
      rawMetadata: { query: 'tilapia|ปลานิล', resourceCount: resources.length }
    });
  }
  return observations;
}

// --- Source: Google News RSS (Thai-language tilapia mentions) ----------------
export function parseRssItems(xml) {
  const items = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRe.exec(xml)) !== null) {
    const block = match[1];
    const grab = (tag) => {
      const found = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`).exec(block);
      return found ? found[1].trim() : null;
    };
    const title = grab('title');
    const link = grab('link');
    const pubDate = grab('pubDate');
    const guid = grab('guid');
    const description = grab('description');
    if (!title || !link) continue;
    items.push({
      title: decodeEntities(title),
      link,
      pubDate: pubDate ? new Date(pubDate) : null,
      guid: guid ? decodeEntities(guid) : link,
      description: decodeEntities(stripHtml(description)) || null
    });
  }
  return items;
}

export async function fetchGoogleNews(fetchFn = fetch) {
  const query = 'ปลาหมอคางดำ (ฉะเชิงเทรา OR ชลบุรี OR ระยอง)';
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=th&gl=TH&ceid=TH:th`;
  const xml = await fetchWithTimeout(fetchFn, url);
  const items = parseRssItems(xml);
  return items.map((item) => ({
    sourceName: 'google-news-th',
    sourceExternalId: item.guid,
    sourceUrl: item.link,
    title: item.title,
    description: item.description,
    province: provinceFromText(item.title),
    publishedAt: item.pubDate,
    status: 'NEW',
    rawMetadata: { via: 'Google News RSS (hl=th, gl=TH)' }
  }));
}

/** Ordered source list for the refresh pipeline. `id` is the DB sourceName. */
export const SOURCE_DEFINITIONS = [
  { id: 'google-news-th', label: 'Google News RSS', category: 'ข่าวสาธารณะ', fetch: fetchGoogleNews },
  { id: 'data.go.th', label: 'data.go.th', category: 'ข้อมูลเปิดภาครัฐ', fetch: fetchDataGoTh }
];

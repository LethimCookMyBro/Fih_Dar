// External-data ingestion pipeline.
//
// Pulls public, structured information about blackchin tilapia / tilapia in
// Eastern Thailand into the ExternalObservation table. FihDar never claims
// these are confirmed occurrences — they are provenance-tracked observations
// from named public sources.
//
// Sources (both public, no auth, no anti-bot bypass):
//   1. data.go.th  — Thai government open-data portal (CKAN JSON API).
//   2. Google News RSS — Thai-language news mentions of ปลาหมอคางดำ.
//
//   npm run db:ingest
//
// Deduplication: rows are keyed on (sourceName, sourceExternalId); re-running
// the script never creates duplicates and never overwrites existing rows.
// A failing source is reported and skipped — it can never crash the script.
import { PrismaClient } from '@prisma/client';

const USER_AGENT =
  'FihDar/0.1 (system-validation ingestion; contact: fihdar@example.local)';

const EEC_PROVINCES = ['ฉะเชิงเทรา', 'ชลบุรี', 'ระยอง'];
const EEC_PROVINCE_PATTERN = new RegExp(`(${EEC_PROVINCES.join('|')})`);
const PROVINCE_PREFIX_PATTERN = /จังหวัด(ฉะเชิงเทรา|ชลบุรี|ระยอง)|จ\.?(ฉะเชิงเทรา|ชลบุรี|ระยอง)/;

const prisma = new PrismaClient();

function provinceFromText(text) {
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

async function fetchWithTimeout(url, timeoutMs = 15000) {
  const response = await fetch(url, {
    headers: { 'user-agent': USER_AGENT, accept: 'application/json, application/xml, text/xml' },
    signal: AbortSignal.timeout(timeoutMs),
    redirect: 'follow'
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.text();
}

// --- Source 1: data.go.th (Thai government open data, CKAN JSON API) ---------
async function ingestDataGoTh() {
  const queries = ['tilapia', 'ปลานิล'];
  const packages = [];
  for (const q of queries) {
    const url = `https://data.go.th/api/3/action/package_search?q=${encodeURIComponent(q)}&rows=10`;
    const body = JSON.parse(await fetchWithTimeout(url));
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

// --- Source 2: Google News RSS (Thai-language tilapia mentions) ---------------
function parseRssItems(xml) {
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

async function ingestGoogleNews() {
  const query = 'ปลาหมอคางดำ (ฉะเชิงเทรา OR ชลบุรี OR ระยอง)';
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=th&gl=TH&ceid=TH:th`;
  const xml = await fetchWithTimeout(url);
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

async function upsertObservations(observations, sourceLabel) {
  let created = 0;
  let skipped = 0;
  for (const observation of observations) {
    const existing = await prisma.externalObservation.findUnique({
      where: {
        sourceName_sourceExternalId: {
          sourceName: observation.sourceName,
          sourceExternalId: observation.sourceExternalId
        }
      },
      select: { id: true }
    });
    if (existing) {
      skipped += 1;
      continue; // dedupe: never overwrite an existing observation
    }
    await prisma.externalObservation.create({ data: observation });
    created += 1;
  }
  console.log(`  ${sourceLabel}: ${created} ingested, ${skipped} already present (skipped)`);
  return { created, skipped };
}

async function main() {
  console.log('FihDar external-data ingestion');

  // Source 1 — data.go.th
  try {
    const observations = await ingestDataGoTh();
    console.log(`data.go.th: ${observations.length} dataset(s) matched`);
    await upsertObservations(observations, 'data.go.th');
  } catch (error) {
    console.error(`  data.go.th failed (skipped): ${error.message ?? error}`);
  }

  // Source 2 — Google News RSS
  try {
    const observations = await ingestGoogleNews();
    console.log(`google-news-th: ${observations.length} article(s) matched`);
    await upsertObservations(observations, 'google-news-th');
  } catch (error) {
    console.error(`  google-news-th failed (skipped): ${error.message ?? error}`);
  }

  const [total, bySource] = await Promise.all([
    prisma.externalObservation.count(),
    prisma.externalObservation.groupBy({ by: ['sourceName'], _count: { _all: true } })
  ]);
  console.log(
    `external observations in database: ${total} (${bySource
      .map((item) => `${item.sourceName}=${item._count._all}`)
      .join(', ')})`
  );
}

main()
  .catch((error) => {
    console.error('ingest failed:', error.message ?? error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

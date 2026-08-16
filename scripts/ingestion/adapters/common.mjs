// Shared helpers for the structured-source adapters (RSS / CKAN / JSON API).
//
// Everything here is pure text/HTTP plumbing — no scraping, no anti-bot
// bypass. All fetch calls go through fetchWithTimeout with a fixed, bounded
// timeout and a FihDar user-agent. Decoding helpers are shared so every
// adapter produces the same provenance-clean strings.

export const USER_AGENT =
  'FihDar/0.1 (system-validation ingestion; contact: fihdar@example.local)';

export const EEC_PROVINCES = ['ฉะเชิงเทรา', 'ชลบุรี', 'ระยอง'];
const EEC_PROVINCE_PATTERN = new RegExp(`(${EEC_PROVINCES.join('|')})`);
// 'จฉะเชิงเทรา' or 'จ.ฉะเชิงเทรา' (and ชลบุรี / ระยอง). [.] matches a literal
// dot without needing an escape.
const PROVINCE_PREFIX_PATTERN = new RegExp(
  `จังหวัด(${EEC_PROVINCES.join('|')})|จ[.]?(${EEC_PROVINCES.join('|')})`
);

/** First EEC province literally named in the text (ฉะเชิงเทรา/ชลบุรี/ระยอง). */
export function provinceFromText(text) {
  if (!text) return null;
  const match = PROVINCE_PREFIX_PATTERN.exec(text) || EEC_PROVINCE_PATTERN.exec(text);
  return match ? (match[1] ?? match[2]) : null;
}

export function decodeEntities(text) {
  return String(text ?? '')
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&apos;', "'");
}

export function stripHtml(text) {
  return String(text ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t\r\n]+/g, ' ')
    .trim();
}

export async function fetchWithTimeout(fetchFn, url, timeoutMs = 15000) {
  const response = await fetchFn(url, {
    headers: {
      'user-agent': USER_AGENT,
      accept: 'application/json, application/xml, text/xml, application/atom+xml'
    },
    signal: AbortSignal.timeout(timeoutMs),
    redirect: 'follow'
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.text();
}

/**
 * Pre-filter for broad outlet feeds. A full-outlet RSS feed (Matichon,
 * Khaosod, …) carries 30–50 items, almost all unrelated to the mission. We
 * keep only items that mention the target species (any alias the species gate
 * accepts) or generic tilapia in an EEC province. This bounds what is
 * ingested; the intelligence pipeline still applies the full species gate and
 * relevance verdict on top.
 */
export const PRE_FILTER_SPECIES_TERMS = [
  'ปลาหมอคางดำ',
  'ปลาหมอค้างดำ',
  'หมอคางดำ',
  'หมอค้างดำ',
  'blackchin tilapia',
  'blackchin',
  'sarotherodon melanotheron'
];

export const PRE_FILTER_TILAPIA_TERMS = ['ปลานิล', 'tilapia'];

/** True when a news item text is worth ingesting from a broad outlet feed. */
export function passesNewsPrefilter(text) {
  const lower = String(text ?? '').toLowerCase();
  const speciesHit = PRE_FILTER_SPECIES_TERMS.some((term) => lower.includes(term));
  if (speciesHit) return true;
  const tilapiaHit = PRE_FILTER_TILAPIA_TERMS.some((term) => lower.includes(term));
  return tilapiaHit && provinceFromText(text) !== null;
}

// RSS / Atom feed adapter — for stable public feeds only.
//
// Capabilities: title, canonical URL, GUID (with link fallback), description
// (HTML stripped), published date, deterministic external ID, optional
// keyword pre-filter, provenance metadata. No scraping, no pagination (feeds
// are bounded by nature), no anti-bot bypass.
//
// Parsing is split-based (no regex escapes), deterministic, and tolerant of
// malformed entries: an item missing title or link is skipped, an item
// missing an optional field gets null.

import { decodeEntities, fetchWithTimeout, passesNewsPrefilter, provinceFromText, stripHtml } from './common.mjs';

/** Extract the first '<tag ...>content</tag>' block, or null. */
function grabTag(block, tag) {
  const openTag = `<${tag}`;
  const open = block.indexOf(openTag);
  if (open < 0) return null;
  const contentStart = block.indexOf('>', open + openTag.length);
  if (contentStart < 0) return null;
  const contentEnd = block.indexOf(`</${tag}>`, contentStart + 1);
  if (contentEnd < 0) return null;
  return block.slice(contentStart + 1, contentEnd).trim();
}

/** Pure parser: RSS 2.0 `<item>` blocks → normalized entries. Deterministic. */
export function parseRssItems(xml) {
  const items = [];
  const source = String(xml ?? '');
  const parts = source.split('<item>');
  for (let i = 1; i < parts.length; i += 1) {
    const end = parts[i].indexOf('</item>');
    const block = end >= 0 ? parts[i].slice(0, end) : parts[i];
    const title = grabTag(block, 'title');
    const link = grabTag(block, 'link');
    const pubDate = grabTag(block, 'pubDate');
    const guid = grabTag(block, 'guid');
    const description = grabTag(block, 'description');
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

/**
 * Fetch a feed and map its entries into observation rows.
 *
 * @param {object} opts
 * @param {Function} opts.fetchFn injected fetch (tests stub this)
 * @param {string} opts.url feed URL
 * @param {string} opts.sourceName stable source slug (DB sourceName)
 * @param {string} [opts.queryLabel] human label for provenance metadata
 * @param {boolean} [opts.prefilter] apply the species/EEC pre-filter
 * @returns {Promise<Array>} observation rows
 */
export async function fetchRssFeed({ fetchFn = fetch, url, sourceName, queryLabel, prefilter = false }) {
  const xml = await fetchWithTimeout(fetchFn, url);
  const items = parseRssItems(xml);
  const observations = [];
  for (const item of items) {
    const text = `${item.title} ${item.description ?? ''}`;
    if (prefilter && !passesNewsPrefilter(text)) continue;
    observations.push({
      sourceName,
      sourceExternalId: item.guid,
      sourceUrl: item.link,
      title: item.title,
      description: item.description,
      province: provinceFromText(text),
      publishedAt: item.pubDate,
      status: 'NEW',
      rawMetadata: {
        via: queryLabel ?? 'RSS feed',
        guid: item.guid,
        publishedAt: item.pubDate?.toISOString() ?? null
      }
    });
  }
  return observations;
}

// Generic structured public JSON API adapter.
//
// Not a scraper: the URL template is fixed in the allowlisted source
// definition, pagination is bounded (maxPages × perPage), and each item is
// mapped through a source-specific `mapItem` function into an observation
// row. Used by the iNaturalist occurrence source.

import { fetchWithTimeout } from './common.mjs';

/**
 * @param {object} opts
 * @param {Function} opts.fetchFn injected fetch
 * @param {string} opts.urlTemplate URL template with {page} placeholder
 * @param {string} opts.sourceName stable source slug
 * @param {(item: any, index: number) => (object | null)} opts.mapItem item → observation row (null to skip)
 * @param {number} [opts.maxPages=1] bounded pagination depth
 * @param {number} [opts.perPage=200] page size
 * @param {(body: any) => any[]} [opts.listBody] extract the item array from the JSON body
 * @returns {Promise<Array>} observation rows
 */
export async function fetchJsonApi({
  fetchFn = fetch,
  urlTemplate,
  sourceName,
  mapItem,
  maxPages = 1,
  perPage = 200,
  listBody = (body) => body.results ?? []
}) {
  const observations = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const url = urlTemplate
      .replace('{page}', String(page))
      .replace('{perPage}', String(perPage));
    const body = JSON.parse(await fetchWithTimeout(fetchFn, url));
    const items = listBody(body);
    let mapped = 0;
    for (const item of items) {
      const row = mapItem(item);
      if (!row) continue;
      observations.push(row);
      mapped += 1;
    }
    // Stop early when a page returns fewer than requested — end of records.
    if (items.length < perPage) break;
  }
  return observations;
}

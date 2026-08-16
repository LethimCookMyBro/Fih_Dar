// CKAN JSON API adapter — for open-data portals exposing the standard CKAN
// action API (data.go.th, etc.).
//
// Capabilities: multiple keyword queries with in-memory de-duplication by
// package id, bounded result size (rows per query), deterministic external ID
// (the CKAN package id), provenance metadata. No unlimited download.

import { decodeEntities, fetchWithTimeout, provinceFromText, stripHtml } from './common.mjs';

/**
 * Fetch CKAN packages matching a set of queries and map them to observations.
 *
 * @param {object} opts
 * @param {Function} opts.fetchFn injected fetch
 * @param {string} opts.baseUrl CKAN root (e.g. https://data.go.th)
 * @param {string[]} opts.queries keyword queries
 * @param {number} [opts.rows=10] packages per query (bounded)
 * @param {string} opts.sourceName stable source slug
 * @param {string} [opts.datasetUrlPrefix] URL prefix for the dataset page
 * @returns {Promise<Array>} observation rows
 */
export async function fetchCkanPackages({
  fetchFn = fetch,
  baseUrl,
  queries,
  rows = 10,
  sourceName,
  datasetUrlPrefix
}) {
  const searchUrl = (query) =>
    `${baseUrl}/api/3/action/package_search?q=${encodeURIComponent(query)}&rows=${rows}`;
  const packages = [];
  for (const q of queries) {
    const body = JSON.parse(await fetchWithTimeout(fetchFn, searchUrl(q)));
    if (body?.success !== true) throw new Error(`${sourceName}: CKAN returned success=false`);
    packages.push(...(body.result?.results ?? []));
  }

  // De-duplicate across queries by dataset id.
  const seen = new Set();
  const observations = [];
  for (const pkg of packages) {
    if (seen.has(pkg.id)) continue;
    seen.add(pkg.id);
    const resources = pkg.resources ?? [];
    observations.push({
      sourceName,
      sourceExternalId: pkg.id,
      sourceUrl: `${datasetUrlPrefix ?? `${baseUrl}/dataset`}/${pkg.name ?? pkg.id}`,
      title: decodeEntities(pkg.title ?? pkg.name ?? 'Untitled dataset'),
      description: decodeEntities(stripHtml(pkg.notes)) || null,
      province: provinceFromText(pkg.title ?? pkg.notes),
      publishedAt: pkg.metadata_modified ? new Date(pkg.metadata_modified) : null,
      status: 'NEW',
      rawMetadata: {
        query: queries.join('|'),
        resourceCount: resources.length,
        via: `${baseUrl} (CKAN API)`
      }
    });
  }
  return observations;
}

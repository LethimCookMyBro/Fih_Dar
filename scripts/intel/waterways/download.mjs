// EEC waterway dataset downloader.
//
//   npm run waterways:download
//
// Source evaluation (see docs/intelligence.md for the full rationale):
//   - HydroRIVERS Asia  — 91MB shapefile, research-modeled river reaches
//     (derived from a DEM, not surveyed geometry), no local names. Kept as a
//     Phase-2B candidate for basin-scale analysis.
//   - Geofabrik Thailand — 311MB .osm.pbf for the WHOLE country (ODbL).
//   - Overpass API (chosen): returns exactly the OSM waterways inside the EEC
//     study area — a few MB, authoritative field-mapped geometry, local Thai
//     names, ODbL with attribution to OSM contributors.
//
// Outputs (both committed — small and reproducible):
//   data/eec-waterways.geojson        — LineString features
//   data/eec-waterways.provenance.json — source, license, date, stats
//
// The download is a single bounded Overpass query; the script never hammers
// the API (one request, several public mirrors as fallback).

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const OUT_GEOJSON = join(ROOT, 'data', 'eec-waterways.geojson');
const OUT_PROVENANCE = join(ROOT, 'data', 'eec-waterways.provenance.json');

// EEC study area (Chachoengsao + Chonburi + Rayong) with a small buffer.
const BBOX = { south: 12.5, west: 100.75, north: 14.0, east: 101.9 };

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
];

const QUERY = `[out:json][timeout:90];
(
  way["waterway"~"^(river|stream|canal|drain|tidal_channel)$"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
);
out geom;`;

async function fetchOverpass() {
  let lastError = null;
  for (const endpoint of ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'FihDar/0.1 (system-validation; one-shot EEC waterway extract)' },
        body: new URLSearchParams({ data: QUERY }),
        signal: AbortSignal.timeout(120_000)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status} from ${endpoint}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      console.error(`  endpoint ${endpoint} failed: ${error.message ?? error}`);
    }
  }
  throw new Error(`all Overpass endpoints failed: ${lastError?.message ?? lastError}`);
}

function toGeoJSON(result) {
  const features = [];
  const stats = { total: 0, named: 0, byType: {} };
  for (const element of result.elements ?? []) {
    if (element.type !== 'way' || !element.geometry) continue;
    const coordinates = element.geometry.map((point) => [point.lon, point.lat]);
    if (coordinates.length < 2) continue;
    const tags = element.tags ?? {};
    const name = tags.name ?? null;
    const type = tags.waterway ?? 'unknown';
    stats.total += 1;
    if (name) stats.named += 1;
    stats.byType[type] = (stats.byType[type] ?? 0) + 1;
    features.push({
      type: 'Feature',
      properties: {
        osmId: `${element.type}/${element.id}`,
        name,
        waterway: type,
        // approximate planar length in km (equirectangular — good enough for
        // ordering and graph weights; not a survey-grade measurement)
        lengthKm: Math.round(approximateKm(coordinates) * 100) / 100
      },
      geometry: { type: 'LineString', coordinates }
    });
  }
  return { features, stats };
}

function approximateKm(coordinates) {
  let total = 0;
  for (let i = 1; i < coordinates.length; i += 1) {
    const [lon1, lat1] = coordinates[i - 1];
    const [lon2, lat2] = coordinates[i];
    const dx = (lon2 - lon1) * 111.32 * Math.cos(((lat1 + lat2) / 2) * (Math.PI / 180));
    const dy = (lat2 - lat1) * 110.57;
    total += Math.sqrt(dx * dx + dy * dy);
  }
  return total;
}

async function main() {
  console.log('fetching EEC waterways from OSM (Overpass)…');
  const result = await fetchOverpass();
  const { features, stats } = toGeoJSON(result);

  mkdirSync(dirname(OUT_GEOJSON), { recursive: true });
  writeFileSync(OUT_GEOJSON, JSON.stringify({ type: 'FeatureCollection', features }, null, 1));

  const provenance = {
    dataset: 'EEC waterways (Chachoengsao, Chonburi, Rayong)',
    source: 'OpenStreetMap via Overpass API (public endpoints)',
    derivedFrom: 'OSM ways tagged waterway in {river, stream, canal, drain, tidal_channel}',
    bbox: BBOX,
    license: 'ODbL 1.0 — © OpenStreetMap contributors. Requires attribution and share-alike for derivative databases.',
    attribution: '© OpenStreetMap contributors',
    generatedAt: new Date().toISOString(),
    query: QUERY,
    stats
  };
  writeFileSync(OUT_PROVENANCE, JSON.stringify(provenance, null, 2));
  console.log(`wrote ${features.length} waterway segment(s) (${stats.named} named) to ${OUT_GEOJSON}`);
  console.log('by type:', JSON.stringify(stats.byType));
}

main().catch((error) => {
  console.error('download failed:', error.message ?? error);
  process.exitCode = 1;
});

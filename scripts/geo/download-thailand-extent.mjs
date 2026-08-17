// Thailand extent downloader — the mask that confines /map to Thailand.
//
//   npm run geo:download
//
// Why this exists: the basemap is a world basemap. FihDar surveils Thailand, so
// everything outside Thai jurisdiction is painted over. That needs a real
// national extent; none is invented here.
//
// Source: the OpenStreetMap boundary relation for ประเทศไทย, via Overpass
// (ODbL, © OpenStreetMap contributors). Deliberately the SAME lineage as the
// basemap, which is OSM-derived through OpenMapTiles — a generalised source such
// as Natural Earth cannot align with what is rendered underneath, and the
// mismatch shows as grey spilling over the border or biting into the country.
//
// That relation already traces Thailand's TERRITORIAL WATERS, not its coastline:
// the coast falls inside the extent, and the mask edge runs offshore at the
// 12 NM limit. The check below proves that against an independent dataset
// (Marine Regions) on every run rather than trusting it — if OSM ever narrowed
// the relation to dry land, the sea would silently turn grey.
//
// The 200 NM EEZ is not involved. In the Gulf of Thailand it covers the
// unresolved Thailand–Cambodia overlapping claims area and the Thailand–Malaysia
// joint development area; drawing it as one line would assert a settled maritime
// boundary that does not exist.
//
// Output (committed — reproducible, served statically):
//   public/geo/thailand-mask.geojson
//   data/thailand-extent.provenance.json

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import polygonClipping from 'polygon-clipping';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT_MASK = join(ROOT, 'public', 'geo', 'thailand-mask.geojson');
const OUT_PROVENANCE = join(ROOT, 'data', 'thailand-extent.provenance.json');

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
];

const OVERPASS_QUERY = `[out:json][timeout:600];
relation["boundary"="administrative"]["admin_level"="2"]["ISO3166-1"="TH"];
out geom;`;

const MARINE_REGIONS = 'https://geo.vliz.be/geoserver/MarineRegions/wfs';

/**
 * Douglas-Peucker tolerance in degrees. 0.00005° ≈ 5.5 m — under one screen
 * pixel until past zoom 15, so the mask edge stays glued to the boundary the
 * basemap draws rather than hovering near it.
 */
const TOLERANCE = 0.00005;
const PRECISION = 6;

/**
 * Fraction of the independently-sourced territorial sea that must fall inside
 * the OSM extent. Below this the relation no longer means what this script
 * assumes, and a silently wrong mask is worse than a failed build.
 */
const MIN_SEA_COVERAGE = 0.9;

// --- fetching ---------------------------------------------------------------

async function fetchOverpass() {
  let lastError = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'user-agent': 'FihDar/0.1 (one-shot national boundary extract)'
        },
        body: new URLSearchParams({ data: OVERPASS_QUERY }),
        signal: AbortSignal.timeout(600_000)
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

function marineRegionsUrl(layer) {
  const params = new URLSearchParams({
    service: 'WFS',
    version: '1.0.0',
    request: 'GetFeature',
    typeName: `MarineRegions:${layer}`,
    outputFormat: 'application/json',
    CQL_FILTER: "territory1='Thailand'"
  });
  return `${MARINE_REGIONS}?${params}`;
}

async function fetchJson(url, label) {
  const response = await fetch(url, {
    headers: { 'user-agent': 'FihDar/0.1 (boundary cross-check)' },
    signal: AbortSignal.timeout(300_000)
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${label}`);
  return response.json();
}

// --- geometry ---------------------------------------------------------------

const endpointKey = (point) => `${point[0].toFixed(7)},${point[1].toFixed(7)}`;

/**
 * An OSM boundary relation is an unordered bag of ways. Chain them end to end
 * into closed rings; a leftover that will not close means the relation is broken
 * upstream and the result would be a silently wrong mask, so it throws.
 */
function assembleRings(ways) {
  const endpoints = new Map();
  const used = new Array(ways.length).fill(false);
  const index = (key, i) => {
    if (!endpoints.has(key)) endpoints.set(key, []);
    endpoints.get(key).push(i);
  };
  ways.forEach((way, i) => {
    index(endpointKey(way[0]), i);
    index(endpointKey(way.at(-1)), i);
  });

  const rings = [];
  for (let i = 0; i < ways.length; i += 1) {
    if (used[i]) continue;
    used[i] = true;
    const ring = [...ways[i]];

    let guard = 0;
    while (endpointKey(ring[0]) !== endpointKey(ring.at(-1)) && guard <= ways.length) {
      guard += 1;
      const tail = endpointKey(ring.at(-1));
      const next = (endpoints.get(tail) ?? []).find((j) => !used[j]);
      if (next === undefined) break;
      used[next] = true;
      const way = ways[next];
      const forward = endpointKey(way[0]) === tail;
      ring.push(...(forward ? way.slice(1) : [...way].reverse().slice(1)));
    }

    if (endpointKey(ring[0]) !== endpointKey(ring.at(-1)) || ring.length < 4) {
      throw new Error(
        `boundary relation does not close: ring of ${ring.length} point(s) starting at ${endpointKey(ring[0])}`
      );
    }
    rings.push(ring);
  }
  return rings;
}

/** Douglas-Peucker over lon/lat degrees. */
function simplifyRing(ring, tolerance) {
  if (ring.length < 5) return ring;

  const squaredSegmentDistance = (point, start, end) => {
    let [x, y] = start;
    const dx = end[0] - x;
    const dy = end[1] - y;
    if (dx !== 0 || dy !== 0) {
      const t = ((point[0] - x) * dx + (point[1] - y) * dy) / (dx * dx + dy * dy);
      if (t > 1) [x, y] = end;
      else if (t > 0) {
        x += dx * t;
        y += dy * t;
      }
    }
    return (point[0] - x) ** 2 + (point[1] - y) ** 2;
  };

  const limit = tolerance * tolerance;
  const keep = new Uint8Array(ring.length);
  keep[0] = 1;
  keep[ring.length - 1] = 1;

  const stack = [[0, ring.length - 1]];
  while (stack.length > 0) {
    const [start, end] = stack.pop();
    let furthest = 0;
    let index = -1;
    for (let i = start + 1; i < end; i += 1) {
      const distance = squaredSegmentDistance(ring[i], ring[start], ring[end]);
      if (distance > furthest) {
        furthest = distance;
        index = i;
      }
    }
    if (furthest > limit && index > 0) {
      keep[index] = 1;
      stack.push([start, index], [index, end]);
    }
  }

  const simplified = ring.filter((_, i) => keep[i] === 1);
  // Never simplify a ring out of existence.
  return simplified.length >= 4 ? simplified : ring;
}

function finishRing(ring) {
  const simplified = simplifyRing(ring, TOLERANCE);
  const out = [];
  for (const [lon, lat] of simplified) {
    const point = [Number(lon.toFixed(PRECISION)), Number(lat.toFixed(PRECISION))];
    const previous = out.at(-1);
    if (previous && previous[0] === point[0] && previous[1] === point[1]) continue;
    out.push(point);
  }
  const first = out[0];
  const last = out.at(-1);
  if (first && last && (first[0] !== last[0] || first[1] !== last[1])) out.push([...first]);
  return out;
}

const toMultiPolygon = (geometry) =>
  geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;

/** Planar shoelace area in square degrees — only ever used as a ratio. */
function multiPolygonArea(multiPolygon) {
  let total = 0;
  for (const polygon of multiPolygon) {
    polygon.forEach((ring, index) => {
      let area = 0;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        area += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
      }
      // First ring is the outer boundary, the rest are holes.
      total += (index === 0 ? 1 : -1) * Math.abs(area / 2);
    });
  }
  return total;
}

// --- main -------------------------------------------------------------------

async function main() {
  console.log('fetching the OSM boundary relation for ประเทศไทย (Overpass)…');
  const osm = await fetchOverpass();
  const relation = (osm.elements ?? []).find((element) => element.type === 'relation');
  if (!relation) throw new Error('Overpass returned no boundary relation for TH');

  const ways = (relation.members ?? [])
    .filter((member) => member.role === 'outer' && Array.isArray(member.geometry))
    .map((member) => member.geometry.map((point) => [point.lon, point.lat]));
  if (ways.length === 0) throw new Error('boundary relation has no outer ways with geometry');

  const rings = assembleRings(ways);
  const extent = rings.map((ring) => [ring]);
  const rawPoints = rings.reduce((total, ring) => total + ring.length, 0);
  console.log(`  ${ways.length} way(s) → ${rings.length} closed ring(s), ${rawPoints} points`);

  // --- cross-check: does this extent really include the territorial sea? -----
  console.log('cross-checking against Marine Regions (independent maritime source)…');
  const [internal, territorial] = await Promise.all([
    fetchJson(marineRegionsUrl('eez_internal_waters'), 'internal waters'),
    fetchJson(marineRegionsUrl('eez_12nm'), 'territorial sea')
  ]);
  const seaFeatures = [...internal.features, ...territorial.features];
  if (seaFeatures.length === 0) throw new Error('Marine Regions returned no Thai water bodies');

  const sea = polygonClipping.union(...seaFeatures.map((f) => toMultiPolygon(f.geometry)));
  const seaInside = polygonClipping.intersection(extent, sea);
  const coverage = multiPolygonArea(seaInside) / multiPolygonArea(sea);
  const seaAreaKm2 = seaFeatures.reduce((t, f) => t + (f.properties.area_km2 ?? 0), 0);

  console.log(
    `  ${(coverage * 100).toFixed(1)}% of Thailand's ${seaAreaKm2.toLocaleString()} km² of internal + territorial waters falls inside the OSM extent`
  );
  if (coverage < MIN_SEA_COVERAGE) {
    throw new Error(
      `the OSM boundary relation no longer covers Thailand's territorial sea ` +
        `(${(coverage * 100).toFixed(1)}% < ${MIN_SEA_COVERAGE * 100}%). ` +
        `Masking with it would grey out Thai waters — inspect the relation before regenerating.`
    );
  }

  // --- build the mask -------------------------------------------------------
  // Outer rings only: a hole inside the extent must stay visible rather than
  // being painted over.
  const holes = extent.map((polygon) => finishRing(polygon[0]));
  const maskPoints = holes.reduce((total, ring) => total + ring.length, 0);

  // ±85.05 is the Web Mercator limit — a ring beyond it has no valid projection.
  const worldRing = [
    [-180, -85],
    [180, -85],
    [180, 85],
    [-180, 85],
    [-180, -85]
  ];

  const mask = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { name: 'นอกเขตประเทศไทย' },
        geometry: { type: 'Polygon', coordinates: [worldRing, ...holes] }
      }
    ]
  };

  mkdirSync(dirname(OUT_MASK), { recursive: true });
  writeFileSync(OUT_MASK, JSON.stringify(mask));

  const provenance = {
    dataset: 'Thailand extent (land + territorial waters) — /map basemap mask',
    generatedAt: new Date().toISOString(),
    attribution: '© OpenStreetMap contributors (ODbL)',
    source: {
      name: `OpenStreetMap relation ${relation.id} — ${relation.tags?.name ?? 'ประเทศไทย'} (admin_level=2)`,
      endpoint: OVERPASS_ENDPOINTS[0],
      query: OVERPASS_QUERY,
      license: 'ODbL 1.0 — © OpenStreetMap contributors. Attribution and share-alike required.',
      why: 'Same lineage as the OpenMapTiles basemap, so the mask edge matches the boundary rendered underneath it.'
    },
    covers:
      'Thai land plus internal waters and the 12 NM territorial sea. The coastline is inside the extent; the mask edge runs offshore.',
    verification: {
      method:
        'Area of (OSM extent ∩ Marine Regions internal waters ∪ 12 NM territorial sea) ÷ area of those waters.',
      against: [marineRegionsUrl('eez_internal_waters'), marineRegionsUrl('eez_12nm')],
      againstLicense: 'Marine Regions (VLIZ) — CC BY 4.0. Used to verify only; not redistributed.',
      referenceWaterAreaKm2: seaAreaKm2,
      seaCoverage: Number(coverage.toFixed(4)),
      minimumAccepted: MIN_SEA_COVERAGE
    },
    excluded: {
      eez200nm:
        'The 200 NM EEZ is deliberately not shown. In the Gulf of Thailand it includes the unresolved Thailand–Cambodia overlapping claims area and the Thailand–Malaysia joint development area; rendering it as one line would assert a settled boundary that does not exist.'
    },
    simplification: {
      algorithm: 'Douglas-Peucker',
      toleranceDegrees: TOLERANCE,
      toleranceMetres: Math.round(TOLERANCE * 111_000),
      coordinatePrecision: PRECISION,
      note: 'Sub-pixel below zoom 15.'
    },
    stats: { rings: rings.length, rawPoints, maskPoints, maskHoles: holes.length }
  };
  mkdirSync(dirname(OUT_PROVENANCE), { recursive: true });
  writeFileSync(OUT_PROVENANCE, JSON.stringify(provenance, null, 2));

  console.log(
    `wrote ${OUT_MASK} — ${holes.length} hole(s), ${maskPoints} points (from ${rawPoints})`
  );
}

main().catch((error) => {
  console.error('download failed:', error.message ?? error);
  process.exitCode = 1;
});

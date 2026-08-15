// Waterway intelligence — nearest waterway association.
//
// Given a SOURCE-provided coordinate, finds the nearest OSM waterway segment
// and the planar distance to it. This is a derived spatial association only:
//   sourceLatitude/sourceLongitude (source-provided, never invented)  ← input
//   derivedNearestWaterway / derivedDistanceMeters (computed here)    ← output
//
// A small distance never implies a confirmed fish occurrence — it is recorded
// as derived association, separate from any source claim.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let cache = null;

export function loadWaterways(file = join(process.cwd(), 'data', 'eec-waterways.geojson')) {
  if (cache) return cache;
  const parsed = JSON.parse(readFileSync(file, 'utf8'));
  const features = parsed.features
    .map((feature) => ({
      osmId: feature.properties.osmId,
      name: feature.properties.name ?? null,
      waterway: feature.properties.waterway,
      lengthKm: feature.properties.lengthKm,
      coords: feature.geometry.coordinates
    }))
    // pre-computed bbox for cheap rejection
    .map((feature) => {
      let minLon = Infinity;
      let maxLon = -Infinity;
      let minLat = Infinity;
      let maxLat = -Infinity;
      for (const [lon, lat] of feature.coords) {
        if (lon < minLon) minLon = lon;
        if (lon > maxLon) maxLon = lon;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }
      return { ...feature, bbox: { minLon, maxLon, minLat, maxLat } };
    });
  cache = { features, generatedAt: parsed.generatedAt };
  return cache;
}

/** Planar point-to-segment distance in meters (equirectangular approx). */
function pointSegmentMeters(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  let t = lengthSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  const dLon = (cx - px) * 111.32 * Math.cos(py * (Math.PI / 180));
  const dLat = (cy - py) * 110.57;
  return Math.sqrt(dLon * dLon + dLat * dLat) * 1000;
}

/**
 * Nearest waterway for a source coordinate.
 * Returns { name, waterway, osmId, distanceMeters } or null when the dataset
 * is unavailable.
 */
export function nearestWaterway(latitude, longitude) {
  const { features } = loadWaterways();
  let best = null;
  for (const feature of features) {
    const { coords } = feature;
    for (let i = 1; i < coords.length; i += 1) {
      const [lon1, lat1] = coords[i - 1];
      const [lon2, lat2] = coords[i];
      const distance = pointSegmentMeters(longitude, latitude, lon1, lat1, lon2, lat2);
      if (!best || distance < best.distanceMeters) {
        best = { name: feature.name, waterway: feature.waterway, osmId: feature.osmId, distanceMeters: Math.round(distance) };
      }
    }
  }
  return best;
}

import type { LocationPrecision } from '@/features/reports/api/types';

const EARTH_RADIUS_METERS = 6371008.8;

/**
 * Centralized deterministic camera zoom per declared location precision —
 * the ONE place map navigation decides how close to fly for a selected
 * report/event, so citizen reports, priority events, and any future caller
 * never drift into inconsistent zoom logic. Calibrated against this map's
 * own existing reference points (INITIAL_VIEW zoom 8 = national/EEC
 * overview, province quick-places = zoom 10, waterway quick-place = zoom 11
 * — see constants.ts): EXACT reads as a close, meaningful pin; anything
 * coarser flies to a wide-enough view that the representative coordinate
 * cannot visually read as a claimed sighting point. This is NOT a GPS
 * accuracy radius — see report-layers.ts's IS_EXACT comment for that
 * distinction. UNKNOWN gets the widest, most conservative zoom: it is the
 * one precision level where even the coarse administrative area is in doubt.
 */
const ZOOM_BY_PRECISION: Record<LocationPrecision, number> = {
  EXACT: 15,
  WATERBODY: 13,
  SUBDISTRICT: 11,
  DISTRICT: 9,
  PROVINCE: 8,
  UNKNOWN: 7
};

export function zoomForLocationPrecision(precision: LocationPrecision | null | undefined): number {
  return ZOOM_BY_PRECISION[precision ?? 'UNKNOWN'] ?? ZOOM_BY_PRECISION.UNKNOWN;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

/**
 * A geodesic circle polygon around `center` — the destination-point-on-sphere
 * formula (same approach Turf.js's `circle` uses), not a fixed pixel radius.
 * `radiusMeters` is therefore a real ground distance at every latitude and
 * zoom level, unlike MapLibre's `heatmap-radius` (which is pixels).
 */
export function circlePolygon(
  center: { longitude: number; latitude: number },
  radiusMeters: number,
  steps = 48
): GeoJSON.Polygon {
  const angularDistance = radiusMeters / EARTH_RADIUS_METERS;
  const lat1 = toRadians(center.latitude);
  const lon1 = toRadians(center.longitude);

  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i += 1) {
    const bearing = (i / steps) * 2 * Math.PI;
    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(angularDistance) +
        Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing)
    );
    const lon2 =
      lon1 +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
        Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2)
      );
    ring.push([toDegrees(lon2), toDegrees(lat2)]);
  }

  return { type: 'Polygon', coordinates: [ring] };
}

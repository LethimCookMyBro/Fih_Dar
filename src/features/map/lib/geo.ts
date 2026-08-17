const EARTH_RADIUS_METERS = 6371008.8;

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

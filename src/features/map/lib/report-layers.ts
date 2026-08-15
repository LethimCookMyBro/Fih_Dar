import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';

import type { Report } from '@/features/reports/api/types';

export const REPORTS_SOURCE = 'fihdar-reports';
export const HEATMAP_SOURCE = 'fihdar-reports-flat';
export const CLUSTER_LAYER = 'fihdar-reports-clusters';
export const CLUSTER_COUNT_LAYER = 'fihdar-reports-cluster-count';
export const POINT_LAYER = 'fihdar-reports-point';
export const HEATMAP_LAYER = 'fihdar-reports-heatmap';
export const SELECTED_LAYER = 'fihdar-reports-selected';
export const OBSERVATIONS_SOURCE = 'fihdar-observations';
export const OBSERVATIONS_LAYER = 'fihdar-observations-point';

export const OBSERVATION_IMAGE = 'fihdar-observation-diamond';

const KEPPEL = '#2A9D8F';
/** Eggplant #4B2142 as raw RGB for the observation diamond image buffer. */
const EGGPLANT = [0x4b, 0x21, 0x42] as const;
/** Matches nothing — the selection layer's resting filter. */
const NO_SELECTION: ['==', string, string] = ['==', 'id', '__no_selection__'];

type ReportFeatureCollection = GeoJSON.FeatureCollection<GeoJSON.Point, { id: string }>;

export function toFeatureCollection(reports: Report[]): ReportFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: reports.map((report) => ({
      type: 'Feature',
      id: report.id,
      geometry: { type: 'Point', coordinates: [report.longitude, report.latitude] },
      properties: { id: report.id }
    }))
  };
}

/**
 * Borrow a font stack the style's glyph endpoint is known to serve — hardcoding
 * one silently drops the label if the endpoint has never heard of it. Italic
 * faces are skipped so the cluster count reads as a plain number.
 */
function styleTextFont(map: MapLibreMap): string[] | undefined {
  for (const layer of map.getStyle().layers ?? []) {
    if (layer.type !== 'symbol') continue;
    const font: unknown = layer.layout?.['text-font'];
    if (!Array.isArray(font) || !font.every((item) => typeof item === 'string')) continue;
    const stack = font as string[];
    if (stack.some((name) => /italic/i.test(name))) continue;
    return stack;
  }
  return undefined;
}

export function addReportLayers(map: MapLibreMap, data: ReportFeatureCollection): void {
  if (map.getSource(REPORTS_SOURCE)) return;
  const textFont = styleTextFont(map);

  // Two sources over the same features: clustering must stay off for the
  // heatmap or density would be computed from cluster centroids.
  map.addSource(REPORTS_SOURCE, {
    type: 'geojson',
    data,
    cluster: true,
    clusterRadius: 48,
    clusterMaxZoom: 13
  });
  map.addSource(HEATMAP_SOURCE, { type: 'geojson', data });

  map.addLayer({
    id: HEATMAP_LAYER,
    type: 'heatmap',
    source: HEATMAP_SOURCE,
    layout: { visibility: 'none' },
    paint: {
      'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 7, 16, 14, 44],
      'heatmap-opacity': 0.65,
      'heatmap-color': [
        'interpolate',
        ['linear'],
        ['heatmap-density'],
        0,
        'rgba(42,157,143,0)',
        0.3,
        'rgba(42,157,143,0.35)',
        0.6,
        'rgba(75,33,66,0.5)',
        1,
        'rgba(75,33,66,0.85)'
      ]
    }
  });

  map.addLayer({
    id: CLUSTER_LAYER,
    type: 'circle',
    source: REPORTS_SOURCE,
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': KEPPEL,
      'circle-opacity': 0.85,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
      'circle-radius': ['step', ['get', 'point_count'], 16, 10, 22, 50, 28]
    }
  });

  map.addLayer({
    id: CLUSTER_COUNT_LAYER,
    type: 'symbol',
    source: REPORTS_SOURCE,
    filter: ['has', 'point_count'],
    layout: {
      'text-field': ['get', 'point_count_abbreviated'],
      ...(textFont ? { 'text-font': textFont } : {}),
      'text-size': 12
    },
    paint: { 'text-color': '#ffffff' }
  });

  map.addLayer({
    id: POINT_LAYER,
    type: 'circle',
    source: REPORTS_SOURCE,
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': KEPPEL,
      'circle-stroke-color': '#ffffff',
      'circle-radius': 7,
      'circle-stroke-width': 2
    }
  });

  // Selection is a separate filtered layer rather than feature-state: a
  // clustered GeoJSON source does not carry through string feature ids.
  map.addLayer({
    id: SELECTED_LAYER,
    type: 'circle',
    source: REPORTS_SOURCE,
    filter: NO_SELECTION,
    paint: {
      'circle-color': KEPPEL,
      'circle-radius': 11,
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 4
    }
  });
}

export function setSelectedReport(map: MapLibreMap, id: string | null): void {
  if (!map.getLayer(SELECTED_LAYER)) return;
  const filter: ['==', string, string] = id ? ['==', 'id', id] : NO_SELECTION;
  map.setFilter(SELECTED_LAYER, filter);
}

export function updateReportData(map: MapLibreMap, data: ReportFeatureCollection): void {
  for (const id of [REPORTS_SOURCE, HEATMAP_SOURCE]) {
    const source = map.getSource(id) as GeoJSONSource | undefined;
    source?.setData(data);
  }
}

export function setLayerVisibility(map: MapLibreMap, ids: string[], visible: boolean): void {
  const value = visible ? 'visible' : 'none';
  for (const id of ids) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', value);
  }
}

// --- External observations (ingested from public sources) -------------------

const OBSERVATION_IMAGE_SIZE = 28;

/** Eggplant diamond on a white ring — visually distinct from keppel report dots. */
function observationDiamondImage(): { width: number; height: number; data: Uint8Array } {
  const size = OBSERVATION_IMAGE_SIZE;
  const center = size / 2 - 0.5;
  const data = new Uint8Array(size * size * 4);
  // Manhattan distance in pixel space ≈ 45° rotated square (diamond) test.
  const inner = 9; // filled core radius
  const outer = 12; // outer edge of the white stroke ring
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const distance = Math.abs(x - center) + Math.abs(y - center);
      const offset = (y * size + x) * 4;
      if (distance <= inner) {
        data[offset] = EGGPLANT[0];
        data[offset + 1] = EGGPLANT[1];
        data[offset + 2] = EGGPLANT[2];
        data[offset + 3] = 255;
      } else if (distance <= outer) {
        data[offset] = 0xff; // white ring
        data[offset + 1] = 0xff;
        data[offset + 2] = 0xff;
        data[offset + 3] = 255;
      }
      // else transparent
    }
  }
  return { width: size, height: size, data };
}

/**
 * Adds the observations source + layer. Only rows with real coordinates are
 * ever placed — province-only mentions are kept out of the map entirely rather
 * than fabricating a position.
 */
export function addObservationsLayer(map: MapLibreMap): void {
  if (map.getSource(OBSERVATIONS_SOURCE)) return;
  if (!map.hasImage(OBSERVATION_IMAGE)) {
    map.addImage(OBSERVATION_IMAGE, observationDiamondImage());
  }
  map.addSource(OBSERVATIONS_SOURCE, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] }
  });
  map.addLayer({
    id: OBSERVATIONS_LAYER,
    type: 'symbol',
    source: OBSERVATIONS_SOURCE,
    layout: {
      'icon-image': OBSERVATION_IMAGE,
      'icon-size': 0.85,
      'icon-allow-overlap': false
    }
  });
}

export function updateObservationsData(
  map: MapLibreMap,
  observations: { id: string; latitude: number; longitude: number }[]
): void {
  const source = map.getSource(OBSERVATIONS_SOURCE) as GeoJSONSource | undefined;
  if (!source) return;
  source.setData({
    type: 'FeatureCollection',
    features: observations.map((observation) => ({
      type: 'Feature' as const,
      id: observation.id,
      geometry: {
        type: 'Point' as const,
        coordinates: [observation.longitude, observation.latitude]
      },
      properties: { id: observation.id }
    }))
  });
}

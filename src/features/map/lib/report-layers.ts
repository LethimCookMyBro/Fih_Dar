import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';

import type { Report } from '@/features/reports/api/types';

export const REPORTS_SOURCE = 'fihdar-reports';
export const HEATMAP_SOURCE = 'fihdar-reports-flat';
export const CLUSTER_LAYER = 'fihdar-reports-clusters';
export const CLUSTER_COUNT_LAYER = 'fihdar-reports-cluster-count';
export const POINT_LAYER = 'fihdar-reports-point';
export const HEATMAP_LAYER = 'fihdar-reports-heatmap';
export const SELECTED_LAYER = 'fihdar-reports-selected';

const KEPPEL = '#2A9D8F';
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

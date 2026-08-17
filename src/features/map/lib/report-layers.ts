import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';

import type { Report } from '@/features/reports/api/types';
import type { PriorityArea } from '@/features/priority/api/types';

export const REPORTS_SOURCE = 'fihdar-reports';
export const HEATMAP_SOURCE = 'fihdar-reports-flat';
export const CLUSTER_LAYER = 'fihdar-reports-clusters';
export const CLUSTER_COUNT_LAYER = 'fihdar-reports-cluster-count';
export const POINT_LAYER = 'fihdar-reports-point';
export const HEATMAP_LAYER = 'fihdar-reports-heatmap';
export const SELECTED_LAYER = 'fihdar-reports-selected';
export const OBSERVATIONS_SOURCE = 'fihdar-observations';
export const OBSERVATIONS_LAYER = 'fihdar-observations-point';
export const EVENTS_SOURCE = 'fihdar-events';
export const EVENTS_CLUSTER_LAYER = 'fihdar-events-clusters';
export const EVENTS_CLUSTER_COUNT_LAYER = 'fihdar-events-cluster-count';
export const EVENTS_LAYER = 'fihdar-events-point';
export const EVENTS_SELECTED_LAYER = 'fihdar-events-selected';

export const OBSERVATION_IMAGE = 'fihdar-observation-diamond';
export const EVENT_IMAGE = 'fihdar-event-triangle';

const KEPPEL = '#2A9D8F';
/** Eggplant #4B2142 as raw RGB for the observation diamond image buffer. */
const EGGPLANT = [0x4b, 0x21, 0x42] as const;
/** Matches nothing — the selection layer's resting filter. */
const NO_SELECTION: ['==', string, string] = ['==', 'id', '__no_selection__'];
/** Matches nothing — the event selection layer's resting filter. */
const NO_EVENT_SELECTION: ['==', string, string] = ['==', 'slug', '__no_selection__'];

/** Same three tiers as `scoreTier()` in priority-panel.tsx — destructive red
 * for high priority, amber for medium, neutral for low. Never the brand color
 * as a risk signal. */
const SCORE_HIGH = '#c0392b';
const SCORE_MEDIUM = '#f59e0b';
const SCORE_LOW = '#70797d';

/** Score tiers, used inline as `['step', ['get', prop], SCORE_LOW, 40,
 * SCORE_MEDIUM, 70, SCORE_HIGH]` in each paint property below — TypeScript's
 * MapLibre style-spec types only narrow expression literals when they are
 * inlined directly in the `paint` object, not when built by a helper. */

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

// --- Events (EventCandidates with an exact coordinate, ranked by priority) --

const EVENT_IMAGE_SIZE = 30;

/** Upward triangle silhouette, added as an SDF image so `icon-color` can tint
 * it per-feature by score tier — a shape distinct from both the report circle
 * and the observation diamond. */
function eventTriangleImage(): { width: number; height: number; data: Uint8Array } {
  const size = EVENT_IMAGE_SIZE;
  const margin = 4;
  const apexY = margin;
  const baseY = size - margin;
  const halfBase = size / 2 - margin;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    const t = (y - apexY) / (baseY - apexY);
    const halfWidth = Math.max(0, Math.min(1, t)) * halfBase;
    const left = size / 2 - halfWidth;
    const right = size / 2 + halfWidth;
    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 4;
      const inside = t >= 0 && t <= 1 && x >= left && x <= right;
      if (inside) {
        data[offset] = 0xff;
        data[offset + 1] = 0xff;
        data[offset + 2] = 0xff;
        data[offset + 3] = 255;
      }
    }
  }
  return { width: size, height: size, data };
}

/**
 * Adds the operational-events source + layers: clustered at low zoom (colored
 * by the highest score in the cluster), individual triangles at high zoom
 * (colored by that event's own score tier), plus a larger selected variant.
 * Only EventCandidates with an EXACT coordinate are ever placed here — a
 * PROVINCE/WATERBODY/UNKNOWN-precision event has no honest point to draw.
 */
export function addEventsLayer(map: MapLibreMap): void {
  if (map.getSource(EVENTS_SOURCE)) return;
  if (!map.hasImage(EVENT_IMAGE)) {
    map.addImage(EVENT_IMAGE, eventTriangleImage(), { sdf: true });
  }
  const textFont = styleTextFont(map);

  map.addSource(EVENTS_SOURCE, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
    cluster: true,
    clusterRadius: 40,
    clusterMaxZoom: 12,
    clusterProperties: { maxScore: ['max', ['get', 'score']] }
  });

  map.addLayer({
    id: EVENTS_CLUSTER_LAYER,
    type: 'circle',
    source: EVENTS_SOURCE,
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': ['step', ['get', 'maxScore'], SCORE_LOW, 40, SCORE_MEDIUM, 70, SCORE_HIGH],
      'circle-opacity': 0.9,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
      'circle-radius': ['step', ['get', 'point_count'], 14, 5, 20, 15, 26]
    }
  });

  map.addLayer({
    id: EVENTS_CLUSTER_COUNT_LAYER,
    type: 'symbol',
    source: EVENTS_SOURCE,
    filter: ['has', 'point_count'],
    layout: {
      'text-field': ['get', 'point_count_abbreviated'],
      ...(textFont ? { 'text-font': textFont } : {}),
      'text-size': 11
    },
    paint: { 'text-color': '#ffffff' }
  });

  map.addLayer({
    id: EVENTS_LAYER,
    type: 'symbol',
    source: EVENTS_SOURCE,
    filter: ['!', ['has', 'point_count']],
    layout: { 'icon-image': EVENT_IMAGE, 'icon-size': 0.85, 'icon-allow-overlap': true },
    paint: {
      'icon-color': ['step', ['get', 'score'], SCORE_LOW, 40, SCORE_MEDIUM, 70, SCORE_HIGH],
      'icon-halo-color': '#ffffff',
      'icon-halo-width': 1.5
    }
  });

  // Selection is a separate filtered layer, same reason as SELECTED_LAYER
  // above — a clustered GeoJSON source does not carry feature-state.
  map.addLayer({
    id: EVENTS_SELECTED_LAYER,
    type: 'symbol',
    source: EVENTS_SOURCE,
    filter: NO_EVENT_SELECTION,
    layout: { 'icon-image': EVENT_IMAGE, 'icon-size': 1.25, 'icon-allow-overlap': true },
    paint: {
      'icon-color': ['step', ['get', 'score'], SCORE_LOW, 40, SCORE_MEDIUM, 70, SCORE_HIGH],
      'icon-halo-color': '#ffffff',
      'icon-halo-width': 2.5
    }
  });
}

export function updateEventsData(map: MapLibreMap, areas: PriorityArea[]): void {
  const source = map.getSource(EVENTS_SOURCE) as GeoJSONSource | undefined;
  if (!source) return;
  source.setData({
    type: 'FeatureCollection',
    features: areas
      .filter(
        (area): area is PriorityArea & { coordinate: NonNullable<PriorityArea['coordinate']> } =>
          area.coordinate !== null
      )
      .map((area) => ({
        type: 'Feature' as const,
        id: area.slug,
        geometry: {
          type: 'Point' as const,
          coordinates: [area.coordinate.longitude, area.coordinate.latitude]
        },
        properties: { slug: area.slug, score: area.score }
      }))
  });
}

export function setSelectedEvent(map: MapLibreMap, slug: string | null): void {
  if (!map.getLayer(EVENTS_SELECTED_LAYER)) return;
  const filter: ['==', string, string] = slug ? ['==', 'slug', slug] : NO_EVENT_SELECTION;
  map.setFilter(EVENTS_SELECTED_LAYER, filter);
}

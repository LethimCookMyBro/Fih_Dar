import type { Map as MapLibreMap } from 'maplibre-gl';

export const WATERWAY_LINE_LAYER = 'fihdar-waterway-emphasis';
export const WATER_FILL_LAYER = 'fihdar-water-emphasis';

const KEPPEL = '#2A9D8F';

/**
 * Emphasise the basemap's own hydrography. Nothing is drawn from local data —
 * the source and source-layers are read back out of the loaded style, so this
 * is a no-op on a style that carries no water layers rather than inventing
 * rivers that do not exist.
 */
export function applyWaterwayEmphasis(map: MapLibreMap): void {
  const layers = map.getStyle().layers ?? [];
  const hydro = layers.filter(
    (layer) =>
      'source-layer' in layer &&
      (layer['source-layer'] === 'waterway' || layer['source-layer'] === 'water')
  );
  if (hydro.length === 0) return;

  const sourceOf = (name: 'water' | 'waterway'): string | undefined => {
    const layer = hydro.find((item) => 'source-layer' in item && item['source-layer'] === name);
    return layer && 'source' in layer ? layer.source : undefined;
  };

  // Keep basemap labels above the emphasis fills.
  const firstSymbol = layers.find((layer) => layer.type === 'symbol')?.id;

  const waterSource = sourceOf('water');
  if (waterSource && !map.getLayer(WATER_FILL_LAYER)) {
    map.addLayer(
      {
        id: WATER_FILL_LAYER,
        type: 'fill',
        source: waterSource,
        'source-layer': 'water',
        paint: { 'fill-color': KEPPEL, 'fill-opacity': 0.16 }
      },
      firstSymbol
    );
  }

  const waterwaySource = sourceOf('waterway');
  if (waterwaySource && !map.getLayer(WATERWAY_LINE_LAYER)) {
    map.addLayer(
      {
        id: WATERWAY_LINE_LAYER,
        type: 'line',
        source: waterwaySource,
        'source-layer': 'waterway',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': KEPPEL,
          'line-opacity': 0.55,
          // Rivers read at region zoom, canals and streams only once zoomed in.
          'line-width': ['interpolate', ['linear'], ['zoom'], 7, 0.6, 11, 1.8, 15, 4]
        }
      },
      firstSymbol
    );
  }
}

export function setWaterwayVisibility(map: MapLibreMap, visible: boolean): void {
  const value = visible ? 'visible' : 'none';
  for (const id of [WATERWAY_LINE_LAYER, WATER_FILL_LAYER]) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', value);
  }
}

import type { FilterSpecification, Map as MapLibreMap } from 'maplibre-gl';

import { WATER_FILL_LAYER } from './waterways';

export const MASK_SOURCE = 'fihdar-thailand-mask';

export const OUTSIDE_MASK_LAYER = 'fihdar-outside-thailand';
export const OPEN_SEA_LAYER = 'fihdar-open-sea';
export const OPEN_SEA_TINT_LAYER = 'fihdar-open-sea-tint';
export const BOUNDARY_GLOW_LAYER = 'fihdar-thailand-boundary-glow';
export const BOUNDARY_LINE_LAYER = 'fihdar-thailand-boundary';

/**
 * Beyond Thai jurisdiction: a frosted wash rather than a solid fill. Enough of
 * the basemap survives to keep the neighbours legible as context, while
 * everything inside Thailand stays at full contrast and obviously owns the map.
 */
const OUTSIDE = '#dfe5e4';
const OUTSIDE_OPACITY = 0.85;
const KEPPEL = '#2A9D8F';

/**
 * The mask geometry is derived from OpenStreetMap, the same lineage as the
 * basemap, so ODbL attribution is owed. The basemap already credits OSM, but
 * this source carries it too — the credit must survive someone swapping
 * NEXT_PUBLIC_MAP_STYLE_URL for a non-OSM style.
 */
const ATTRIBUTION = '© OpenStreetMap contributors';

/**
 * The basemap's own ocean fill, found by reading the loaded style rather than
 * by assuming a layer id — FihDar's own water layers are skipped by name. A
 * style with no hydrography simply yields nothing and the sea is left masked.
 */
function basemapOceanFill(map: MapLibreMap) {
  const layers = map.getStyle().layers ?? [];
  return layers.find(
    (layer) =>
      layer.type === 'fill' &&
      'source-layer' in layer &&
      layer['source-layer'] === 'water' &&
      !layer.id.startsWith('fihdar-')
  );
}

/**
 * The basemap's first symbol layer. Everything here is inserted beneath it, so
 * no fill of ours can ever paint over a place name — an opaque layer above the
 * labels clips them mid-word wherever the text overhangs, which on a coastline
 * as long as Thailand's is most coastal towns.
 *
 * The cost is that foreign labels stay legible instead of being frosted. That is
 * the better trade: a faded label still reads as context, a truncated one reads
 * as a broken map.
 */
function firstSymbolLayerId(map: MapLibreMap): string | undefined {
  return (map.getStyle().layers ?? []).find(
    (layer) => layer.type === 'symbol' && !layer.id.startsWith('fihdar-')
  )?.id;
}

/**
 * Wash out everything outside Thailand and its territorial waters, and trace
 * where that jurisdiction ends.
 *
 * The sea is exempt: the mask geometry covers open water too, so the basemap's
 * ocean is redrawn on top of it and the sea reads the same everywhere. Only
 * foreign land (and inland foreign water) sits under the frost. Where Thai
 * waters end is carried by the boundary line, not by a change of fill.
 *
 * The extent is real data in `public/geo/`, produced by `npm run geo:download`
 * from the OSM boundary relation and verified against Marine Regions on every
 * regeneration — see scripts/geo/download-thailand-extent.mjs. Never hand-edit
 * the GeoJSON.
 *
 * Every layer here is inserted beneath the basemap's first symbol layer, so the
 * frost dims foreign ground while place names — Thai and foreign alike — stay
 * whole and on top.
 *
 * Call after the basemap has been trimmed and emphasised, and before the report
 * and event layers are added.
 */
export function applyThailandExtent(map: MapLibreMap): void {
  if (!map.getSource(MASK_SOURCE)) {
    map.addSource(MASK_SOURCE, {
      type: 'geojson',
      data: '/geo/thailand-mask.geojson',
      attribution: ATTRIBUTION
    });
  }

  // Everything below goes beneath the basemap's labels.
  const beforeId = firstSymbolLayerId(map);

  // One polygon: the world, with Thailand and its waters punched out.
  if (!map.getLayer(OUTSIDE_MASK_LAYER)) {
    map.addLayer(
      {
        id: OUTSIDE_MASK_LAYER,
        type: 'fill',
        source: MASK_SOURCE,
        paint: { 'fill-color': OUTSIDE, 'fill-opacity': OUTSIDE_OPACITY }
      },
      beforeId
    );
  }

  // Put the sea back over the frost, emphasis and all, so open water looks
  // identical on both sides of the limit.
  const ocean = basemapOceanFill(map);
  if (ocean && 'source' in ocean && !map.getLayer(OPEN_SEA_LAYER)) {
    const isOcean: FilterSpecification = ['==', ['get', 'class'], 'ocean'];

    map.addLayer(
      {
        id: OPEN_SEA_LAYER,
        type: 'fill',
        source: ocean.source,
        'source-layer': 'water',
        filter: isOcean,
        paint: { 'fill-color': map.getPaintProperty(ocean.id, 'fill-color') as string }
      },
      beforeId
    );

    // Mirror the waterway emphasis rather than restating its colour, so the two
    // cannot drift apart.
    if (map.getLayer(WATER_FILL_LAYER)) {
      map.addLayer(
        {
          id: OPEN_SEA_TINT_LAYER,
          type: 'fill',
          source: ocean.source,
          'source-layer': 'water',
          filter: isOcean,
          paint: {
            'fill-color': map.getPaintProperty(WATER_FILL_LAYER, 'fill-color') as string,
            'fill-opacity': map.getPaintProperty(WATER_FILL_LAYER, 'fill-opacity') as number
          }
        },
        beforeId
      );
    }
  }

  // A soft bloom just outside the edge, so the boundary reads as a considered
  // limit rather than as the seam where one fill stops.
  if (!map.getLayer(BOUNDARY_GLOW_LAYER)) {
    map.addLayer(
      {
        id: BOUNDARY_GLOW_LAYER,
        type: 'line',
        source: MASK_SOURCE,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': KEPPEL,
          'line-opacity': 0.18,
          'line-blur': ['interpolate', ['linear'], ['zoom'], 5, 2, 10, 5, 14, 9],
          'line-width': ['interpolate', ['linear'], ['zoom'], 5, 3, 10, 7, 14, 13]
        }
      },
      beforeId
    );
  }

  // The same polygon as a line traces every hole — the land borders and the
  // seaward limit — in one pass. Over water this is the only thing marking
  // where Thai jurisdiction ends, so it is drawn last, above the restored sea.
  if (!map.getLayer(BOUNDARY_LINE_LAYER)) {
    map.addLayer(
      {
        id: BOUNDARY_LINE_LAYER,
        type: 'line',
        source: MASK_SOURCE,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': KEPPEL,
          'line-opacity': 0.85,
          'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.9, 9, 1.3, 14, 1.8]
        }
      },
      beforeId
    );
  }
}

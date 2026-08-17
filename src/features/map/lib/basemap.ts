import type { Map as MapLibreMap } from 'maplibre-gl';

/**
 * Source-layers a waterway surveillance map keeps: hydrography, roads, and the
 * labels needed to say where you are. Everything else the general-purpose
 * basemap ships — landcover, landuse, parks, buildings, POIs, airports, and the
 * shaded-relief raster — is dropped, because none of it carries surveillance
 * meaning and all of it competes with the report/event layers drawn on top.
 *
 * Names are matched against the loaded style rather than assumed: a style that
 * carries none of these simply keeps fewer layers instead of erroring.
 */
const KEPT_SOURCE_LAYERS = new Set([
  // แม่น้ำ คลอง ลำธาร
  'waterway',
  // ทะเล ทะเลสาบ อ่างเก็บน้ำ บ่อ
  'water',
  // ชื่อแหล่งน้ำ
  'water_name',
  // ถนน
  'transportation',
  // ชื่อถนน / ป้ายหมายเลขทางหลวง
  'transportation_name',
  // ชื่อจังหวัด อำเภอ ตำบล
  'place',
  // เส้นแบ่งเขตการปกครอง — kept because the map filters by province, and
  // without them that filter has nothing to read against.
  'boundary'
]);

/**
 * Rail shares the `transportation` source-layer with roads. The brief is roads
 * only, so it is matched by layer id — read off the loaded style, never
 * invented — and dropped. A style whose ids do not spell "rail" keeps them.
 */
const RAIL_LAYER_ID = /rail/i;

/** Neutral land tone. The stock warm beige assumes landcover that is now gone. */
const LAND = '#edf0ef';

/**
 * Strip the basemap down to hydrography, roads, and labels.
 *
 * Call before {@link applyWaterwayEmphasis} so the emphasis layers are inserted
 * against the trimmed layer order.
 */
export function applyMinimalBasemap(map: MapLibreMap): void {
  const layers = map.getStyle().layers ?? [];

  for (const layer of layers) {
    if (layer.type === 'background') {
      map.setPaintProperty(layer.id, 'background-color', LAND);
      continue;
    }

    // Rasters (shaded relief, satellite) carry no source-layer at all — a
    // terrain image is exactly what this map is not.
    const sourceLayer = 'source-layer' in layer ? layer['source-layer'] : undefined;
    if (sourceLayer === undefined || !KEPT_SOURCE_LAYERS.has(sourceLayer)) {
      map.removeLayer(layer.id);
      continue;
    }

    if (sourceLayer === 'transportation' && RAIL_LAYER_ID.test(layer.id)) {
      map.removeLayer(layer.id);
    }
  }
}

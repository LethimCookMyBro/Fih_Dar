/**
 * OpenFreeMap Liberty — an OpenStreetMap-derived vector basemap on the
 * OpenMapTiles schema, served without an API key. Attribution ships inside the
 * style and is rendered by MapLibre's AttributionControl.
 */
export const MAP_STYLE_URL =
  process.env.NEXT_PUBLIC_MAP_STYLE_URL || 'https://tiles.openfreemap.org/styles/liberty';

/** Eastern Thailand / EEC — the initial surveillance area. */
export const INITIAL_VIEW = { center: [101.1, 13.15] as [number, number], zoom: 8 };

export interface QuickPlace {
  name: string;
  center: [number, number];
  zoom: number;
}

/**
 * Curated EEC waypoints, not a geocoder. There is no external geocoding
 * service wired up, so the search control only navigates to these.
 */
export const QUICK_PLACES: QuickPlace[] = [
  { name: 'ฉะเชิงเทรา', center: [101.0779, 13.6904], zoom: 10 },
  { name: 'ชลบุรี', center: [100.9847, 13.3611], zoom: 10 },
  { name: 'ระยอง', center: [101.2539, 12.6814], zoom: 10 },
  { name: 'บางปะกง', center: [100.9833, 13.5333], zoom: 11 },
  { name: 'ภาพรวมภาคตะวันออก', center: INITIAL_VIEW.center, zoom: INITIAL_VIEW.zoom }
];

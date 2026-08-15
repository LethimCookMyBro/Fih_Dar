/** Public path the worker modules are copied to by scripts/copy-maplibre-worker.mjs. */
const WORKER_URL = '/maplibre/maplibre-gl-worker.mjs';

let loader: Promise<typeof import('maplibre-gl')> | undefined;

/**
 * Single entry point for pulling in maplibre-gl. It touches `window` at import
 * time, so it can only be loaded in the browser, and its worker URL has to be
 * set once before the first Map is constructed.
 */
export function loadMapLibre(): Promise<typeof import('maplibre-gl')> {
  loader ??= import('maplibre-gl').then((maplibre) => {
    maplibre.setWorkerUrl(WORKER_URL);
    return maplibre;
  });
  return loader;
}

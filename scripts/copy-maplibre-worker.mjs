// maplibre-gl v6 resolves its worker from `import.meta.url`, which under a
// bundler points at /_next/static/chunks/… where the worker file does not
// exist. Copying the two worker modules into /public lets `setWorkerUrl()`
// point at a real, correctly-typed URL. Runs on postinstall so the copy always
// matches the installed maplibre version.
import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'node_modules', 'maplibre-gl', 'dist');
const target = join(root, 'public', 'maplibre');

const FILES = ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs'];

await mkdir(target, { recursive: true });
for (const file of FILES) {
  await copyFile(join(source, file), join(target, file));
}
console.log(`copied ${FILES.length} maplibre worker modules to public/maplibre`);

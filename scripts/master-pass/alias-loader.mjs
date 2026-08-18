// Node ESM loader hook used ONLY by scripts/master-pass/officer-workflow.test.mjs
// to run the real server/*.ts modules (unmodified) directly under Node for local
// verification. Resolves the project's `@/*` -> `src/*` tsconfig path alias,
// which Node has no native knowledge of. Not part of the app runtime.
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const SRC_DIR = path.resolve(fileURLToPath(import.meta.url), '../../../src');

const CLERK_STUB = pathToFileURL(path.join(SRC_DIR, '../scripts/master-pass/clerk-stub.mjs')).href;

export async function resolve(specifier, context, nextResolve) {
  // Test double for the Clerk SDK boundary (see clerk-stub.mjs) — plain Node
  // cannot resolve @clerk/nextjs/server's own bundler-oriented internals, and
  // the test never calls through it (always passes an explicit context).
  if (specifier === '@clerk/nextjs/server') {
    return nextResolve(CLERK_STUB, context);
  }
  if (specifier.startsWith('@/')) {
    let target = path.join(SRC_DIR, specifier.slice(2));
    if (!path.extname(target)) target += '.ts';
    return nextResolve(pathToFileURL(target).href, context);
  }
  // Extensionless relative TS imports (e.g. `./auth`) — this Node/flag
  // combination does not auto-resolve those the way it does for the entry
  // file, so guess `.ts` ourselves before falling through to the default.
  // Only inside this project's own source (never node_modules, which is
  // plain resolvable JS and must not have `.ts` guessed onto it).
  const inProjectSource = context.parentURL && !context.parentURL.includes('node_modules');
  if (
    inProjectSource &&
    (specifier.startsWith('./') || specifier.startsWith('../')) &&
    !path.extname(specifier)
  ) {
    return nextResolve(`${specifier}.ts`, context);
  }
  return nextResolve(specifier, context);
}

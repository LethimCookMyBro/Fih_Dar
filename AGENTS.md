# AGENTS.md — FihDar

Reference for AI coding agents. Complements [CLAUDE.md](./CLAUDE.md) (critical
conventions + repository hygiene) and [README.md](./README.md), which covers setup,
deployment, and the security model in more depth.

---

## What this is

**FihDar** (Fish + Radar) is a Thai-language citizen-reporting and GIS surveillance app for
suspected Blackchin Tilapia sightings in Eastern Thailand (ฉะเชิงเทรา, ชลบุรี, ระยอง). Beyond
citizen reports, it also runs an automated six-source external-intelligence pipeline
(news RSS, open government data, iNaturalist) — see [docs/INGESTION.md](./docs/INGESTION.md)
and the `/sources` observatory.

It was scaffolded from `Kiranism/next-shadcn-dashboard-starter`. The starter's demo
surface (dashboard, products, users, kanban, chat, AI chat, overview, forms demo, mock
APIs, RBAC nav) has been removed. The shadcn/Base UI primitives in `src/components/ui`
are the starter's and should be reused, not rebuilt. Some starter dependencies
(`@dnd-kit/*`, `@tanstack/react-table`, `react-day-picker`, etc.) remain because
individual scaffolded components (kanban, tables, calendar) are still present in
`src/components/ui`; periodically re-verify with a repo-wide import search before
assuming a dependency is dead weight — see CLAUDE.md's Repository Hygiene section.

**Non-negotiable:** no mock data, seeded reports, or hardcoded counts in runtime code. An
empty database must render an empty UI.

---

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript 5.7 (strict) · Tailwind CSS 4 ·
shadcn/ui on Base UI · TanStack Query · TanStack Form · Zod 4 · Motion · Tabler Icons ·
Clerk 7 · Prisma 6 + PostgreSQL · MapLibre GL JS 6 · Railway.

---

## Structure

```
prisma/                    schema + checked-in migrations
public/maplibre/           worker modules copied by postinstall (committed — they must ship in the Docker build context, see Dockerfile)
scripts/
  copy-maplibre-worker.mjs
  ingestion/                registry.mjs (source of truth, allowlisted fetch), adapters/{rss,ckan,json-api}, self-test.mjs
  intel/                    relevance/species gate, locations.mjs, dedupe, priority.mjs, self-test.mjs
  refresh-intelligence.mjs  orchestrated entry point (db:refresh / db:refresh:prod) — ingest → intel → event resolution
src/
  app/
    (app)/                 shell layout + /map /sources /report /about /profile
    api/
      reports|profile/     route handlers (thin — logic lives in src/server)
      sources/              summary, list, [slug], runs, trace
      events/priority/      experimental priority ranking
      observations/public/  map's external-source layer
    auth/                  Clerk sign-in / sign-up
  components/
    layout/                fihdar-sidebar, fihdar-header, page-container
    ui/                    shadcn primitives — do not rewrite
    forms/fields/          TanStack Form field components
  config/nav-config.ts
  features/
    map/                   constants, lib/{waterways,report-layers,load-maplibre}, components
    reports/               api/{types,service,queries}, components, lib/format
    sources/               data-source observatory, intelligence journey, signal trace, signal flow
    priority/               priority panel (map)
    observations/           external-observation query options (map layer)
    profile/components/
  server/                  auth, storage, report-service, profile-service, sources-service,
                            observation-service, source-registry, validation, responses
  styles/themes/fihdar.css
  proxy.ts                 clerkMiddleware only — no route matching
```

---

## Conventions

- **Server boundary.** Everything under `src/server` and `src/lib/prisma.ts` starts with
  `import 'server-only'`. React components never touch Prisma or the filesystem.
- **Route handlers stay thin** — parse, delegate to a service, map errors through
  `errorResponse` from `src/server/responses.ts`. Never leak a stack trace.
- **Auth is per resource.** Pages call `requireAuthOrRedirect()`; handlers call
  `requireCurrentClerkUser()`. `proxy.ts` only attaches the session — do not reintroduce
  `createRouteMatcher` (deprecated in Clerk 7).
- **Never trust client ownership.** No endpoint accepts `reporterId` or `clerkUserId`;
  supplying either is a validation error.
- **Data fetching** — TanStack Query, key factories in `features/reports/api/queries.ts`.
  Components import from `api/service.ts` and `api/queries.ts`, never `fetch` directly.
- **Forms** — `useAppForm` from `@/lib/form` with `form.AppField`; drop to raw `form.Field`
  for one-off custom fields (image upload, map location picker). Zod `onSubmit` validators.
- **Icons** — only from `@/components/icons`, never `@tabler/icons-react` directly.
- **Page headers** — `PageContainer` props (`pageTitle`, `pageDescription`), never a manual
  `<Heading>`. `/map` skips `PageContainer` because the map owns the viewport.
- **Language** — Thai is the UI language. Comments and identifiers stay English.
- **Formatting** — single quotes, JSX single quotes, no trailing comma, 2-space indent
  (`npm run format`).
- **Source health ≠ signal yield.** A source's technical status (fetch/parse/upsert
  succeeded) and whether it has ever produced a *relevant* signal are different facts —
  never collapse them into one label. See `signalCaption()` in
  `src/features/sources/lib/format.ts` and [docs/INGESTION.md](./docs/INGESTION.md).

---

## Map specifics

- `loadMapLibre()` in `features/map/lib/load-maplibre.ts` is the **only** place maplibre-gl
  is imported at runtime. It sets the worker URL — importing maplibre directly will break
  tile loading under Turbopack.
- `applyWaterwayEmphasis()` reads the **loaded style** back and re-styles the basemap's own
  `water` / `waterway` source-layers. Never author river geometry, and never hardcode a
  source or source-layer name that has not been read from the style.
- `applyMinimalBasemap()` (`lib/basemap.ts`) strips the world basemap to an allowlist of
  source-layers — hydrography, roads, labels, boundaries — and drops the shaded-relief
  raster, landcover, landuse, buildings, POIs, and rail. It matches names against the
  loaded style, so an unfamiliar style degrades to keeping fewer layers, never to an error.
- `applyThailandExtent()` (`lib/thailand-extent.ts`) washes out everything outside
  Thailand and its territorial waters (a frosted overlay, not a solid fill — the
  neighbours stay legible as context) and traces the limit. The geometry is **real data**
  in `public/geo/`, produced by `npm run geo:download` — never edit those files by hand;
  re-run the script. Map order matters — trim → emphasise water → recede roads → extent →
  report/event layers — so the mask covers the basemap (including its labels) but never
  the FihDar data on top.
- **The sea is deliberately not masked.** The mask polygon does cover open water, so
  `applyThailandExtent()` redraws the basemap's `class=ocean` fill (plus a mirror of the
  waterway emphasis) back on top of it, and draws the boundary line last. Only foreign land
  is frosted; over water the boundary line is the sole marker of the limit. Both restored
  layers read their source and paint off the loaded style — do not hardcode a water colour.
- The extent comes from the **OSM boundary relation**, not a generalised world dataset —
  same lineage as the basemap, so the edge lands within ~6 m (sub-pixel below zoom 15) of
  the border the basemap draws. Swapping in Natural Earth or similar reintroduces a visible
  seam. That relation already encloses the territorial sea; the coastline is *inside* the
  extent, so a coastline-only source would grey out Thai waters — `geo:download` verifies
  this against Marine Regions on every run and fails rather than shipping a wrong mask.
- The extent stops at the **12 NM territorial sea**. Do not "upgrade" it to the 200 NM EEZ:
  the Gulf of Thailand EEZ includes unresolved overlapping claims, and a single confident
  line would assert a boundary that is not settled.
- Report layers are GeoJSON-driven. Selection uses a filtered layer, not `feature-state`
  (a clustered GeoJSON source does not carry string feature ids through).
- The heatmap is *report density*, never "outbreak area".

---

## Verification

```bash
npm run typecheck && npm run lint && npm run build
```

All three must pass. A green build is not enough on its own — the Clerk 7 and MapLibre
worker regressions both compiled cleanly and only surfaced at runtime, so exercise the
page in a browser before claiming a UI change works.

If a change touches ingestion or the intelligence pipeline, also run:

```bash
npm run ingest:test && npm run intel:test
```

Both are deterministic, no-network self-tests (see `scripts/ingestion/self-test.mjs`,
`scripts/intel/self-test.mjs`) — they must pass before any dedupe/relevance/location/
event-grouping change is considered done.

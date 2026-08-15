# AGENTS.md — FihDar

Reference for AI coding agents. Complements [README.md](./README.md), which covers setup,
deployment, and the security model in more depth.

---

## What this is

**FihDar** (Fish + Radar) is a Thai-language citizen-reporting and GIS surveillance app for
suspected Blackchin Tilapia sightings in Eastern Thailand (ฉะเชิงเทรา, ชลบุรี, ระยอง).

It was scaffolded from `Kiranism/next-shadcn-dashboard-starter`. The starter's demo
surface (dashboard, products, users, kanban, chat, AI chat, overview, forms demo, mock
APIs, RBAC nav) has been removed. The shadcn/Base UI primitives in `src/components/ui`
are the starter's and should be reused, not rebuilt.

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
prisma/                    schema + checked-in migration
public/maplibre/           worker modules copied by postinstall (committed — they must ship in the Docker build context, see Dockerfile)
scripts/copy-maplibre-worker.mjs
src/
  app/
    (app)/                 shell layout + /map /report /about /profile
    api/reports|profile/   route handlers (thin — logic lives in src/server)
    auth/                  Clerk sign-in / sign-up
  components/
    layout/                fihdar-sidebar, fihdar-header, page-container
    ui/                    shadcn primitives — do not rewrite
    forms/fields/          TanStack Form field components
  config/nav-config.ts
  features/
    map/                   constants, lib/{waterways,report-layers,load-maplibre}, components
    reports/               api/{types,service,queries}, components, lib/format
    profile/components/
  server/                  auth, storage, report-service, profile-service, validation, responses
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

---

## Map specifics

- `loadMapLibre()` in `features/map/lib/load-maplibre.ts` is the **only** place maplibre-gl
  is imported at runtime. It sets the worker URL — importing maplibre directly will break
  tile loading under Turbopack.
- `applyWaterwayEmphasis()` reads the **loaded style** back and re-styles the basemap's own
  `water` / `waterway` source-layers. Never author river geometry, and never hardcode a
  source or source-layer name that has not been read from the style.
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

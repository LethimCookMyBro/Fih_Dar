# Third-Party Notices

FihDar is built on [Kiranism/next-shadcn-dashboard-starter](https://github.com/Kiranism/next-shadcn-dashboard-starter),
MIT licensed. The starter's copyright notice is preserved as-is in
[`LICENSE`](./LICENSE) (Copyright (c) 2023 Kiranism) — this project's own
code is distributed under the same terms and does not replace that notice.

This file lists the notable open-source software, data, and services this
project depends on or ingests from. It is not an exhaustive transitive
dependency audit (see `package.json` / `package-lock.json` for the full
tree) — it covers what a reviewer needs to understand what's actually being
used and under what terms.

## Framework / UI

- **Next.js**, **React**, **React DOM** — Vercel / Meta, MIT
- **shadcn/ui**, **@base-ui/react** — MIT (component patterns copied into
  `src/components/ui`, not installed as an opaque package — this is the
  shadcn distribution model)
- **Tailwind CSS**, `tailwind-merge`, `tailwindcss-animate`, `class-variance-authority` — MIT
- **@tabler/icons-react** — MIT
- **Motion** (`motion`) — MIT
- **Radix-derived primitives via Base UI**, `cmdk`, `sonner`, `embla-carousel-react`, `react-resizable-panels`, `react-day-picker`, `input-otp` — MIT

## Data / forms / state

- **@tanstack/react-query**, **@tanstack/react-form**, **@tanstack/react-table** — MIT
- **Zod** — MIT
- **Prisma**, **@prisma/client** — Apache-2.0
- **nuqs**, **date-fns**, `uuid` — MIT

## Map

- **MapLibre GL JS** — BSD-3-Clause
- **Basemap tiles and styles: [OpenFreeMap](https://openfreemap.org/)** (built
  on **OpenMapTiles**), data **© OpenStreetMap contributors** (ODbL). Attribution
  is rendered live on every map view via MapLibre's `AttributionControl` — see
  `src/features/map/components/map-view.tsx`. Do not remove it.
- **National extent: OpenStreetMap relation 2067731** (ประเทศไทย,
  `admin_level=2`), fetched via Overpass — **ODbL, © OpenStreetMap
  contributors**, attribution and share-alike required. `public/geo/` is a
  derived database under that licence. The credit is attached to the GeoJSON
  source in `src/features/map/lib/thailand-extent.ts` so `AttributionControl`
  renders it even if the basemap style is swapped for a non-OSM one. Do not
  remove it. OSM is used rather than a generalised world dataset precisely
  because the basemap is OSM-derived: the mask edge measures within ~6 m of the
  border the basemap draws, which is sub-pixel below zoom 15.
- **[Marine Regions](https://www.marineregions.org/)** (VLIZ) — CC BY 4.0.
  **Used to verify, never redistributed:** `npm run geo:download` checks on every
  run that Thailand's internal waters and 12 NM territorial sea still fall inside
  the OSM extent (currently 99.4%) and refuses to write a mask that would grey
  out Thai waters. No Marine Regions geometry ships in this repository.
- Regenerate with `npm run geo:download`
  (`scripts/geo/download-thailand-extent.mjs`), which records source, licence,
  simplification, and the verification result in
  `data/thailand-extent.provenance.json`. The 200 NM EEZ is deliberately **not**
  shown — in the Gulf of Thailand it covers the unresolved Thailand–Cambodia
  overlapping claims area and the Thailand–Malaysia joint development area, and
  drawing it as one line would assert a settled boundary that does not exist.
- **polygon-clipping** — MIT. Build-time only (the download script); used for the
  boundary/territorial-sea verification.

## Intelligence pipeline (`scripts/intel/**`)

- **@huggingface/transformers** (Transformers.js) — Apache-2.0. Runs the
  **`Xenova/multilingual-e5-small`** ONNX export of
  **`intfloat/multilingual-e5-small`** locally (no network calls at
  inference time) for semantic similarity — MIT-licensed model weights,
  cached under `.data/intel/models` (gitignored).
- **`thai-address-database`** — Thai province/amphoe reference data (MIT),
  used only for deterministic text matching; no coordinates are derived from it.
- **`fuzzball`** — fuzzy string matching (RapidFuzz-style), MIT.
- **`minhash`** — MinHash/LSH near-duplicate detection, MIT.
- **`graphology`**, **`graphology-shortest-path`** — MIT.
- External observations themselves (news articles, official notices) are
  ingested for classification/analysis under fair-use/reporting norms as
  factual, publicly published information; FihDar stores title, description,
  source URL, and attribution (`sourceName`) — never full article bodies
  beyond what a public feed/description already provides — and always links
  back to the original source.

## Infrastructure

- **Clerk** (`@clerk/nextjs`, `@clerk/localizations`) — commercial auth
  service, used under Clerk's terms of service; no Clerk source code is
  vendored.
- **Sentry** (`@sentry/nextjs`) — error monitoring, used under Sentry's terms.
- **Railway** — hosting platform, used under Railway's terms.
- **sharp** — image processing, Apache-2.0.

## Fonts

Fonts are served through the map style's own glyph endpoint (OpenFreeMap) and
via standard Next.js font loading — no font files are vendored in this
repository beyond what those services provide.

---

If you believe an attribution is missing or incorrect, open an issue —
licenses above were read from each package's own `package.json`/`LICENSE`
file at time of writing and may need updates as dependencies change.

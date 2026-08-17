# KenBranchZa007 — Selective-port ledger (2026-08-18)

Branch: `origin/KenBranchZa007` @ `be8fbfc4a134219cf3144fd77a1c4160d82f07a8`
Merge-base with main: `d410df2` (stale — main is 4 commits ahead with multi-province
filtering, operational events, observations, priority, waterway emphasis, road recession,
2km monitoring). **Not merged wholesale. Only the concepts below are ported, adapted to
current main.**

## Ledger

| FILE | KEN CHANGE | VALUABLE? | CONFLICT WITH CURRENT MAIN? | PORT METHOD | RESULT |
|---|---|---|---|---|---|
| `src/features/map/lib/basemap.ts` (new) | `applyMinimalBasemap()` — strip world basemap to allowlist (hydrography, roads, labels, boundaries); drop relief raster, landcover, landuse, buildings, POIs, rail; neutral land tone | YES — main only *fades* roads/POIs (opacity), it never removes the noise layers; removal is the intended "removal/recession of distracting POIs/buildings/landuse" | No file conflict (file doesn't exist in main). Ordering: must run first in load | Port file as-is; wire first in `map-view.tsx` + `location-picker.tsx` load | PORT |
| `src/features/map/lib/thailand-extent.ts` (new) | `applyThailandExtent()` — frosted wash outside Thai jurisdiction, restored open sea, Keppel boundary glow + line; reads style, never invents layers | YES — "dim/frost foreign land outside Thai jurisdiction" is an explicit handoff target; main has nothing like it | No file conflict. Must run after `applyWaterwayEmphasis` (mirrors `WATER_FILL_LAYER` for the sea tint) | Port file as-is; wire after waterway emphasis | PORT |
| `public/geo/thailand-mask.geojson` (new) | Real mask geometry (OSM relation 2067731, 12 NM territorial sea) | YES — real data, provenance-backed | None | Copy as-is; never hand-edit | PORT |
| `data/thailand-extent.provenance.json` (new) | Provenance: source, licence, simplification, Marine Regions verification (99.38%), explicit EEZ exclusion | YES — provenance requirement; EEZ exclusion is exactly the handoff's jurisdiction caution | None | Copy as-is | PORT |
| `scripts/geo/download-thailand-extent.mjs` (new) | Regeneration script with independent Marine Regions verification + EEZ guard | YES — provenance tooling | None | Copy as-is | PORT |
| `package.json` + lock | `polygon-clipping` devDep + `geo:download` script | YES — needed to regenerate | Additive; run `npm install` to sync lock | Port | PORT |
| `src/features/map/constants.ts` | `THAILAND_BOUNDS` + `MIN_ZOOM` viewport constraints | YES — "Thailand viewport constraints" | Additive (main constants lack them) | Port additions only | PORT |
| `src/features/map/components/map-view.tsx` | `minZoom`/`maxBounds` on Map init + `applyMinimalBasemap` + `applyThailandExtent` in load | YES — the wiring | **DO NOT copy file** — main's file is far newer (filters/events/observations/monitoring). Surgical edit of the load handler only | Manual | PORT (surgical) |
| `src/features/map/components/location-picker.tsx` | Same wiring in the report-form picker | YES — picker should match the map | Surgical edit only | Manual | PORT (surgical) |
| `THIRD_PARTY_NOTICES.md` | OSM relation + Marine Regions + polygon-clipping notices | YES — licence attribution | Additive; adapt to main's current file | Port sections | PORT |
| `README.md` | Basemap trimming + Thailand confinement docs | YES | Additive; main README already has waterway/road sections | Port sections | PORT |
| `AGENTS.md` | `applyMinimalBasemap`/`applyThailandExtent` conventions | YES — agent docs | Additive | Port sections | PORT |
| `package-lock.json` | polygon-clipping lock entry | (with package.json) | Regenerate via npm install | PORT | PORT |

## Explicitly NOT ported / REJECTED

- **No wholesale `map-view.tsx` / `location-picker.tsx` replacement** — would destroy main's
  multi-province filtering, event layers, observations, monitoring circles, and legend.
- **No 200 NM EEZ.** The 12 NM territorial-sea extent is kept exactly as Ken documented it:
  the EEZ in the Gulf of Thailand includes unresolved Thailand–Cambodia overlapping claims
  and the Thailand–Malaysia joint development area; a single line would assert an unsettled
  boundary. The mask/provenance/AGENTS notes all say this; do not "upgrade".
- **No basemap style swap** — main keeps OpenFreeMap Liberty (`NEXT_PUBLIC_MAP_STYLE_URL`),
  which is what both `basemap.ts` and `thailand-extent.ts` are written against.

## Validation performed

- Provenance JSON read in full: source (OSM relation 2067731 via Overpass), licence (ODbL),
  simplification (Douglas-Peucker 6 m), verification (Marine Regions sea coverage 99.38%),
  EEZ explicitly excluded with reasoning. GeoJSON parsed: 1 Polygon feature, ~849 KB (fits a
  static asset served from `/geo/`; acceptable, and regenerable at higher tolerance if the
  payload ever matters).
- `applyMinimalBasemap` / `applyThailandExtent` source read in full: both read layer
  names/ids back out of the loaded style (never hardcode a source/source-layer that wasn't
  read), matching AGENTS.md's map conventions. Attribution is attached to the mask source.
- No merge of the branch itself; nothing stale overwrites main.

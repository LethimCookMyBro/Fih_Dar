# FihDar — Autonomous Progress Ledger

> Maintained by the overnight autonomous master pass (session `buffy-fihdar-master-pass`).
> The next agent must be able to resume using Git + this file alone.
> Repo: `C:\Users\User\Downloads\FihDar` (origin `https://github.com/LethimCookMyBro/Fih_Dar.git`).

---

## Checkpoint 1 — Phase 1: Multi-province integration (COMPLETE)

- **TIME:** 2026-08-18 ~01:00 (+07)
- **PHASE:** 1 — Close multi-province properly
- **PATH:** `C:\Users\User\Downloads\FihDar`
- **BRANCH:** `main`
- **STARTING_HEAD:** `54ad29e` (main)
- **CURRENT_HEAD:** `57a3b8c` (main, after ff-merge)
- **COMMITS_CREATED:** 0 new (4 existing worktree commits fast-forwarded onto main: `f76e4e3` docs, `8b4d56e` feat, `870414a` test, `57a3b8c` test)
- **FILES_CHANGED (integrated):**
  - `docs/superpowers/plans/2026-08-17-multi-province-filter.md` (plan doc, +559)
  - `e2e/map.spec.ts` (+143/-31ish)
  - `src/features/map/components/map-controls.tsx` (+207/-73ish)
  - `src/features/map/components/map-view.tsx` (1-line filter state)
  - `src/features/map/lib/filters.ts` (provinces: string[] + membership check)
- **WHAT_WAS_IMPLEMENTED:**
  - Multi-province map filter: `MapFilters.province: string` → `provinces: string[]` (`[]` = all).
  - `matchesMapFilters()` (single chokepoint) now array-membership; every dataset (reports, events, observations, priority panel) filters through it unchanged.
  - Desktop: base-ui `Combobox` multi-select with search + select-all/clear.
  - Mobile: `ProvinceChecklist` (search Input + 44px Checkbox/Label rows) inside the filter Sheet, two independent scroll regions.
  - `provinceOptions` computed live from `REPORT_PROVINCES` + real reports/events/observations — nationwide, not EEC-only.
  - E2E tests assert **exact** counts against real API ground truth (`/api/reports/public`, `/api/events/priority`), fetched via Playwright `request` fixture, not relational before/after comparisons.
- **ROOT_CAUSES_FOUND:** N/A (no new bug fixed; integration of reviewed work).
- **TESTS_RUN (fresh, on main after merge):**
  - `npm run typecheck` — PASS (exit 0)
  - `npm run lint` — PASS (0 errors, 70 warnings; none in map feature files or e2e)
  - `npx playwright test e2e/map.spec.ts -g "province filter" --workers=1` — **18 passed, 0 failed** (1.1m)
- **EXACT_RESULTS:** see above; all three province-filter tests green on all 6 viewport projects.
- **VISUAL_VERIFICATION:** N/A this phase (no UI change authored here; worktree task-1 report already documented manual smoke checks of both surfaces).
- **KNOWN_ISSUES:** None for this phase. Full-suite flakiness (Clerk mount timing, `waitForMapReady` under parallel load) is pre-existing and documented in the worktree task reports; will be re-verified once in Phase 8.
- **UNVERIFIED_ITEMS:** Full 204-test Playwright suite (deferred to Phase 8 by design).
- **NEXT_PHASE:** Phase 2 — Team card performance + redesign.
- **DO_NOT_REDO:** Do NOT refactor the multi-province implementation (reviewed clean). Do NOT rerun the full e2e suite until Phase 8. The `public/maplibre/*.mjs` files show stat-dirty in the worktree only (CRLF noise, identical blobs) — do not commit them.

### Worktree notes
- Worktree `C:\Users\User\Downloads\FihDar\.claude\worktrees\multi-province-filter` (branch `worktree-multi-province-filter`, HEAD `57a3b8c`) remains in place as a local artifact; its branch is now fully contained in main. Do not merge it again. Its `.superpowers/sdd/2026-08-17-multi-province-filter/` holds the SDD ledger + task reports (untracked tooling).
- Main's untracked copy of the plan file was byte-identical to the committed blob (sha1 verified) before removal; the merge restored it as a tracked file (CRLF-normalized on checkout — content verified identical).
- Untracked leftovers in main: `.claude/scheduled_tasks.lock`, `.claude/worktrees/`, `skills/` — agent tooling, intentionally not committed.

---

## Checkpoint 2 — Phase 2: Team card performance + redesign (COMPLETE)

- **TIME:** 2026-08-18 ~01:25 (+07)
- **PHASE:** 2 — Team card performance + redesign
- **BRANCH:** `main`
- **STARTING_HEAD:** `4732aab`
- **CURRENT_HEAD:** `5dd9e2f`
- **COMMITS_CREATED:** `5dd9e2f perf(about): replace holo-tilt team card with a CSS-first FihDar card`
- **FILES_CHANGED:** `src/components/reactbits/profile-card.tsx` (695-line vendored demo → 184-line CSS-first card), `src/features/about/components/about-team.tsx` (dropped dead demo props), `e2e/about.spec.ts` (updated touch-action locator; new idle-RAF + reduced-motion regression guards), `docs/superpowers/specs/2026-08-18-team-card-redesign.md` (GATE A design spec)
- **WHAT_WAS_IMPLEMENTED:**
  - Killed the perpetual RAF loop (`if (stillFar || document.hasFocus()) requestAnimationFrame(step)` — was running ~793 rAF/s idle across 4 cards), the infinite `pc-holo-bg 18s linear infinite` color-dodge sweep, the 50px blur glow, glare, and 3D tilt.
  - New card: CSS-first pointer spotlight (CSS vars, transitions, settles then stops), gentle border response, subtle hover lift, restrained Keppel/Eggplant accents — serious/geospatial, no trading-card look. `prefers-reduced-motion` respected (spotlight + lift suppressed).
- **ROOT_CAUSES_FOUND:** Perpetual rAF loop scheduled on `document.hasFocus()` with no settle-stop; infinite CSS animation with `mix-blend-mode: color-dodge`; 4 cards × 7+ `setProperty` writes/frame.
- **TESTS_RUN (fresh):** `npm run typecheck` PASS; `npm run lint` 0 errors; `npx oxfmt --check` PASS; `npx playwright test e2e/about.spec.ts` — **24/24 PASS** (6 viewports × 4 tests incl. new regression guards).
- **EXACT_PERFORMANCE_EVIDENCE:** BEFORE: 2378 rAF callbacks / 3s idle (~793/s) + 4 running `pc-holo-bg` animations. AFTER: **0 running animations, 0 rAF settled** (residual bursts attributed to dev-server/HMR noise — 0 in clean runs).
- **VISUAL_VERIFICATION:** 1440×900 / 768×1024 / 390×844 — uniform 360px-tall cards, no overflow, no text clipping on long Thai names, 4 visible at all viewports, grid columns exactly filled (250px cols at 1440; old 301px cards overflowed their columns — contributed to the "visually strange" look). Reduced motion: spotlight opacity stays 0, transform stays `none`.
- **KNOWN_ISSUES:** None.
- **UNVERIFIED_ITEMS:** N/A.
- **NEXT_PHASE:** Phase 3 — KenBranchZa007 inspection + selective port.
- **DO_NOT_REDO:** Do not reintroduce holo/tilt/glare/RAF; the old 695-line card lives only in the stale worktree copy.

---

## Checkpoint 3 — Phase 3: KenBranchZa007 inspection + selective port (COMPLETE)

- **TIME:** 2026-08-18 ~01:42 (+07)
- **PHASE:** 3 — Inspect KenBranchZa007, do NOT merge it
- **BRANCH:** `main`
- **STARTING_HEAD:** `5dd9e2f`
- **CURRENT_HEAD:** `5561c3e`
- **COMMITS_CREATED:** `5561c3e feat(map): port Thailand extent mask and minimal basemap from KenBranchZa007`
- **FILES_CHANGED:** `src/features/map/lib/basemap.ts` (new), `src/features/map/lib/thailand-extent.ts` (new), `public/geo/thailand-mask.geojson` (new, 849KB), `data/thailand-extent.provenance.json` (new), `scripts/geo/download-thailand-extent.mjs` (new), `src/features/map/constants.ts`, `src/features/map/components/map-view.tsx`, `src/features/map/components/location-picker.tsx`, `package.json` + `package-lock.json` (polygon-clipping 0.15.7), `THIRD_PARTY_NOTICES.md`, `README.md`, `docs/agent-handoffs/KEN_BRANCH_SELECTIVE_PORT_LEDGER.md` (new)
- **WHAT_WAS_IMPLEMENTED:**
  - Inspected KenBranchZa007 (`be8fbfc`; merge-base `d410df2` matches handoff; single stale commit). Full file-by-file selective-port ledger in `docs/agent-handoffs/KEN_BRANCH_SELECTIVE_PORT_LEDGER.md`.
  - **PORTED:** `applyMinimalBasemap` (trim loaded style to hydrography/roads/labels — buildings/POIs/landuse dropped), `applyThailandExtent` (mask source `/geo/thailand-mask.geojson`, frost foreign land, restore open sea over frost, Keppel boundary glow + line; EEZ deliberately excluded — provenance verified against Marine Regions), `geo:download` script, `polygon-clipping` dep, README + THIRD_PARTY_NOTICES updates.
  - **NOT PORTED:** Ken's `map-view.tsx`/`location-picker.tsx` wholesale (would regress multi-province/events/observations — current main wins), package.json scripts beyond `geo:download`, Ken's README claims (rewritten for current main).
- **ROOT_CAUSES_FOUND:** N/A (no bug).
- **TESTS_RUN (fresh):** `npm run typecheck` PASS; `npm run lint` 0 errors (69 warnings, none in touched files); `npx oxfmt --check` PASS; `npx playwright test e2e/map.spec.ts` — **66/66 PASS** (1.9m, against live dev server).
- **EXACT_RESULTS:** Browser verification: mask GeoJSON request observed (only `applyThailandExtent` fetches it), zero console/page errors. 2km monitoring-circle wording untouched (monitoring context, not confirmed spread).
- **VISUAL_VERIFICATION:** Screenshot captured pre-cleanup (map renders); functional verification via full map suite green.
- **KNOWN_ISSUES:** `prisma generate` EPERM under running dev server (pre-existing env interaction, unrelated to this phase). `data/eec-waterways.geojson` (7.7MB, pre-existing Aug-17 artifact) tracked — consistent with mask size convention.
- **UNVERIFIED_ITEMS:** Mask visual appearance not eyeballed on a human screen (functionally verified: fetched, no errors, 66/66 map tests green).
- **NEXT_PHASE:** Phase 4 — Source expansion research (candidates A–F).
- **DO_NOT_REDO:** Do not re-inspect Ken branch wholesale; do not merge KenBranchZa007; the ledger is the record.

---

---

## Checkpoint 4 — Phase 4: Source expansion research (COMPLETE)

- **TIME:** 2026-08-18 ~02:05 (+07)
- **PHASE:** 4 — Source expansion research
- **BRANCH:** `main`
- **STARTING_HEAD:** `5561c3e`
- **CURRENT_HEAD:** `5561c3e` (research-only phase — no code changed)
- **COMMITS_CREATED:** 0 (research + scorecard doc only; scorecard committed with Phase 6 or left as untracked doc per convention — see note below)
- **FILES_CHANGED:** `docs/agent-handoffs/SOURCE_EXPANSION_SCORECARD.md` (new, untracked)
- **WHAT_WAS_IMPLEMENTED:** Live investigation of all six candidates with direct probes:
  - A (Thai DOF www4.fisheries.go.th): DEFER — dedicated ปลาหมอคางดำ tag page with current content, but RSS sits behind Incapsula anti-bot (the 200 was an interstitial, not XML). Adding it would violate the no-scraper/no-anti-bot-bypass architecture rule.
  - B (DOF CKAN catalog.fisheries.go.th): DEFER — standard CKAN API works (success:True), 71 datasets, but 0 blackchin AND 0 tilapia datasets. Identical profile to data.go.th: healthy + zero yield.
  - C (GBIF): REJECT — species nubKey 4285710; Thailand bbox = 145 occurrences, **145/145 are iNaturalist research-grade** (datasetKey 50c9509d). Pure transport duplication.
  - D (OBIS): REJECT — Thailand polygon = 142 occurrences, **142/142 iNaturalist research-grade**. Pure transport duplication; GBIF already aggregates OBIS.
  - E (TH-BIF/ONEP): REJECT — API requires manual e-mail approval (not automatable); feeds GBIF (duplication risk).
  - F (Thai PBS): REJECT — no RSS (404 on /rss /news/rss /feed); /api/public/* endpoints are SPA HTML shells; content already arrives via google-news-th transport (would be transport duplication, not independent corroboration).
- **ROOT_CAUSES_FOUND:** N/A (research). Key negative finding: GBIF/OBIS Thailand yields for S. melanotheron are 100% iNaturalist — the exact lineage trap the handoff warned about.
- **TESTS_RUN:** Live API probes (curl + python parsing) against GBIF, OBIS, data.go.th, catalog.fisheries.go.th, gdcatalog.go.th, www4.fisheries.go.th, thaipbs.or.th — all documented in the scorecard.
- **EXACT_RESULTS:** GBIF TH=145 (100% iNat), OBIS TH=142 (100% iNat), DOF CKAN blackchin=0 tilapia=0 of 71 datasets, DOF RSS=Incapsula wall, Thai PBS RSS=404, TH-BIF=manual approval gate.
- **VISUAL_VERIFICATION:** N/A (no UI change).
- **KNOWN_ISSUES:** None.
- **UNVERIFIED_ITEMS:** gdcatalog.go.th (new unified gov catalog) behind Incapsula too — noted as future re-check alongside DOF CKAN.
- **NEXT_PHASE:** 5 (no sources to implement — N/A, documented) then 6 — Sources page information architecture redesign (group by role, health≠signal, authority/freshness) as the honest fix for the "list looks too small" perception.
- **DO_NOT_REDO:** Do NOT re-probe the six candidates; do NOT add GBIF/OBIS/ThaiPBS (REJECT documented); do NOT bypass Incapsula. The scorecard is the record.

## NEXT_PHASE

Phase 5 is N/A by honest verdict (no candidate earns ADD NOW — see SOURCE_EXPANSION_SCORECARD.md). Proceeding to Phase 6: redesign /sources information architecture — group sources by role (OFFICIAL/GOVERNMENT, BIODIVERSITY, NEWS/DISCOVERY, CITIZEN/FIELD), keep technical health separate from current signal yield (signalCaption already exists), show authority + freshness. Commit scorecard + UI change together at Phase 6 end.

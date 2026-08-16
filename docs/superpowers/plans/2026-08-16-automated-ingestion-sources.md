# Automated External-Data Ingestion + Data Sources Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn FihDar's existing CLI-only external ingestion into a production automated pipeline: one orchestrated refresh command (ingest → intelligence), persisted run history, a public read-only status API, a `/sources` page, and one scheduled Railway cron job (~every 6h).

**Architecture:** Keep the two existing real sources (Google News RSS, data.go.th). Refactor `scripts/ingest.mjs` and `scripts/intel/process.mjs` minimally to export orchestratable functions (`runIngestion`, `runIntelligence`) that return structured summaries. Add `scripts/refresh-intelligence.mjs` that opens an `IngestionRun` row, runs ingestion → intelligence, finalizes status per deterministic rules, and exits. Add `IngestionRun` Prisma model + migration. Add `GET /api/sources/summary` (public, sanitized) backed by `src/server/sources-service.ts`, plus a `/sources` page and sidebar item. Railway: one cron service `fihdar-ingestion-cron` in the existing project, schedule `0 */6 * * *` (UTC), same Postgres via variable reference, start command `npm run db:refresh:prod`, must exit cleanly.

**Tech Stack:** Node 24 (scripts are plain `.mjs` with `node:assert` self-tests — no test framework), Prisma 6 + PostgreSQL, Next.js 16 route handlers + TanStack Query, Tailwind/shadcn for the page.

## Global Constraints

- No mock data, no hardcoded counts, no fabricated stats — every UI/API number comes from the database.
- Do NOT change any intelligence algorithm, threshold, species/relevance/location/dedupe/event/priority logic, or the embedding model (`Xenova/multilingual-e5-small`). Only expose summaries.
- Re-running ingestion must NEVER duplicate an observation — `(sourceName, sourceExternalId)` unique constraint stays the final safety net; the upsert checks `findUnique` first and never overwrites raw title/description.
- Source failure isolation: one failing source never destroys another source's data. All sources fail → run `FAILED`, exit non-zero. Some fail → `PARTIAL`, successful data persists and is still processed.
- No new HTML scrapers, no anti-bot bypass, no new sources this pass. Reliability > source count.
- No public run-ingestion endpoint. Production ingestion is Railway cron / CLI only.
- Public API must never leak DATABASE_URL, stack traces, tokens, filesystem paths, or raw internal error objects.
- UI language is Thai; identifiers/comments stay English. Icons only from `@/components/icons`. Page headers via `PageContainer` props.
- Do not touch Auth visual design, About Lanyard, Team Profile Cards, Dither, logo, animation art direction.
- `npm run db:ingest` and `npm run db:intel` must keep working unchanged.
- Cron process must terminate after work (no HTTP listener, no open Prisma connection at exit).

---

### Task 1: Add `IngestionRun` schema + migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260816000000_add_ingestion_runs/migration.sql` (via `prisma migrate dev --name add_ingestion_runs`)
- Test: `npx prisma validate` + `npx prisma migrate status`

**Interfaces:**
- Produces: Prisma enums `IngestionRunStatus` (`RUNNING|SUCCEEDED|PARTIAL|FAILED`), `IngestionTrigger` (`MANUAL|SCHEDULED`), model `IngestionRun` with fields: `id` (uuid), `trigger` (default MANUAL), `status` (default RUNNING), `startedAt` (default now), `finishedAt?`, `createdCount` (default 0), `skippedCount` (default 0), `processedCount` (default 0), `failedCount` (default 0), `sourceResults Json?`, `pipelineSummary Json?`, `errorSummary String?`, indexes on `[startedAt]` and `[status]`.

- [ ] **Step 1: Write the schema block** — add enums and model to `prisma/schema.prisma` following existing conventions (`@db.Uuid`, snake_case column names auto-derived).
- [ ] **Step 2: Generate migration** — `npx prisma migrate dev --name add_ingestion_runs` against the local Docker Postgres (localhost:5432/fihdar). Review generated SQL: CREATE TYPE enums + CREATE TABLE "IngestionRun".
- [ ] **Step 3: Validate** — `npx prisma validate` passes; `npx prisma migrate status` shows applied.
- [ ] **Step 4: Commit** — `feat: add IngestionRun history model`.

---

### Task 2: Extract pure source/parse + `runIngestion` module (TDD)

**Files:**
- Create: `scripts/ingestion/sources.mjs`
- Create: `scripts/ingestion/run-ingestion.mjs`
- Create: `scripts/ingestion/self-test.mjs`
- Modify: `scripts/ingest.mjs` (rewrite as thin CLI over `runIngestion`)
- Modify: `package.json` (add `ingest:test` script)

**Interfaces:**
- `sources.mjs` exports:
  - `SOURCE_DEFINITIONS`: array of `{ id, label, category, fetch }` where `id` is the `sourceName` used in DB (`google-news-th`, `data.go.th`).
  - `parseRssItems(xml)` → `[{ title, link, pubDate, guid, description }]` (pure, existing logic moved verbatim).
  - `provinceFromText(text)` (pure, existing logic moved verbatim).
  - `fetchGoogleNews(fetchFn)` and `fetchDataGoTh(fetchFn)` — accept a fetch function for test injection; return observation objects with `sourceName`, `sourceExternalId`, `sourceUrl`, `title`, `description`, `province`, `publishedAt`, `status: 'NEW'`, `rawMetadata`.
- `run-ingestion.mjs` exports:
  - `runIngestion({ prisma, fetchFn })` → `{ sources: [{ sourceName, ok, matched, created, skipped, error }], totalCreated, totalSkipped, failedSources, status }` where `status` ∈ SUCCEEDED/PARTIAL/FAILED (from `ingestionStatus`). Each source runs in its own try/catch; failures never abort the batch.
  - `ingestionStatus(results)` → pure status aggregation: all ok → SUCCEEDED; ≥1 ok and ≥1 failed → PARTIAL; all failed (or zero sources) → FAILED.
  - `upsertObservations(prisma, observations, sourceName)` → `{ created, skipped }` (findUnique then create, never overwrite).
- `self-test.mjs`: `node:assert/strict` deterministic tests, no network, no real DB — uses a fake `prisma` object (in-memory map) and fake `fetchFn` (stubbed responses). Exit non-zero on failure.
- `package.json`: `"ingest:test": "node scripts/ingestion/self-test.mjs"`.

- [ ] **Step 1: Write failing tests first** (`scripts/ingestion/self-test.mjs`) covering:
  - RSS parsing: valid feed → items parsed; entity decoding (`&amp;`); `guid` fallback to `link`.
  - `provinceFromText`: `จังหวัดฉะเชิงเทรา`, `จ.ชลบุรี`, bare `ระยอง` match; non-EEC text → null.
  - `ingestionStatus`: all-ok → SUCCEEDED; one-fails → PARTIAL; all-fail → FAILED; zero sources → FAILED.
  - `runIngestion` with fake fetch: duplicate-safe (second run on same fake prisma creates 0, skips N); one source throwing → other still upserts, result PARTIAL; both throwing → FAILED with error strings; structured result fields exact.
  - `upsertObservations`: existing id skipped, new id created, never overwrites title.
- [ ] **Step 2: Run tests, verify they fail** (modules don't exist yet): `npm run ingest:test` → crash on import.
- [ ] **Step 3: Implement `sources.mjs`** — move parsing logic verbatim from `scripts/ingest.mjs`; parametrize fetch.
- [ ] **Step 4: Implement `run-ingestion.mjs`** — orchestration + status aggregation.
- [ ] **Step 5: Rewrite `scripts/ingest.mjs`** — thin CLI: create PrismaClient, call `runIngestion`, print per-source + totals (preserve existing console output shape), exit non-zero if status FAILED.
- [ ] **Step 6: Run `npm run ingest:test`** — all pass.
- [ ] **Step 7: Sanity-check old command still works** — `npm run db:ingest` against local Docker DB (real network) creates rows, second run skips duplicates. (This also seeds the local DB for later tasks.)
- [ ] **Step 8: Commit** — `feat: extract orchestratable ingestion with source failure isolation`.

---

### Task 3: Refactor intel worker to expose `runIntelligence` (no algorithm changes)

**Files:**
- Modify: `scripts/intel/process.mjs`
- Test: `npm run intel:test` + the three validation scripts (baselines must be unchanged)

**Interfaces:**
- Produces: `runIntelligence({ prisma, reprocessAll = false, logger = console })` → `{ rowsConsidered, processed, failed, verdicts: { RELEVANT, IRRELEVANT, UNCERTAIN }, nearDuplicatesLinked, eventCandidates, embeddingAvailable }`. Pure refactor: move the `main()` body into this function, keep `main()` as a thin CLI wrapper (`process.argv.includes('--all')` → `reprocessAll`). No logic changes.

- [ ] **Step 1: Refactor** — extract the body of `main()` into exported `runIntelligence({ prisma, reprocessAll, logger })`; return the summary object (counts already computed); `main()` calls it and prints the same console lines.
- [ ] **Step 2: Verify no behavior change** — run `npm run intel:test` (all pass), `node scripts/intel/species-gate-validation.mjs` (expect 29/30), `node scripts/intel/location-validation.mjs` (31/31), `node scripts/intel/dedupe-event-validation.mjs` (dedupe 17/18, event 19/19), fingerprint `809e22e25ae364e1` unchanged.
- [ ] **Step 3: Commit** — `refactor: expose intel worker summary for orchestration`.

---

### Task 4: Refresh runner + package scripts

**Files:**
- Create: `scripts/refresh-intelligence.mjs`
- Modify: `package.json` (add `db:refresh`, `db:refresh:prod`)

**Interfaces:**
- `refresh-intelligence.mjs`: open `IngestionRun` (trigger from `process.env.FIHDAR_INGESTION_TRIGGER === 'scheduled' ? 'SCHEDULED' : 'MANUAL'`, status RUNNING) → `runIngestion({ prisma, fetchFn: globalThis.fetch })` → `runIntelligence({ prisma, reprocessAll: false })` → finalize with status rules → disconnect → exit 0/1. Never leave a SUCCEEDED-looking RUNNING row: any ordinary caught error finalizes the run FAILED with `errorSummary`. Critical intel failure → run FAILED. Always sets `finishedAt`, `sourceResults` (sanitized: `{ sourceName, ok, matched, created, skipped, error }`), `pipelineSummary`.
- `package.json` scripts:
  - `"db:refresh": "node --env-file=.env scripts/refresh-intelligence.mjs"`
  - `"db:refresh:prod": "node scripts/refresh-intelligence.mjs"` (Railway supplies env; no `.env` needed)

- [ ] **Step 1: Write runner** — per interfaces above; deterministic status rules (SUCCEEDED: all sources ok + intel completed; PARTIAL: ≥1 ok + ≥1 failed; FAILED: all failed OR intel critical failure).
- [ ] **Step 2: Add package scripts.**
- [ ] **Step 3: Local verification** — `npm run db:refresh` against local Docker DB: creates run row, ingests (sources already seeded → mostly skipped), processes RAW rows, finalizes. Re-run → second `IngestionRun`, created 0, skipped ≈ N. Check DB via `npx prisma studio` or a quick node query: run rows exist with correct status/fields, no duplicate observations.
- [ ] **Step 4: Commit** — `feat: add orchestrated refresh runner (db:refresh / db:refresh:prod)`.

---

### Task 5: Public read-only sources summary API

**Files:**
- Create: `src/server/sources-service.ts` (`import 'server-only'`)
- Create: `src/app/api/sources/summary/route.ts`
- Test: run dev server + curl (see Task 8), plus typecheck

**Interfaces:**
- `getSourcesSummary()` → sanitized object:
  ```
  {
    generatedAt: ISO,
    latestRun: { status, startedAt, finishedAt, durationMs, createdCount, skippedCount, processedCount, failedCount, isStale } | null,
    sources: [{ id, label, category, status: 'OK'|'DEGRADED'|'UNKNOWN', lastCheckedAt, lastNewObservationAt, totalObservations }],
    pipeline: { externalObservations, raw, processed, failed, relevant, irrelevant, uncertain, eventCandidates }
  }
  ```
  - `latestRun` from `ingestionRun.findFirst({ orderBy: { startedAt: 'desc' } })`. `isStale`: status RUNNING and startedAt older than STALE_RUN_MS (conservative: 3h). Never mutate the row from a GET.
  - Source status from latest run's `sourceResults` (per-source ok → OK; failed → DEGRADED; no runs → UNKNOWN). `lastCheckedAt` = latest run finishedAt. `lastNewObservationAt` = max `createdAt` per `sourceName`. `totalObservations` = count per `sourceName`.
  - Pipeline counts from `externalObservation` groupBy (`processingStatus`, `relevanceVerdict`) + `eventCandidate.count()`.
  - No raw error objects, no paths, no secrets in the response.
- Route: `GET` only, no auth (public read-only), `errorResponse` wrapper, no mutation.

- [ ] **Step 1: Implement `sources-service.ts`.**
- [ ] **Step 2: Implement route handler** (thin, per project convention).
- [ ] **Step 3: Verify locally** — `npm run dev`, `curl localhost:3000/api/sources/summary`: 200, real values from local DB, no secrets, correct empty handling (pre-run: latestRun null → UI handles; after Task 4 run: real run data).
- [ ] **Step 4: Commit** — `feat: add public read-only sources summary API`.

---

### Task 6: `/sources` page + navigation

**Files:**
- Create: `src/features/sources/api/types.ts`, `service.ts`, `queries.ts`
- Create: `src/features/sources/components/` — status card, source cards, pipeline visual, pipeline metrics, recent runs
- Create: `src/app/(app)/sources/page.tsx`
- Modify: `src/config/nav-config.ts` (add `แหล่งข้อมูล` between `แจ้งการพบ` and `เกี่ยวกับ FihDar`)
- Modify: `src/components/icons.tsx` (add an appropriate Tabler icon export, e.g. `IconDatabase` → `database` — verify the exact exported name in `@tabler/icons-react` before importing)

**Interfaces:**
- `src/features/sources/api/types.ts`: `SourcesSummary`, `LatestRun`, `SourceStatus`, `PipelineStats` matching the API shape.
- `service.ts`: `getSourcesSummary()` via `apiClient` (existing convention).
- `queries.ts`: `sourcesSummaryQueryOptions()` with `sourcesKeys` key factory.
- Page sections (Thai): header (`แหล่งข้อมูล` + subcopy `ข้อมูลสาธารณะที่ FihDar ใช้ประกอบการเฝ้าระวังและวิเคราะห์เชิงพื้นที่`); latest refresh status card (สถานะ / ข้อมูลใหม่ / ประมวลผลแล้ว, `อัปเดตอัตโนมัติประมาณทุก 6 ชั่วโมง`, stale → `สถานะไม่สมบูรณ์`); two source cards (Google News RSS `ข่าวสาธารณะ`, data.go.th `ข้อมูลเปิดภาครัฐ`) with สถานะ / ตรวจสอบล่าสุด / ข้อมูลล่าสุด / จำนวนรายการในระบบ; pipeline visual (รับข้อมูล → ตรวจความเกี่ยวข้อง/ชนิดพันธุ์ → ระบุตำแหน่ง → ตัดข้อมูลซ้ำ → เชื่อมโยงเหตุการณ์ → จัดลำดับพื้นที่), horizontal desktop / vertical mobile, NOT labelled as AI; ~4 pipeline metrics (ข้อมูลภายนอกทั้งหมด, ประมวลผลแล้ว, เกี่ยวข้องกับระบบ, เหตุการณ์ที่เชื่อมโยงได้); recent 5 runs (เวลา/สถานะ/ข้อมูลใหม่/ข้ามข้อมูลซ้ำ/ประมวลผล), no raw errors; transparency note `ข้อมูลจากข่าวและแหล่งสาธารณะเป็นสัญญาณสำหรับการเฝ้าระวัง ไม่ใช่การยืนยันการพบทางชีววิทยาโดยอัตโนมัติ`; CTA `[ สำรวจบนแผนที่ ]` → `/map`. Loading skeleton / empty state (`ยังไม่มีประวัติการอัปเดตอัตโนมัติ`) / error state with retry, no fake zeros.
- Nav: same item flows to mobile drawer automatically (single `navGroups` source). Active state uses existing `isActive` logic — no new nav style.

- [ ] **Step 1: Add icon** — verify `IconDatabase` exists in `@tabler/icons-react`, add `database` to `Icons`.
- [ ] **Step 2: Add nav item** to `nav-config.ts`.
- [ ] **Step 3: Feature API layer** (types/service/queries).
- [ ] **Step 4: Page + components** (client component with `useQuery`, all four states).
- [ ] **Step 5: Verify** — `npm run typecheck`, `npm run lint`, browse `/sources` locally with seeded local DB (real numbers, empty-history handled by truncating runs first if needed).
- [ ] **Step 6: Commit** — `feat: add data sources status page`.

---

### Task 7: E2E verification (Playwright)

**Files:**
- Create: `e2e/sources.spec.ts` (or a script-style smoke check)
- Test: exact viewports 1920×945, 1440×900, 1280×800, 1024×768, 768×1024, 390×844 on `/sources`; smoke `/map`, `/report`, `/about`; nav link present desktop + mobile.

- [ ] **Step 1: Verify navigation link** on desktop sidebar and mobile drawer at all viewports; `/sources` renders sections with real DB values; `/map`, `/about` render; `/report` renders or redirects to sign-in (expected for unauthenticated).
- [ ] **Step 2: Record results.**
- [ ] **Step 3: Commit** (if e2e files added) — `test: add sources page e2e smoke`.

---

### Task 8: Full verification gate

- [ ] `npm run typecheck` — clean
- [ ] `npm run lint` — clean
- [ ] `npm run build` — clean (fresh, read full output)
- [ ] `npm run ingest:test` — pass
- [ ] `npm run intel:test` — pass
- [ ] validation scripts — species 29/30, location 31/31, dedupe 17/18, event 19/19, fingerprint `809e22e25ae364e1`
- [ ] `curl /api/sources/summary` — 200, real values, no secrets

---

### Task 9: Dockerfile for cron + docs

**Files:**
- Create: `Dockerfile.cron` (node:24-slim; `npm ci`; copy `prisma`, `scripts`; `prisma generate`; `CMD ["node", "scripts/refresh-intelligence.mjs"]`)
- Create: `docs/INGESTION.md`
- Modify: `docs/DEPLOYMENT.md` (cron service: name, start command, schedule, shared DATABASE_URL, no public domain, exit behavior)
- Verify: local `docker build -f Dockerfile.cron .` succeeds and `npm run db:refresh:prod` runs inside the image (against local DB) then exits.

- [ ] **Step 1: Write `Dockerfile.cron`** and build locally.
- [ ] **Step 2: Smoke-run the cron image** — container runs refresh against local Docker Postgres and exits 0.
- [ ] **Step 3: Write `docs/INGESTION.md`** — sources, commands, pipeline, schedule, failure/duplicate behavior, manual verification.
- [ ] **Step 4: Update `docs/DEPLOYMENT.md`.**
- [ ] **Step 5: Commit** — `docs: document scheduled ingestion + add cron image`.

---

### Task 10: Push + Railway deploy + cron + production verification

**Files:** none (infra via Railway CLI)

- [ ] **Step 1: Final review** — `git status`, `git diff --stat`, scan for secrets (DATABASE_URL values, tokens) in the diff; nothing from `.data`, `.env`, screenshots.
- [ ] **Step 2: Logical commits** (already per-task; squash only if needed), push branch, merge to `main` via fast-forward, push `main`.
- [ ] **Step 3: Deploy web service** (Railway auto-deploys from `main` or `railway up`) — migration applies on boot (`prisma migrate deploy`), then verify `https://fihdar-app-production.up.railway.app/sources` and `/api/sources/summary` return real data.
- [ ] **Step 4: Create cron service** `fihdar-ingestion-cron` in the SAME project/environment: source = same repo/commit, build = `Dockerfile.cron`, start command = `npm run db:refresh:prod`, cron schedule `0 */6 * * *` (UTC), no public domain, `DATABASE_URL` via Railway variable reference to the same Postgres (never paste the raw URL into code), `FIHDAR_INGESTION_TRIGGER=scheduled`. No second project/DB/Redis/queue.
- [ ] **Step 5: Manual production run** — trigger one refresh (Railway "Deploy" / run command), record start/finish/source results/created/skipped/processed/status; verify `IngestionRun` row in production DB; new rows are RAW then processed; no duplicate increase.
- [ ] **Step 6: Duplicate test** — trigger a second refresh shortly after: existing items skipped, `ExternalObservation` count unchanged from duplicates.
- [ ] **Step 7: Failure behavior** — verified deterministically in unit tests (Task 2); do NOT break production sources.
- [ ] **Step 8: Production smoke** — `/sources`, `/api/sources/summary`, `/map`, `/about`, `/report`; cron verified via `railway status` (service exists, schedule correct, not permanently Active, last run exited).
- [ ] **Step 9: Final report** per spec format.

---

## Self-Review

**Spec coverage:** §6-8 (Task 2), §9 (Task 2, per-source isolation + PARTIAL/FAILED), §10 (Task 3), §11 (Task 2 self-test), §12-17 (Tasks 1, 4), §18-20 (Tasks 4, 10), §21-25 (Task 5), §26-43 (Task 6), §44-50 (Tasks 9, 10), §51-54 (Task 10), §55-59 (Tasks 7, 8), §60-63 (Tasks 5, 10), §64-65 (Task 9), §66-72 (Task 10). No placeholders. Type/property names consistent across tasks (`runIngestion`, `runIntelligence`, `IngestionRun`, `getSourcesSummary`, `sourcesSummaryQueryOptions`, `database` icon).

**Deferred (documented, per spec):** persistent `.data/intel` embedding cache in the cron container is not provisioned (no new paid volume) — correctness first; model re-download cost documented as an optimization if it becomes measurable.

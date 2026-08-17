# External-Data Ingestion & Intelligence Pipeline

FihDar pulls public, structured data about suspected Blackchin Tilapia
(ปลาหมอคางดำ) activity in the EEC provinces (ฉะเชิงเทรา, ชลบุรี, ระยอง), runs
it through the intelligence pipeline, and surfaces the results on `/map` and
`/sources`. This page documents the automated path.

Nothing here is a scraper: every source is a structured public API, RSS feed,
or citizen-science API. There is no HTML anti-bot scraping.

---

## Current sources

| Source | Transport | What it provides |
|---|---|---|
| `google-news-th` | Google News RSS | Thai-language news mentioning Blackchin Tilapia in the EEC provinces |
| `data.go.th` | CKAN API (open government data portal) | Public datasets matching tilapia / ปลานิล / ปลาหมอคางดำ on data.go.th — see [Known constraints](#known-constraints) |
| `inaturalist` | JSON API | Citizen-science occurrence observations of *Sarotherodon melanotheron* in Thailand, with observer-supplied coordinates |
| `matichon` | RSS | มติชน news feed |
| `khaosod` | RSS | ข่าวสด news feed |
| `prachachat` | RSS | ประชาชาติธุรกิจ news feed |

Sources are **hard-coded trusted definitions** in `scripts/ingestion/registry.mjs`
(one structured adapter each — `rss` / `ckan` / `json-api`; no generic scraper).
The app never accepts arbitrary URLs (no SSRF surface) — see `/sources` in the UI
and `src/server/source-registry.ts`, which strips the fetch function before any
metadata is persisted to the database.

## Commands

| Command | What it does |
|---|---|
| `npm run db:ingest` | Fetch + parse + persist new `ExternalObservation` rows (local `.env`) |
| `npm run db:intel` | Run the intelligence worker over RAW/FAILED observations (local `.env`) |
| `npm run db:refresh` | Orchestrated local run: ingest → intelligence → event resolution |
| `npm run db:refresh:prod` | Same, production-safe: reads `process.env` only, no `.env` file required |
| `npm run ingest:test` | Deterministic self-tests for parsing/status/duplicate logic (no network) |
| `npm run intel:test` | Deterministic self-tests for the intelligence modules |

The orchestrated refresh is the production entry point. It:

1. creates an `IngestionRun` (status `RUNNING`, trigger `MANUAL` or `SCHEDULED`)
2. runs ingestion (source failure is isolated — one failing source does not
   discard the other's rows)
3. runs intelligence over only newly created RAW rows
4. finalizes the run: `SUCCEEDED` / `PARTIAL` / `FAILED`, always with
   `finishedAt` and a safe summary
5. disconnects Prisma and **exits** — it never starts Next.js and never stays
   alive

`FIHDAR_INGESTION_TRIGGER=scheduled` (set only on the Railway cron service)
records runs as `SCHEDULED`; local runs default to `MANUAL`.

## Pipeline

```
Source (google-news-th / data.go.th / inaturalist / matichon / khaosod / prachachat)
  → ExternalObservation (raw, status=RAW)
  → intelligence: species gate → keyword relevance → Thai location extraction
    → near-dedupe (MinHash/LSH) → event resolution (EventCandidate)
  → priority scoring (experimental MVP)
  → UI (/map layers, /sources, priority panel)
```

The intelligence algorithms are frozen for this phase — relevance, species,
location, dedupe thresholds, event semantics, embedding model
(`Xenova/multilingual-e5-small`) and priority are unchanged. The refresh only
feeds new data through them. If new data exposes a real algorithm bug, the
fix must start with a failing regression test.

## Duplicate behavior

Uniqueness is enforced by the `(sourceName, sourceExternalId)` contract on
`ExternalObservation`. Re-running ingestion:

- re-fetches each source
- matches against existing rows by `(sourceName, sourceExternalId)`
- inserts only genuinely new rows; skips everything already present
- the database unique constraint is the final safety net

Run history records `created` vs `skipped` so a source that is checked
successfully but returns nothing new is still observably "checked"
(observation timestamps alone cannot prove that — that is why `IngestionRun`
exists).

## Failure behavior

- **PARTIAL** — at least one source succeeded, at least one failed; the
  successful rows are kept and still processed by intelligence; the run
  record captures the failed source.
- **FAILED** — all sources failed, or intelligence failed critically; the
  run record is finalized (never left `RUNNING`) and the process exits
  non-zero.
- Source error details live in the `IngestionRun` record only — the public
  `/api/sources/summary` endpoint returns a sanitized status
  (`OK`/`DEGRADED`/`UNKNOWN`) with a safe Thai message.

## Schedule

Production runs on a single Railway scheduled job (`fihdar-ingestion-cron`):

- schedule: `0 */6 * * *` (UTC — approximately every 6 hours; not a
  minute-perfect Thai-local guarantee)
- start command: `npm run db:refresh:prod` (migrations run at deploy time via
  the service's pre-deploy command, not inside every scheduled run)
- image: `Dockerfile.cron` — CLI-only, pruned to the pipeline's package
  closure, runs as non-root, exits after the run

## How to verify manually

```bash
npm run ingest:test          # parsing / status / duplicate logic
npm run db:refresh           # one local orchestrated run
# then inspect the latest run:
npx prisma studio            # → IngestionRun table
curl http://localhost:3000/api/sources/summary
```

Expected on a second immediate refresh: `created=0`, `skipped≈previous
matched`, status `SUCCEEDED` — proof of duplicate safety.

## Known constraints

- The embedding model/cache lives under `.data/intel/`. A fresh Railway cron
  container may not preserve `.data` between executions (no paid volume is
  attached for cache optimization). When the model is unavailable the
  pipeline degrades to keyword-only relevance by design; correctness does not
  depend on the cache. If repeated model download becomes a measurable cost,
  that is a documented optimization, not a bug.
- `data.go.th` is technically healthy (fetch/parse/upsert succeed) but has
  produced no relevant signal in practice. Its catalog has no invasive
  Blackchin Tilapia dataset — querying the actual species name
  (`ปลาหมอคางดำ` / `หมอคางดำ` / `blackchin tilapia`) returns zero results;
  what the catalog does have is generic Nile tilapia aquaculture-economics
  data (farm counts, harvest volumes, prices), a different species tracked
  for agricultural statistics, not ecological surveillance. The source stays
  connected — it is free, safe, and could surface a real dataset later — but
  do not expect it to be a meaningful signal source. This is exactly the
  source-health-vs-signal-yield distinction `signalCaption()` in
  `src/features/sources/lib/format.ts` exists to represent honestly rather
  than collapsing into one status.

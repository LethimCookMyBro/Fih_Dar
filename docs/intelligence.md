# FihDar Intelligence Layer

Experimental, offline processing on top of the external-data ingestion
pipeline. Everything here runs as CLI batch workers — **nothing runs in the
Next.js request path**, and no part of the web app depends on any of it.

```
RAW (ExternalObservation, ingested)
  → PROCESSING (scripts/intel/process.mjs — offline batch worker)
  → ENRICHED (same row: verdict, location precision, evidence, duplicates, events)
```

If any NLP/model/geospatial stage fails, raw rows stay intact and the web app
keeps working. Rows are marked `FAILED` and are retryable.

## Commands

```bash
npm run intel:test            # deterministic unit tests (no network)
npm run db:intel              # process RAW (+FAILED) observations
npm run db:intel -- --all     # reprocess everything (idempotent)
npm run intel:benchmark       # model + throughput benchmark → .data/intel/benchmark.json
npm run intel:export-review   # Label Studio JSONL → .data/intel/review-export.jsonl
npm run waterways:download    # OSM EEC waterway extract → data/eec-waterways.geojson
npm run waterways:analyze     # nearest-waterway association for coordinate rows
npm run waterways:graph       # offline connectivity graph prototype
```

---

## 1. Libraries evaluated

| Library | Verdict | Why |
|---|---|---|
| PyThaiNLP | **Rejected** | Python-only; this repo's toolchain is Node. Its tokenization is not needed — char-bigram shingling (standard for unsegmented Thai) powers MinHash, and location extraction is deterministic + fuzzy against an admin reference. |
| RapidFuzz | **Selected via `fuzzball`** | `fuzzball` is the maintained JS port of RapidFuzz's token-set/ratio algorithms; used for admin-name normalization. |
| datasketch | **Selected via `minhash`** | The `minhash` npm package provides MinHash + a datasketch-style `LshIndex` (banded LSH), used for near-duplicate detection. |
| sentence-transformers | **Selected via `@huggingface/transformers`** | Transformers.js runs the model locally (ONNX, no API). See model selection in §3. |
| NetworkX | **Rejected in favor of `graphology`** | graphology + graphology-shortest-path are the mature JS equivalents; the prototype graph is small and fully offline. |
| DuckDB spatial | **Not needed (documented)** | Evaluated for preprocessing the Geofabrik PBF; the chosen Overpass extract is already small and targeted, so a local analytic engine adds nothing for the current dataset size. |
| thai-address-database | **Selected** | Standard jquery.Thailand.js address data (77 provinces, 922 amphoes) — deterministic + fuzzy reference for location normalization. |

## 2. Dependencies added

`fuzzball`, `minhash`, `thai-address-database`, `graphology`,
`graphology-shortest-path`, `@huggingface/transformers`. All runtime-optional:
`db:intel` degrades to keyword-only relevance when the model is unavailable.

## 3. Model selection

**Selected: `intfloat/multilingual-e5-small`** (via the `Xenova/…` ONNX
conversion, q8 quantized).

Why over `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`:

- e5-small is **retrieval-tuned** (built for relevance/retrieval); MiniLM-L12-v2
  is STS-tuned — relevance scoring is closer to retrieval than to paraphrase
  equivalence.
- Multilingual (100+ languages including Thai), 384-dim.
- The e5 repo's ONNX conversion ships a **quantized** export (~40 MB download,
  129 MB on disk with the runtime); the MiniLM repo has no quantized ONNX
  export (verified: 404 on `onnx/model_quantized.onnx`).

Benchmark (fresh, uncached inference, chunked):

| Metric | Value |
|---|---|
| Model size on disk | 129 MB (q8) |
| Embedding dim | 384 |
| Model load (warm cache) | ~6–14 ms (first cold load incl. download ≈ 105 s) |
| Batch of 64 (fresh) | 1,309 ms → **20.5 ms/text**, ≈ 49 texts/s |
| Full corpus 110 (fresh, chunked 32) | ≈ 24.5 s |
| Peak RSS (worker path, chunked) | **≈ 545 MB** |
| Peak RSS (unbounded single batch) | ≈ 3.4 GB — *why inference is chunked* |

Re-runs are near-instant: embeddings are cached on disk
(`.data/intel/embedding-cache.json`, keyed by text hash).

## 4. Data sources downloaded

| Source | What | Size | License |
|---|---|---|---|
| OpenStreetMap via Overpass | EEC waterways (river/stream/canal/drain/tidal_channel) in Chachoengsao + Chonburi + Rayong | **3,483 segments, 7,054 km**, 7.2 MB GeoJSON | ODbL 1.0 |
| Google News RSS + data.go.th | Existing ingestion corpus (110 observations) | — | public |

Raw HydroRIVERS (Asia, 91 MB) and Geofabrik Thailand (311 MB PBF) were
**evaluated but not downloaded**: HydroRIVERS reaches are DEM-modeled (no local
names, no surveyed geometry) — better suited to a later basin-scale phase; the
Geofabrik file is whole-country when only three provinces are needed. The
Overpass extract is reproducible from `npm run waterways:download` (3 public
endpoints, single bounded query, one request).

Attribution: © OpenStreetMap contributors (ODbL 1.0 — share-alike applies to
derivative databases). Recorded in `data/eec-waterways.provenance.json`.

## 5. Preprocessing architecture

```
raw observation
  → normalize (NFC, strip HTML, collapse whitespace, lowercase)
  → species gate (ปลาหมอคางดำ / Blackchin tilapia / S. melanotheron)
  → keyword category classification (SIGHTING / CONTROL_REMOVAL / POLICY /
    AQUACULTURE / UNRELATED) with per-hit evidence
  → Thai location extraction (deterministic admin scan + fuzzy normalize)
  → semantic relevance (e5 cosine vs 4 prototypes; cached, optional)
  → verdict + evidence (JSON, component scores kept separate)
  → near-duplicate linking (content hash + MinHash LSH, never deletes)
  → event candidate resolution (union-find + time-coherence split)
```

Every stage writes its evidence to `ExternalObservation.evidence` (JSONB);
nothing overwrites the raw title/description.

## 6. Relevance results (real corpus, 110 observations)

| Verdict | Count |
|---|---|
| RELEVANT | 98 |
| IRRELEVANT | 12 |
| UNCERTAIN | 0 |
| FAILED | 0 |

| Kind | Count |
|---|---|
| SIGHTING | 61 |
| UNRELATED | 26 |
| CONTROL_REMOVAL | 10 |
| POLICY | 8 |
| AQUACULTURE | 5 |

**No thresholds are presented as scientific.** Component scores are stored per
row; `.data/intel/distributions.json` holds the score distributions for manual
inspection. The keyword verdict is deterministic and explainable; semantic
scores refine only `UNCERTAIN` rows upward, never override a clear verdict, and
never imply a confirmed occurrence.

Concrete inspected examples:

- ✅ **Correct (sighting):** “ปลาหมอคางดำ ระบาด ฉะเชิงเทรา ชาวบ้านวางลอบดัก
  เจอทุกวัน” → SIGHTING / RELEVANT / ฉะเชิงเทรา.
- ✅ **Correct (control):** “เช็ก 75 จุดรับซื้อ ปลาหมอคางดำ กก.ละ 15 บาท” →
  CONTROL_REMOVAL / RELEVANT.
- ✅ **Correct (irrelevant):** “ปริมาณการจับปลานิล” (data.go.th) → AQUACULTURE /
  IRRELEVANT (different species — a genuine false positive during development,
  caused by the bare word ‘จับ’ being in the SIGHTING set; removed).
- ⚠️ **False positive (verdict):** celebrity-news items that mention the species
  incidentally (“ณัฐชา ตามหา สุชาติ … ปลาหมอคางดำ เงียบกริบ”) are RELEVANT via
  the UNCERTAIN→RELEVANT semantic softener. Defensible for monitoring (species
  + location context), but flagged for human review.
- ⚠️ **Borderline kind:** explainer pieces (“การทำหมันจะแก้ปัญหานี้ได้หรือไม่”,
  “เปิด 7 มาตรการคุม”) contain outbreak vocabulary and classify SIGHTING; a
  human reviewer may prefer POLICY. Evidence records both keyword hits and
  semantic scores so the decision is auditable.
- ❌ **False negative risk:** coverage using only informal variants (“เจอคางดำ”)
  with no species term would be gated out; the current corpus has none.

## 7. Deduplication results

- Exact source dedupe: enforced by the `(sourceName, sourceExternalId)` unique
  constraint at ingest (verified: re-run ingests 0).
- Content hash: 1 exact duplicate linked (same story re-published under a new
  Google News id).
- MinHash LSH: 1 near-duplicate linked (fuzzy score 100).
- **2 rows linked, 0 deleted.** Each links `duplicateOfId` → canonical row with
  the method and score in evidence. Verified: content-hash and minhash-lsh rows
  both resolve to a real canonical `duplicateOf`.

## 8. Location extraction results

| Precision | Count |
|---|---|
| UNKNOWN | 73 |
| PROVINCE | 28 |
| WATERBODY | 7 |
| DISTRICT | 2 |

Verified: 0 province matches occur outside the raw text; `ลุ่มน้ำบางปะกง` →
waterbody บางปะกง / WATERBODY; `อ.บางปะกง จ.ฉะเชิงเทรา` → DISTRICT; English
alias “Bang Pakong” → ฉะเชิงเทรา/บางปะกง; `คลองบางละมุง` → WATERBODY.
Coordinates are never derived from text (0 rows carry coordinates; precision
EXACT is only assigned when the source provides them).

Development bugs found by inspection and fixed: jquery.Thailand.js decoder
(lookup/words are pipe-separated strings), short district names matching inside
words (word-boundary rule for ≤3-char names + `แพร่`), single-char fuzzy
captures (fuzzball returns degenerate 100s), `จ.` shorthand requiring the dot.

## 9. Waterway dataset result

`data/eec-waterways.geojson` + provenance — 3,483 segments, 728 named, 7,054
km, by type: river 962 / canal 1,264 / stream 934 / drain 323. Regenerable via
`npm run waterways:download`. Named features include แม่น้ำบางปะกง. HydroRIVERS
remains the documented Phase-2B candidate for basin-scale topology.

## 10. Waterway intelligence

`npm run waterways:analyze` computes, for rows with **source-provided**
coordinates only: `derivedNearestWaterway`, `derivedDistanceMeters`,
`derivedWaterwaySource` — strictly separate from the source latitude/longitude.
The corpus currently has 0 coordinate rows (by design — never invented); the
module is exercised by clearly-labeled synthetic demo points (Bang Pakong →
แม่น้ำบางปะกง @ 312 m, Rayong reservoir area → stream @ 765 m) that are never
persisted.

## 11. Waterway graph prototype

`npm run waterways:graph` (graphology, offline): 4,630 nodes, 3,148 edges,
1,521 connected components (largest 391 nodes = 8.4% — OSM segments are
genuinely fragmented). Demo A: 78.8 km network path within the largest
component. Demo B: Bang Pakong → Rayong correctly reported **not connected**.
Shortest-path (Dijkstra) and connectedness work; no ecological spread claims.

## 12. Event resolution

7 `EventCandidate` rows (status `EXPERIMENTAL`, never auto-verified), spans
0–13 days after the time-coherence split. Union-find over location agreement +
≤21-day window + semantic (≥0.75) or fuzzy (≥90) similarity + MinHash jaccard
≥0.3, then hard 14-day-span clusters. Development issue found and fixed: a
rolling window chained months of Pattaya coverage into one 84-member group.

## 13. Evidence engine

Per-row `evidence` JSON keeps **separate** dimensions: species terms,
per-category keyword hits + scores, keyword verdict + reason, semantic
similarity per prototype, location match evidence, near-duplicate record. No
aggregate “confidence” is produced. If a combined score is ever needed it must
be labeled experimental, preserve components, document the formula, and never
drive automatic verification.

## 14. Human review

`npm run intel:export-review` writes Label Studio JSONL (110 items) with
pre-filled `verdict:`/`kind:`/`location:` labels plus provenance metadata for
judging relevant/irrelevant, sighting/non-sighting, location correctness,
duplicate/independent, same-event/different-event. The labeled set can later
drive threshold/model evaluation. Label Studio itself is not deployed.

## 15. Performance

See §3 table. Summary: batch throughput ≈ 49 texts/s fresh (CPU), worker peak
RSS ≈ 545 MB (chunked), re-runs near-instant via disk cache. The worker is a
manual/scheduled CLI job — never in the web request path.

## 16. Failure isolation

- Per-row errors → `FAILED` + `processingError`, batch continues.
- Embedding/model failure → keyword-only relevance, zero crashes.
- Source-scrape failure → isolated per source (existing ingest behavior,
  verified with a sabotaged endpoint).
- RAW rows remain fully usable without any enrichment.

## 17. Deferred / next steps

- **HydroRIVERS basin-scale network** (needs shapefile tooling; prototype uses
  OSM).
- **Subdistrict-level** extraction (reference data present; corpus rarely
  mentions them).
- **Citizen-report linkage into EventCandidate** — deliberately deferred: it
  would require privacy care around report locations, and there are no genuine
  reports in the DB yet.
- **Label Studio deployment** — local researcher tool only.

---

## PostGIS / pgvector migration proposal (do NOT apply yet)

Apply only after the prototype shows value. Both are Railway Postgres plugin
upgrades (no new architecture).

**Phase A — PostGIS** (spatial indexing + joins):
- `CREATE EXTENSION postgis;` + `SELECT PostGIS_Version();` migration.
- Add `geometry(Point, 4326)` columns: `SightingReport.location`,
  `ExternalObservation.sourceLocation`, `ExternalObservation.derivedLocation`
  (derived = nearest waterway point, kept separate from source).
- Replace the JS nearest-segment scan (§10) with `ST_DWithin` + `ST_Distance`
  against a waterways table imported from the GeoJSON
  (`ST_GeomFromGeoJSON`), gaining indexes over 3,483 segments.
- Use `ST_Intersects` / `ST_Contains` for district/polygon containment, and
  `ST_ShortestLine` for the graph edges.
- Keep the existing lat/lng columns as the source of truth; geometry columns
  become indexed views of them (trigger-maintained).

**Phase B — pgvector** (embeddings + similarity search):
- `CREATE EXTENSION vector;` then
  `ALTER TABLE "ExternalObservation" ADD COLUMN "embedding" vector(384);`
- Populate from the existing disk cache (`.data/intel/embedding-cache.json`)
  with an `INSERT … ON CONFLICT` batch job.
- HNSW index: `CREATE INDEX obs_embedding_hnsw ON "ExternalObservation" USING
  hnsw (embedding vector_cosine_ops);` — replaces in-memory cosine scans and
  enables `ORDER BY embedding <=> $1 LIMIT k` for near-duplicate and
  same-event candidate recall at scale.
- The intel worker writes embeddings directly instead of a JSON cache file.

Both phases keep the current tables and queries working; they only add
capability. No data migration of existing rows is required beyond backfilling
new columns.

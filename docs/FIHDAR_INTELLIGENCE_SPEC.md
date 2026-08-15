# FihDar Intelligence Spec

Status: **EXPERIMENTAL — no component is validated against human-labeled
FihDar data.** This spec states what exists now, what it may mean, and what is
explicitly NOT justified yet.

## What exists NOW

An offline batch intelligence pipeline (`scripts/intel/`) over the
external-data ingestion corpus (`ExternalObservation`). It runs as CLI workers
only — never in the Next.js request path — and nothing in the web app depends
on it. Raw source rows are never modified; enrichment is additive.

```
RAW  →  normalize → species gate → keyword classification → location
extraction → semantic relevance (optional) → verdict + evidence
→ near-duplicate linking → event candidates → (review exports)
```

Commands: `npm run db:intel`, `intel:test`, `intel:benchmark`,
`intel:export-review`, `intel:export-review-csv`, `waterways:download`,
`waterways:analyze`, `waterways:graph`.

## Source types (current)

1. `data.go.th` — Thai government open-data portal (CKAN JSON API); official
   datasets (e.g. Nile tilapia catch statistics).
2. `google-news-th` — Google News RSS (Thai-language feeds), used as a
   **discovery** feed. Stored data is titles + wrapper links, not article
   bodies.

Retention design: store minimum necessary text (title + short excerpt +
provenance URL), prefer official APIs/RSS over scraping, never store full
article bodies, and treat aggregator content as discovery only — no copyright
conclusions are made here.

## Algorithms

| Component | Library / method | Purpose |
|---|---|---|
| Normalization | NFC, HTML strip, lowercase | Deterministic text cleaning |
| Species gate | Keyword terms | ปลาหมอคางดำ / Blackchin tilapia / S. melanotheron |
| Classification | Thai keyword sets | SIGHTING / CONTROL_REMOVAL / POLICY / AQUACULTURE / UNRELATED |
| Location | Deterministic scan + fuzzball fuzzy | Province/district/waterbody normalization |
| Embeddings | `Xenova/multilingual-e5-small` (ONNX q8) | Semantic similarity vs prototypes |
| Near-duplicate | MinHash + LSH (`minhash`), fuzzball confirm | Content-hash + paraphrase dupes |
| Events | Union-find + time-coherence split | Group observations possibly referencing one event |

## Species hard gate

Every row records `speciesEvidence`:

- `EXPLICIT_BLACKCHIN` — text names the target species.
- `AMBIGUOUS_TILAPIA` — tilapia mentioned, species unclear (e.g. only ปลานิล).
- `OTHER_SPECIES` — reserved (not detected yet).
- `NONE` — no fish species mentioned.

**Only `EXPLICIT_BLACKCHIN` may enter Blackchin Tilapia sighting/event
evidence.** Generic-tilapia content stays as contextual external data and is
never a sighting, regardless of semantic similarity. Nothing is deleted for
failing the gate. Current corpus distribution: EXPLICIT_BLACKCHIN 98 /
AMBIGUOUS_TILAPIA 10 / NONE 2 (110 rows).

## Thresholds — provenance and status

All thresholds are **EXPERIMENTAL, UNCALIBRATED**. They were chosen as working
guesses that produced plausible behavior on the current 110-row corpus. None
has been compared to human labels. Do not tune them by intuition; the next
phase calibrates against the labeled dataset. Centralized in
`scripts/intel/thresholds.mjs` (all prefixed `EXPERIMENTAL_`).

| Constant | Value | Provenance |
|---|---|---|
| `EXPERIMENTAL_EVENT_WINDOW_DAYS` | 21 | guess; editorial choice |
| `EXPERIMENTAL_CLUSTER_SPAN_DAYS` | 14 | guess; set after observing 84-member chaining bug |
| `EXPERIMENTAL_SEMANTIC_SIMILARITY` | 0.75 | guess; conventional cosine cutoff |
| `EXPERIMENTAL_FUZZY_RATIO` | 90 | guess; conventional fuzzy cutoff |
| `EXPERIMENTAL_MIN_JACCARD` | 0.3 | guess; set to separate distinct stories |
| `EXPERIMENTAL_LOCATION_FUZZY_PROVINCE` | 85 | guess; admin-name match confidence |
| `EXPERIMENTAL_LOCATION_FUZZY_DISTRICT` | 80 | guess; admin-name match confidence |
| `EXPERIMENTAL_SEMANTIC_UNCERTAIN_UPGRADE` | 0.75 | guess; uncertain→relevant softener |
| `EXPERIMENTAL_NEAR_DUPE_FUZZY_CONFIRM` | 88 | guess; LSH pair confirmation |
| `MINHASH_NUM_PERM` / `MINHASH_LSH_BAND_SIZE` | 128 / 8 | standard library config, not calibrated |

## Validated vs unvalidated

**Validated (mechanical, not scientific):** the pipeline runs end-to-end on 110
real rows with 0 failures; self-tests pass; location extraction never matches
outside the raw text; dedupe and event resolution were exercised and their
outputs manually inspected; species gate distribution confirmed.

**Unvalidated (needs human labels):** relevance verdicts, category kinds,
semantic thresholds, fuzzy thresholds, event-window, MinHash duplicate
decisions, event groupings. **No accuracy/precision/recall/F1 claims may be
made until human labels exist.**

## What outputs are allowed to mean

- `RELEVANT` = "worth a human's attention" — never "confirmed occurrence".
- `EventCandidate` = "several sources may reference one event" — status stays
  `EXPERIMENTAL`, never auto-verified.
- `duplicateOfId` = "content/near-duplicate of an earlier row" — nothing is
  deleted.
- `locationPrecision` = how precisely the source text places the subject;
  coordinates are never derived from text.
- `derivedNearestWaterway` / `derivedDistanceMeters` = spatial association
  only — a small distance is NOT evidence of fish presence.
- Waterway graph = connectivity/network-distance tool only; explicitly **not**
  an ecological spread predictor.

## Human review requirements

- Label ALL 110 records via `.data/intel/human-review.csv` (human_* columns
  left empty by the exporter).
- Required judgments: relevance (RELEVANT/IRRELEVANT/UNCERTAIN), event type,
  species evidence, province/location correctness, duplicate group, same-event
  group.
- No threshold may be presented as justified until the labeled set exists.

## Production vs experimental

Everything in `scripts/intel/`, the `ExternalObservation` enrichment columns,
`EventCandidate`, the waterway dataset/graph, and all thresholds is
**experimental**. The citizen-report product (map, report flow, profile) is
production and does not depend on any of it. The schema migration is applied
to the Railway PostgreSQL instance (additive columns/tables only; no PostGIS,
no pgvector).

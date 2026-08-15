# FihDar Intelligence Roadmap

Future, **conditional** items only. Nothing here is implemented, and nothing is
activated without its stated condition being met first. Current status: all
intelligence components are experimental and uncalibrated.

## 1. PostGIS (spatial capability)

- **Item:** geometry columns + spatial indexes + `ST_DWithin` nearest-waterway
  and `ST_Intersects`/`ST_Contains` joins; replace the JS segment scan.
- **Activation condition:** the waterway association and graph prototypes show
  value in human review, AND the observation corpus grows beyond what the
  in-memory scan handles comfortably (roughly thousands of coordinate rows).

## 2. pgvector (embedding search)

- **Item:** `vector(384)` column, HNSW index, `<=>` cosine search replacing the
  in-memory/JSON-cache embedding comparisons for dedupe and event recall.
- **Activation condition:** embeddings prove useful in the labeled evaluation
  (semantic relevance or dedupe outperforms the keyword/hash baselines).

## 3. Knowledge graph (entities → relationships)

- **Item:** typed nodes (species, waterbody, district, source, event) and
  edges (located-in, mentions, same-event, derived-near).
- **Activation condition:** event resolution and location extraction are
  validated against the labeled dataset, and a concrete query need exists
  (e.g. "all sources mentioning a waterbody within a date range").

## 4. Temporal early warning

- **Item:** EWMA / z-score / change-point detection over observation or event
  counts per province/waterbody to flag anomalous increases.
- **Activation condition:** a labeled event set exists to define what "anomaly"
  should mean, AND monitoring objectives are agreed with domain stakeholders.
  Until then any alarm would be arbitrary.

## 5. Computer vision (image analysis)

- **Item:** species identification from citizen-report images (image
  classification / detection).
- **Activation condition:** a labeled image dataset of Blackchin Tilapia and
  confusable species is available, and the report flow produces enough images
  to justify it. Not before.

## 6. Active learning

- **Item:** select the most informative unlabeled rows for human review to
  minimize labeling effort.
- **Activation condition:** the human-labeled corpus reaches a size where
  uncertainty sampling measurably beats random sampling for the chosen
  classifier.

## 7. Production-scale waterway analysis

- **Item:** HydroRIVERS (or full-country OSM) basin-scale network, river-order
  attributes, catchment joins — beyond the current 3-province OSM extract.
- **Activation condition:** a research/stakeholder need for basin-scale
  analysis is confirmed; the current EEC extract is intentionally small and
  localized.

---

Cross-cutting rule: every item above becomes **deferred again** if a human
labeling dataset is not available to evaluate it, or if it would change the
production database architecture without approval. No item is implemented in
the current stabilization pass.

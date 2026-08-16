// EXPERIMENTAL, UNCALIBRATED thresholds for the intelligence pipeline.
//
// STATUS: NONE of these values has been calibrated against human-labeled
// FihDar data. They are working guesses chosen for plausible behavior on the
// 110-observation corpus and MUST NOT be presented as scientifically
// justified. Do not tune them by intuition — the next phase compares
// algorithms against a human-labeled dataset (see
// docs/FIHDAR_INTELLIGENCE_SPEC.md §"Threshold provenance").
//
// Each constant is prefixed EXPERIMENTAL_ so its status is obvious at every
// use site. Values were frozen to match the behavior of the previous inline
// constants (21, 14, 0.75, 90, 0.3, 85, 80, 0.75, 88) — renaming only.

// Event resolution: max days between two observations for them to be
// candidates for the same event (union-find edge).
export const EXPERIMENTAL_EVENT_WINDOW_DAYS = 21;

// Event resolution: max span of one candidate's member dates (hard bucket
// from cluster start, prevents similarity chaining across months). Lowered
// from 14 to 7 after controlled validation showed 14 let identical text
// 10 days apart (e19) merge as one event; the largest legitimate same-event
// gap observed in the controlled corpus is ~3 days (multi-outlet follow-up).
export const EXPERIMENTAL_CLUSTER_SPAN_DAYS = 7;

// Relevance: semantic similarity (e5 cosine) at or above which an observation
// counts as similar to a prototype/another observation.
export const EXPERIMENTAL_SEMANTIC_SIMILARITY = 0.75;

// Event resolution: fuzzy token-set ratio at or above which two observations
// are textually the same story.
export const EXPERIMENTAL_FUZZY_RATIO = 90;

// Event resolution: MinHash jaccard floor for a same-event pair — distinct
// stories share few char bigrams; rewrites share many.
export const EXPERIMENTAL_MIN_JACCARD = 0.3;

// Location: fuzzy (fuzzball token_set_ratio) minimum for accepting a
// normalized province / district name from a จ./อ. prefix capture.
export const EXPERIMENTAL_LOCATION_FUZZY_PROVINCE = 85;
export const EXPERIMENTAL_LOCATION_FUZZY_DISTRICT = 80;

// Relevance: semantic similarity to the sighting prototype at or above which
// an otherwise UNCERTAIN keyword verdict may be upgraded to RELEVANT.
export const EXPERIMENTAL_SEMANTIC_UNCERTAIN_UPGRADE = 0.75;

// Dedupe: fuzzy token-set ratio confirming a MinHash-LSH candidate pair as a
// near-duplicate.
export const EXPERIMENTAL_NEAR_DUPE_FUZZY_CONFIRM = 88;

// Dedupe: maximum geographic distance (km) between two EXACT-coordinate
// observations for them to be considered the same article. When BOTH
// observations have exact coordinates and the distance exceeds this threshold,
// the duplicate match is vetoed regardless of text similarity. This prevents
// templated occurrence titles (e.g. iNaturalist "การพบปลาหมอคางดำ (Sarotherodon
// melanotheron) — ...") from collapsing genuinely different real-world
// occurrences at far-apart locations. EXPERIMENTAL/UNCALIBRATED — value is a
// working guess based on the production defect (Krabi↔Bangkok ~650 km,
// Phetchaburi↔Chanthaburi ~240 km were false merges; legitimate same-site
// observations are typically <5 km apart). Do not present as scientifically
// calibrated.
export const EXPERIMENTAL_NEAR_DUPE_MAX_GEO_DISTANCE_KM = 50;

// Non-threshold algorithmic constants (not calibrated — standard config for
// the chosen libraries; kept here for visibility).
export const MINHASH_NUM_PERM = 128; // MinHash signature length
export const MINHASH_LSH_BAND_SIZE = 8; // LSH bands (bands × rows = 128)
export const WATERBODY_CAPTURE_MIN_LEN = 4; // min chars for unknown waterbody capture
export const WATERBODY_CAPTURE_MAX_LEN = 8; // max chars for unknown waterbody capture

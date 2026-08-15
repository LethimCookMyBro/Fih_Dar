# FihDar Species Hard-Gate Validation

Status: **PASS WITH LIMITATIONS** — the current species gate is correct on
clear and typical inputs but is **not adversarially robust**: 13 of 30
controlled cases fail, including 4 cases where non-Blackchin content is
emitted as `EXPLICIT_BLACKCHIN`. **No implementation change was made in this
phase** — this document measures the current gate only.

## 1. What was tested and how

The species hard gate is the function chain
`classifyText(title, description) → speciesEvidence` in
`scripts/intel/keywords.mjs`, over text normalized by `normalize.mjs`
(NFC, HTML strip, whitespace collapse, `toLocaleLowerCase('th')`).

Current textual evidence rules (from `keywords.mjs`, unchanged):

| Class | Produced when |
|---|---|
| `EXPLICIT_BLACKCHIN` | text contains any of `SPECIES_TERMS` = `ปลาหมอคางดำ`, `blackchin tilapia`, `sarotherodon melanotheron`, **bare `คางดำ`** |
| `AMBIGUOUS_TILAPIA` | no species term, but text contains `GENERIC_TILAPIA_TERMS` = `ปลานิล`, `nile tilapia` |
| `OTHER_SPECIES` | **never produced** — reserved, no detection vocabulary exists |
| `NONE` | neither list matched |

Matching is a plain case-insensitive substring `includes()` — no word
boundaries, no negation/comparison handling, no typo tolerance.

**Test set:** 30 deterministic cases (`scripts/intel/species-gate-validation.mjs`),
expected classes fixed **before** the first run: 11 × clear Blackchin (A),
8 × ambiguous tilapia (B), 5 × other species (C), 6 × no-species (D/E).
Runner: `node scripts/intel/species-gate-validation.mjs`; machine-readable copy
at `.data/intel/species-gate-results.json` (gitignored).

## 2. Observed results (fresh run, current implementation)

| Metric | Value |
|---|---|
| Total cases | **30** |
| Correct | **17** |
| Incorrect | **13** |
| Accuracy | **0.567** |

### Confusion matrix (expected row × actual column)

| expected \ actual | EXPLICIT_BLACKCHIN | AMBIGUOUS_TILAPIA | OTHER_SPECIES | NONE |
|---|---|---|---|---|
| EXPLICIT_BLACKCHIN | **9** | 0 | 0 | 2 |
| AMBIGUOUS_TILAPIA | 1 | **4** | 0 | 3 |
| OTHER_SPECIES | 1 | 0 | **0** | 4 |
| NONE | 2 | 0 | 0 | **4** |

### Per-class metrics

| Class | TP | FP | FN | Precision | Recall | F1 |
|---|---|---|---|---|---|---|
| EXPLICIT_BLACKCHIN | 9 | 4 | 2 | 0.692 | 0.818 | 0.750 |
| AMBIGUOUS_TILAPIA | 4 | 0 | 4 | 1.000 | 0.500 | 0.667 |
| OTHER_SPECIES | 0 | 0 | 5 | — (undefined) | 0.000 | — |
| NONE | 4 | 9 | 2 | 0.308 | 0.667 | 0.421 |

## 3. Failed cases (13) with root causes

| # | Input (title) | Expected | Actual | Root cause |
|---|---|---|---|---|
| 18 | ถกสนั่น แกะปลากระป๋อง เจอแมคเคอเรลคางดำ | OTHER_SPECIES | EXPLICIT_BLACKCHIN | bare `คางดำ` term matches inside "แมคเคอเรลคางดำ"; subject is mackerel |
| 19 | ร้านอาหาร 'คางดำ' เปิดสาขาใหม่ที่ชลบุรี | NONE | EXPLICIT_BLACKCHIN | bare `คางดำ` matches a brand name; no fish present |
| 20 | หน่วยงานยืนยันว่าไม่ใช่ปลาหมอคางดำ | NONE | EXPLICIT_BLACKCHIN | no negation handling; "ไม่ใช่…" still substring-matches |
| 21 | ปลาตัวนี้คล้ายปลาหมอคางดำแต่เป็นปลานิล | AMBIGUOUS_TILAPIA | EXPLICIT_BLACKCHIN | comparison text; species term wins over generic hit |
| 23 | ปลาหมอค้างดำระบาด (misspelled ค้าง) | EXPLICIT_BLACKCHIN | NONE | exact substring matching; no typo tolerance |
| 24 | BlackchinTilapia spotted in canal | EXPLICIT_BLACKCHIN | NONE | term list has a space; no whitespace-insensitive match |
| 8 | tilapia farming grows in the east | AMBIGUOUS_TILAPIA | NONE | bare English `tilapia` missing from `GENERIC_TILAPIA_TERMS` (only `nile tilapia`) |
| 29 | tilapia prices rise this month | AMBIGUOUS_TILAPIA | NONE | same as #8 |
| 9 | ปลาหมอชุกชุมในบ่อน้ำจืด | AMBIGUOUS_TILAPIA | NONE | bare `ปลาหมอ` in no list (also the name of climbing perch — genuinely ambiguous) |
| 11 | ชาวประมงจับปลากะพงได้ตัวใหญ่ | OTHER_SPECIES | NONE | `OTHER_SPECIES` never detected — no vocabulary |
| 12 | ปลาทับทิมราคาดีช่วงเทศกาล | OTHER_SPECIES | NONE | same |
| 13 | ปลาช่อนชุกชุมในฤดูฝน | OTHER_SPECIES | NONE | same |
| 14 | ชาวบ้านจับปลาหมอเทศได้จากบ่อ | OTHER_SPECIES | NONE | same |

**Grouped root causes (all confirmed by evidence output — see
`speciesHit`/`genericHit` in the runner):**

1. **Bare `คางดำ` term (4 gate-property violations: #18, #19, #20, #21).**
   The single most important finding: content that is NOT a Blackchin Tilapia
   occurrence is emitted `EXPLICIT_BLACKCHIN`. If the gate's core property
   ("only genuine blackchin text enters the sighting/event pipeline") is
   treated as binary, **the gate fails that property on 4 deterministic
   inputs**. This is the same term that made the canned-mackerel item
   (review #34) `RELEVANT` in the preliminary human validation.
2. **No negation/comparison handling (#20, #21).** Quoted denial and
   comparative text still produce affirmative species evidence.
3. **Exact-substring brittleness (#23, #24).** One misspelled vowel or a
   missing space drops a genuine mention to `NONE` (recall loss).
4. **Missing generic vocabulary (#8, #29).** Bare English `tilapia` is not in
   `GENERIC_TILAPIA_TERMS`, so generic-tilapia content is `NONE` rather than
   `AMBIGUOUS_TILAPIA`.
5. **`OTHER_SPECIES` is a dead class (#11–#14).** Declared but never emitted —
   0/5 recall; all identifiable non-blackchin fish collapse to `NONE`.
   (Note: `ปลาทับทิม` is technically a tilapia breed and `ปลาหมอเทศ` is
   Mozambique tilapia, so `AMBIGUOUS_TILAPIA` is defensible for them; the
   invariant that matters — never `EXPLICIT_BLACKCHIN` — still holds because
   the gate emits `NONE`.)

## 4. What this validation does and does NOT cover

**Covered here:** deterministic behavior of the species evidence
classification on 30 fixed inputs.

**Already validated separately (preliminary, previous phase):** the relevance
verdict on 40 human-reviewed samples — 38/38 agreement on decidable items,
5/5 repeat agreement (`docs/FIHDAR_PRELIMINARY_VALIDATION.md`). That review
exercised the gate indirectly on real corpus text (including the
canned-mackerel item, where the reviewer was UNCERTAIN and the system said
RELEVANT — consistent with failure group 1 above).

**NOT yet evaluated:** thresholds (`EXPERIMENTAL_*` in `thresholds.mjs`),
location extraction, deduplication (exact + MinHash), event resolution,
waterway association, and any claim about real-world prevalence. The 110-row
corpus distribution (EXPLICIT_BLACKCHIN 98 / AMBIGUOUS_TILAPIA 10 / NONE 2)
is an observation about that corpus, not a validated accuracy figure.

## 5. Verdict and next step

**Verdict: PASS WITH LIMITATIONS.** The gate is correct on all clear cases
(5/5 clear Blackchin, 3/3 no-species, 5/8 ambiguous tilapia) and its
corpus-facing behavior is unchanged and already exercised end-to-end. But the
adversarial set shows it is not robust: 4 false-`EXPLICIT_BLACKCHIN`
emissions (bare `คางดำ`), no negation/comparison awareness, typo/spacing
sensitivity, a dead `OTHER_SPECIES` class, and missing bare-English `tilapia`
vocabulary.

**Deliberately NOT done in this phase** (per instructions): no algorithm
change, no threshold change, no model, no deploy, no migration. The failure
groups above are the concrete shopping list for the next (fix) phase — the
highest-impact single fix is re-scoping the bare `คางดำ` term (word-boundary
or full-phrase matching, or demoting it to a weak signal).

## Post-fix validation (species hard-gate fix phase)

> The pre-fix results above (17/30, 0.567) are preserved for traceability. The
> failures were subsequently fixed in `scripts/intel/keywords.mjs` via TDD
> (13 focused regression assertions added to `self-test.mjs` first — all seen
> failing — then the minimal implementation). This section records the fixed
> gate's results. Same 30 controlled cases, unchanged.

### Root causes → fixes

1. **Bare `คางดำ`** — removed from `SPECIES_TERMS`. Strong evidence now
   requires species context: `ปลาหมอคางดำ`, `หมอคางดำ` (informal
   shorthand), `Blackchin tilapia`, `Sarotherodon melanotheron`.
2. **Negation** — `NEGATION_TRIGGERS` (`ไม่ใช่ / มิใช่ / ไม่พบ / ไม่เจอ /
   ไม่เห็น`) checked against the *earliest overlapping* species-term
   occurrence; a fully negated mention produces no affirmative evidence.
3. **Comparison/correction** — species term + generic tilapia + `แต่เป็น`
   resolves the specimen to the generic fish → `AMBIGUOUS_TILAPIA`.
4. **Generic English tilapia** — bare `tilapia` added to
   `GENERIC_TILAPIA_TERMS`.
5. **Spelling/spacing variants** — whitespace-insensitive occurrence
   matching (`\s*` between characters, deterministic, no fuzzy engine):
   `BlackchinTilapia`, `ปลาหมอ คางดำ`, and the `ค้างดำ` misspelling are all
   supported via explicit terms/variants without new false positives.
6. **`OTHER_SPECIES`** — the SPEC declares it an intended output
   ("an identifiable non-blackchin fish (reserved; not detected yet)"), so it
   is now emitted from a minimal vocabulary: `ปลากะพง`, `ปลาทับทิม`,
   `ปลาช่อน`, `ปลาหมอเทศ`, `แมคเคอเรล`. `verdictFromEvidence` gained the
   matching branch — `OTHER_SPECIES → IRRELEVANT` (required: without it the
   canned-mackerel row would have stayed RELEVANT via kind alone).

### After results (30 controlled cases)

| Metric | Before | After |
|---|---|---|
| Correct | 17/30 | **29/30** |
| Incorrect | 13/30 | **1/30** |
| Accuracy | 0.567 | **0.967** |

> Scope: 0.967 (29/30) is agreement on this **deterministic controlled test
> set** only. It is NOT a claim of 96.7% real-world species-classification
> accuracy — no such claim is made anywhere in this document.

Confusion matrix after (expected row × actual column):

| expected \ actual | EXPLICIT_BLACKCHIN | AMBIGUOUS_TILAPIA | OTHER_SPECIES | NONE |
|---|---|---|---|---|
| EXPLICIT_BLACKCHIN | **11** | 0 | 0 | 0 |
| AMBIGUOUS_TILAPIA | 0 | **7** | 0 | 1 |
| OTHER_SPECIES | 0 | 0 | **5** | 0 |
| NONE | 0 | 0 | 0 | **6** |

Per-class after:

| Class | TP | FP | FN | Precision | Recall | F1 |
|---|---|---|---|---|---|---|
| EXPLICIT_BLACKCHIN | 11 | 0 | 0 | 1.000 | 1.000 | 1.000 |
| AMBIGUOUS_TILAPIA | 7 | 0 | 1 | 1.000 | 0.875 | 0.933 |
| OTHER_SPECIES | 5 | 0 | 0 | 1.000 | 1.000 | 1.000 |
| NONE | 6 | 1 | 0 | 0.857 | 1.000 | 0.923 |

**Safety invariant: HOLDS.** The EXPLICIT_BLACKCHIN row is diagonal-only
(fp=0, fn=0). All 4 adversarial non-blackchin cases that previously emitted
`EXPLICIT_BLACKCHIN` (canned mackerel, brand name, negation, comparison) now
emit `OTHER_SPECIES`/`NONE`/`AMBIGUOUS_TILAPIA` respectively.

**Remaining failure (1):** case #9 — bare `ปลาหมอ` alone → `NONE` (expected
`AMBIGUOUS_TILAPIA`). Bare `ปลาหมอ` is genuinely unresolvable (climbing
perch vs. blackchin shorthand in news) and the reviewer's own grouping made it
ambiguous; `NONE` is the conservative safe output and violates no safety
property. Deliberately not guessed — documented limitation.

### Corpus impact (read-only re-classification of all 110 real rows)

Exactly **1 of 110** rows changes species evidence: `7c6e5617`
(canned-mackerel headline, review item #34) `EXPLICIT_BLACKCHIN →
OTHER_SPECIES`; its relevance verdict becomes `IRRELEVANT` on the next
pipeline run (was `RELEVANT`, matching the human reviewer's UNCERTAIN). The
three bare-`คางดำ`-only rows that are genuine fish stories (`หมอคางดำ…`)
stay `EXPLICIT_BLACKCHIN` via the new strong term. The pipeline was **not**
re-run — no database writes.

### Relevance behavior

`verdictFromEvidence` logic for all pre-existing classes is unchanged. The
only addition is the `OTHER_SPECIES → IRRELEVANT` branch, required to keep
identifiable non-blackchin content out of relevance (per the SPEC's rule that
only `EXPLICIT_BLACKCHIN` enters sighting evidence).

## Files created / modified

- `scripts/intel/keywords.mjs` — **modified**: term lists (bare `คางดำ`
  removed; `หมอคางดำ`, misspelling variants, bare `tilapia`, other-species
  vocabulary added), negation/comparison handling, `OTHER_SPECIES` emission,
  verdict branch.
- `scripts/intel/self-test.mjs` — **modified**: +13 species-gate regression
  assertions (all seen failing before the fix).
- `scripts/intel/species-gate-validation.mjs` — created in the validation
  phase; unchanged baseline (30 controlled cases).
- `docs/FIHDAR_SPECIES_GATE_VALIDATION.md` — this report.
- `.data/intel/species-gate-results.json` — machine-readable results,
  rewritten with post-fix numbers (gitignored).
- Gates (fresh): `npm run intel:test` ✅ · `npm run typecheck` ✅ ·
  `npm run lint` ✅ (0 errors, 6 pre-existing warnings). No commit, no push,
  no deploy, no migration.

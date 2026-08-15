# FihDar Preliminary Validation — Blind Review 40

Status: **PRELIMINARY — observed agreement on one small, selected sample.
This is NOT a validated accuracy claim.** No thresholds were changed as a
result of this evaluation.

## What was evaluated

The relevance classifier (`relevanceVerdict`: `RELEVANT` / `IRRELEVANT`) of the
experimental intelligence pipeline, against human labels from a blind review of
40 `ExternalObservation` records.

**Blind protocol:** the reviewer saw only the headline, short excerpt, date,
source, and source URL — never the system prediction. The review workbook
(`FihDar_Blind_Review_40_completed.xlsx`) contains a 40-item sheet, an
instruction sheet, a 5-item repeat sheet, and a mapping sheet (ลำดับ →
Record UUID → `human_relevance`). Reviewer answers were normalized:
เกี่ยวข้อง → `RELEVANT`, ไม่เกี่ยวข้อง → `IRRELEVANT`, ไม่แน่ใจ → `UNCERTAIN`.

**Joining:** each of the 40 UUIDs was matched to
`.data/intel/human-review.csv` (the pipeline's per-record results). All 40
matched; no duplicate UUIDs. As an independent cross-check, 6 of the 40 rows
were re-read directly from the live Railway PostgreSQL
(`relevanceVerdict`) and matched the CSV values exactly, so the CSV reflects
the current system state.

## Observed results

| Metric | Value |
|---|---|
| Total reviewed | **40** |
| Decidable (binary) | **38** |
| Uncertain (excluded) | **2** |
| True positives | **33** |
| True negatives | **5** |
| False positives | **0** |
| False negatives | **0** |
| Accuracy | **38/38 = 1.0** |
| Precision | **33/33 = 1.0** |
| Recall | **33/33 = 1.0** |
| F1 | **1.0** |
| Human/system disagreements | **0 of 38** |
| Repeat-review agreement (5 items, same reviewer) | **5/5** |

Human label distribution on the 40: RELEVANT 33 / IRRELEVANT 5 / UNCERTAIN 2.
System prediction distribution on the same 40: RELEVANT 34 / IRRELEVANT 6 —
i.e. the system classified both human-uncertain items (one each way).

### The 2 excluded (UNCERTAIN) items

1. **#34 — “ถกสนั่น แกะปลากระป๋อง เจอแมคเคอเรลคางดำ?” (CH3Plus).**
   System: `RELEVANT`. Reviewer note: the text does mention ปลาหมอคางดำ but in
   a canned-mackerel scandal context, not an occurrence; headline alone was
   not enough to decide. This is a genuinely arguable case, not a clear
   failure — the species gate legitimately flagged explicit species text.
2. **#40 — “วันใหม่ ไทยพีบีเอส” (Thai PBS).** System: `IRRELEVANT`. Reviewer
   note: a bare TV-program title with no content to judge.

## Interpretation — read this before citing the numbers

- The observed 38/38 agreement is **agreement on this sample**, not
  "100% accurate". Do not claim classifier accuracy, precision, recall, or F1
  as validated.
- **Preliminary only:** a single human reviewer, 40 selected records.
- **Not an independent random benchmark:** the sample was deliberately mixed
  (news + confusable cases) by the reviewer's own instructions
  ("เลือกแบบผสม… ไม่ได้ใช้ชุดนี้เพื่อประมาณสัดส่วนข่าวจริงทั้งโลก"), so it does
  not estimate real-world prevalence or difficulty.
- **Uncertain excluded:** binary metrics drop the 2 items the reviewer could
  not decide; they are reported separately above.
- **Class imbalance:** 33 positive / 5 negative decidable items. Precision and
  recall estimates are unstable at this size and imbalance; the two negative
  classes that mattered (generic tilapia datasets, unrelated news) all landed
  in TN, but 5 negatives is far too few to generalize.
- **Scope:** only relevance was reviewed. Species gate, location extraction,
  deduplication, event resolution, and all `EXPERIMENTAL_*` thresholds were
  **not** evaluated here.

## What was NOT done

- No threshold was tuned or changed (all constants remain
  `EXPERIMENTAL`/`UNCALIBRATED` in `scripts/intel/thresholds.mjs`).
- No algorithm, model, or schema change. No deploy, no migration.
- No claim that `RELEVANT` = confirmed occurrence (it remains "worth a human's
  attention").

## Next prerequisites (not implemented yet)

- Label the full 110-record corpus in `.data/intel/human-review.csv`
  (human_* columns are still empty).
- Ideally a second reviewer or adjudication for the hard cases (e.g. #34).
- Only then: keyword/rules vs LLM vs embeddings comparison; exact hash vs
  pg_trgm vs MinHash vs embedding-similarity dedupe comparison; event resolver
  against labeled same-event pairs.

## Verification artifacts

- Workbook: `.data/validation/FihDar_Blind_Review_40_completed.xlsx`
  (identical copy in `.data/intel/`; gitignored).
- Pipeline results: `.data/intel/human-review.csv` (110 rows; gitignored).
- Evaluation script: `.data/intel/validate-blind-review.mjs` (gitignored
  tooling; joins the workbook mapping to the CSV and computes the table above).
- Live-DB cross-check: `relevanceVerdict` for 6 of the 40 UUIDs re-read from
  Railway PostgreSQL — all 6 matched the CSV.

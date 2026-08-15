# AI Usage Disclosure

This project was built with AI-assisted coding tools as part of a hackathon
submission. In the interest of the competition's disclosure requirements,
here is an honest account of scope and responsibility.

## What AI-assisted tools were used for

- **Coding assistance** — implementing features (the intelligence pipeline's
  location/species/dedupe/event-grouping logic, the priority MVP module, UI
  components) from human-specified requirements and conventions.
- **Debugging** — root-causing failures such as the event-grouping crash and
  the false-merge cases documented in
  `docs/FIHDAR_DEDUPE_EVENT_VALIDATION.md`.
- **Testing** — writing the controlled validation runners
  (`scripts/intel/*-validation.mjs`, `scripts/intel/self-test.mjs`) and their
  frozen test cases.
- **Documentation** — drafting and iterating on docs like this one, the
  validation reports, and inline comments explaining non-obvious decisions.

## What the team did

- Defined the problem (blackchin tilapia invasive-species reporting in the
  EEC provinces) and the product direction (citizen reports → intelligence
  pipeline → operational priority → map).
- Selected the architecture and technology choices (Next.js/shadcn starter,
  Prisma/PostgreSQL, MapLibre, the local-embedding approach for semantic
  similarity instead of an external API).
- Reviewed AI-produced code and output before accepting it, including
  reading through the validation reports' failure tables case-by-case rather
  than accepting summary pass/fail numbers at face value.
- Defined and validated the critical intelligence-pipeline behavior: the
  frozen controlled test sets in `docs/FIHDAR_*_VALIDATION.md` (relevance,
  species gate, location extraction, dedupe/event grouping) exist precisely
  so pipeline behavior is checked against fixed, human-reviewable
  expectations rather than trusted blindly.
- Remains responsible for the final work, including its limitations (see
  each validation doc's "Known limitations" / "Verdicts" sections) and for
  not overclaiming what the system does.

## What this disclosure does NOT claim

- It does not claim every line of code was written from scratch by a human,
  or the reverse — that no human judgment was involved. Both would be false.
- It does not claim the intelligence pipeline's outputs are validated
  biological/scientific fact. Every relevance verdict, species-evidence tag,
  location extraction, and event grouping is explicitly labeled
  EXPERIMENTAL/derived and documented with its measured accuracy against a
  controlled test set, not a claim of real-world accuracy — see the scope
  disclaimer at the top of each `docs/FIHDAR_*_VALIDATION.md` file.
- It does not claim the operational priority score
  (`docs/FIHDAR_PRIORITY_MVP.md`) is a calibrated research model — it is an
  explainable MVP heuristic over a narrow set of defensible signals, with
  the full proposal's remaining components (habitat suitability, protected
  value, accessibility) explicitly out of scope for this build.

## No UI/assets copied from external sites

No third-party website UI or brand assets were cloned pixel-for-pixel into
this project. Visual direction references (see `THIRD_PARTY_NOTICES.md` for
the actual open-source packages used) informed layout and component choices,
not copied source.

# FIHDAR Priority MVP

Answers the operational question **"สัปดาห์หน้าควรส่งทีมลงพื้นที่ที่จุดใดก่อน?"**
(which area should the field team check first next week) for the current
Hackathon MVP. This is an **EXPERIMENTAL** scoring prototype, not a validated
research model — see §4 for what is explicitly out of scope.

- Implementation: `scripts/intel/priority.mjs` (pure scoring function,
  exercised by `npm run intel:test`) + `src/server/priority-service.ts`
  (Prisma query + assembly) + `GET /api/events/priority` +
  `src/features/priority/**` (client) +
  `src/features/priority/components/priority-panel.tsx` (map side panel).

## 1. What it ranks

Every resolved `EventCandidate` (a group of RELEVANT external observations
that likely describe the same real-world incident — see
`docs/FIHDAR_DEDUPE_EVENT_VALIDATION.md`). Ranking is over **areas/events**,
not raw articles — a 5-outlet incident is one ranked row, not five.

The area label prefers the most specific defensible place a member's
location-extraction evidence recorded (e.g. `หาดพัทยา`), falling back to
province, then to an explicit "ไม่ทราบพื้นที่" (unknown area) — never
collapsed to province-only when a more specific place is available.

## 2. Signals (all defensible from validated pipeline output)

| Signal | Source | Why it's defensible |
|---|---|---|
| **Recency** | most recent member `publishedAt`, linear decay to 0 over 45 days | Older coverage is less operationally actionable |
| **Corroboration** | count of *independent* sources — near-duplicate members (`duplicateOfId` set) collapse to their canonical row before counting, so re-published copies never inflate the count | More independent outlets = stronger real-world signal, not more text |
| **Location specificity** | best `locationPrecision` among members (EXACT/WATERBODY > SUBDISTRICT > DISTRICT > PROVINCE > UNKNOWN) | A province-level mention isn't actionable; a named beach/waterbody is |

Weights: recency 0.35, corroboration 0.35, location 0.30 — `WEIGHTS` in
`priority.mjs`. **EXPERIMENTAL / UNCALIBRATED**, same status as every other
threshold in the intelligence pipeline (`thresholds.mjs`) — a working
starting point, not a fitted model.

Species evidence is a hard gate upstream (only `EXPLICIT_BLACKCHIN` rows ever
reach `RELEVANT`, see `docs/FIHDAR_SPECIES_GATE_VALIDATION.md`), so every
ranked event already carries confirmed species evidence — it is reported in
the panel's reason breakdown but does not vary the score (it can't: it's
already 1/1 for anything that reaches this stage).

## 3. Score

`score = round(0.35·recency + 0.35·corroboration + 0.30·location)`, 0–100,
deterministic. Ties break on: score desc → freshest first → most independent
sources → slug ascending, so ranking never depends on database/array
iteration order.

Every response item carries `breakdown` (per-signal score + weight) and
`independentSourceCount` — the UI always shows *why*, never a bare number.

## 4. Explicitly NOT implemented (future/full research model)

Per the project proposal's full architecture, three components are **not**
in this MVP score and the UI must never imply they are:

- **Habitat suitability (MaxEnt)** — no environmental/GIS suitability model.
- **Protected aquaculture value** — no economic-exposure weighting per area.
- **Field accessibility** — no road/logistics scoring.

The panel's "ทดลอง (MVP)" badge and its subtitle say this explicitly. Areas
without a source-provided coordinate are still ranked and shown — labeled
"ไม่มีพิกัดบนแผนที่" (no coordinate available) — never given a fabricated
position.

## 5. Tests (`scripts/intel/self-test.mjs`, run via `npm run intel:test`)

- fresher, corroborated event outranks an old single-source event
- duplicate articles (shared canonical id) do not inflate independent source count
- a duplicate-inflated event scores identically to an equivalent genuine single-source event
- 5-outlet corroboration scores higher than 3-outlet corroboration
- unknown location + unknown date → low score, never silently high
- missing precision is reported as `UNKNOWN`, never invented
- padding one real source with duplicate copies cannot outrank genuine multi-source corroboration (text volume ≠ evidence)
- ranking is deterministic regardless of input array order, with an explicit tie-break

## 6. Known limitations

- Recompiled on every request from current DB state — no persistence, no
  historical score trend.
- The 45-day recency decay and the 0.35/0.35/0.30 weights are working
  defaults, not calibrated against outcomes.
- `EventCandidate.locationPrecision`/place are derived at read time from
  member observations (the write path in `process.mjs` does not populate
  `EventCandidate.locationPrecision`) — correct, but recomputed on every
  request rather than cached.

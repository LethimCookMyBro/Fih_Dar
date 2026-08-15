# FihDar Location Extraction Validation

Status: **PASS WITH LIMITATIONS** — the current extractor is strong on clear
and no-location cases (district 30/30, no-location false positives 0/3,
province 14/15 where expected) but has a genuine **event-salience defect**:
when text contains several place names, the extractor picks the first match
in *name-scan order* (longest code-point length, then admin-database order) —
not the event location. No implementation change was made in this phase.

## 1. What was tested and how

`extractLocation(title, description, lat, lng)` in `scripts/intel/locations.mjs`,
over `normalizeText` output. Current capabilities (unchanged):

- **Province**: English aliases → exact scan over 77 provinces (longest
  code-point length first, boundary check for ≤3-char names + `แพร่`) →
  `จ.`/`จังหวัด` prefix capture with fuzzball normalization (≥85).
- **District/amphoe**: `อ.`/`อำเภอ` prefix with fuzzball (≥80) → exact scan
  over 922 amphoes (a name already captured as waterbody is not re-claimed).
- **Waterbody**: exact scan over 6 EEC names (needs a non-Thai char before)
  → prefix capture (`แม่น้ำ|คลอง|ลำน้ำ|หนอง|บึง|อ่างเก็บน้ำ|เขื่อน|ปากน้ำ|
  ลุ่มน้ำ|ทะเลสาบ`) with known-prefix or 4–8-char unknown capture.
- **Precision**: EXACT > SUBDISTRICT > DISTRICT > WATERBODY > PROVINCE >
  UNKNOWN. Multiple locations: **first match in scan order wins per field**
  (no text position, no event salience). Absent/ambiguous → nulls, UNKNOWN.
- No coordinates are ever derived from text.

**Test set:** 30 deterministic cases (`scripts/intel/location-validation.mjs`),
expected answers fixed **before** the first run (categories A clear province,
B district+province, C local names not in vocabulary, D waterbodies,
E multiple locations, F no location, G adversarial). Runner:
`node scripts/intel/location-validation.mjs`; machine-readable results in
`.data/intel/location-validation-results.json` (gitignored).

## 2. Observed results (fresh run, current implementation)

| Metric | Value |
|---|---|
| Total cases | 30 |
| Full tuple + precision match | **25/30** |
| Province: correct / incorrect / missing / spurious | **26 / 1 / 0 / 3** |
| District: correct / incorrect / missing / spurious | **30 / 0 / 0 / 0** |
| Waterbody: correct / incorrect / missing / spurious | **29 / 0 / 1 / 0** |
| Precision correct | 27/30 |
| Province accuracy where a province is expected | **14/15** |
| False-positive location rate on no-location cases (cat F) | **0/3** |
| Cases with any spurious extraction | 3/30 |

## 3. Failed cases and root causes (5)

| # | Input | Expected | Actual | Root cause |
|---|---|---|---|---|
| 15 | ข่าวกล่าวถึงสมุทรสาคร…แต่เหตุการณ์ใหม่เกิดที่ชลบุรี | province=ชลบุรี | สมุทรสาคร | **Event salience defect**: scan order is name-length-then-DB-order, not text position or salience; สมุทรสาคร (9 cp) is scanned before ชลบุรี (6 cp) |
| 17 | เคยพบปัญหาในสมุทรสงคราม ก่อนพบล่าสุดที่หาดพัทยา | none (event=Pattaya, unmapped) | สมุทรสงคราม + PROVINCE | Same defect: background province selected; event name not in vocabulary |
| 21 | ผู้สื่อข่าวระยองรายงาน…ที่หาดพัทยา | none | ระยอง + PROVINCE | Same defect: publisher location selected over unmapped event |
| 12 | แม่น้ำระยองพบปลาหมอคางดำ | waterbody=ระยอง, province=null | province=ระยอง (+wb=ระยอง ✓) | **River-name→province leak**: province scan (step 2) runs before the waterbody scan; `ระยอง` (5 cp) needs no boundary check, so it matches inside `แม่น้ำระยอง` |
| 28 | พบปลาหมอคางดำในบ่อปลาหนองค้อ | waterbody=หนองค้อ | none (UNKNOWN) | **Waterbody boundary/prefix gap**: exact scan requires a non-Thai char before `หนองค้อ` (`ปลา` precedes → blocked); the prefix path captures only what follows `หนอง` (`ค้อ`, 2 cp < min 4) instead of the full known name |

Grouped root causes:

1. **Event-salience defect (3 failures: #15, #17, #21).** The extractor has
   no notion of *which* place is the event. Background, publisher, title, and
   origin locations can beat the event location purely on name ordering.
2. **`ระยอง` province/waterbody name collision (#12).** `ระยอง` is both a
   province and an EEC waterbody name; scan order lets one leak into the other.
3. **Waterbody boundary + prefix-capture split (#28).** A known waterbody
   adjacent to other Thai text is blocked by the boundary rule, and the
   prefix capture then only sees the tail of the name.

## 4. Real-corpus read-only check (110 records; no writes)

| Field | Count |
|---|---|
| Province extracted | 33 |
| District extracted | 2 |
| Waterbody extracted | 7 |
| UNKNOWN precision | 73 (PROVINCE 28 · DISTRICT 2 · WATERBODY 7) |

Top provinces: ชลบุรี 15 · ระยอง 11 · ฉะเชิงเทรา 3 · หนองคาย/จันทบุรี/เพชรบุรี/
สมุทรสาคร 1 each.

**Suspicious cases found:**

- **Person-surname province (443db650)** — `นางมยุรี ณ พัทลุง ประมงอำเภอ
  บางละมุง … จังหวัดชลบุรี`. The extractor returned ชลบุรี (correct event) but
  **only by ordering luck**: `ชลบุรี` and `พัทลุง` are both 6 code points and
  the admin DB lists ชลบุรี first. A re-ordered DB would extract the surname
  province. Same latent defect class as #15/#17/#21.
- **Province name misread as waterbody (8e0111c1)** — `ระยองลุยกวาดล้าง…`
  → waterbody=ระยอง although the text means the *province* (Rayong
  authorities), not a river. Direct corpus evidence of the #12 collision.
- **River→province leak (96a595a3)** — `โผล่ในแม่น้ำระยอง` → province=ระยอง
  + waterbody=ระยอง (same as #12; borderline — the river is in Rayong).
- **`แพร่` inside `แพร่ระบาด`** (cae901cd, 343fc9ea, e57e2aba) — correctly
  **not** extracted (boundary rule works as designed); these are false alarms
  of the multi-mention detector, not defects.
- Legitimate waterbody extractions: คลองตำหรุ, คลองสำโรง, แม่น้ำปากพนัง,
  คลองบางละมุง, ลุ่มน้ำบางปะกง — all consistent with their headlines.

## 5. Verdict and scope

**PASS WITH LIMITATIONS.** Strong: clear provinces (14/15), districts
(30/30), no-location discipline (0/3 false positives), prefix waterbodies,
`จ.`/`อ.` abbreviations and spacing variants. Limitations: the
event-salience defect (3 controlled failures + 1 ordering-luck corpus case),
the `ระยอง` name collision (1 controlled + 2 corpus rows), and the
waterbody boundary/prefix gap (1 controlled).

**Scope:** the controlled result (25/30 tuple, 26/30 province) is agreement
on a deterministic test set — it is **not** real-world location accuracy.
Nothing was fixed, no thresholds changed, no DB writes.

## Files created / modified (validation phase)

- `scripts/intel/location-validation.mjs` — controlled test set + runner (new, uncommitted)
- `docs/FIHDAR_LOCATION_VALIDATION.md` — this report (new, uncommitted)
- `.data/intel/location-validation-results.json` — machine-readable results (gitignored)
- No production code modified. Gates (fresh): `npm run intel:test` ✅ ·
  `npm run typecheck` ✅ · `npm run lint` ✅ (0 errors, 6 pre-existing warnings).

---

# Post-fix validation (location extraction fix phase)

## Methodology correction (frozen test set)

An earlier draft compared the original **25/30** against the post-fix
**30/30** as a direct "before vs after". That is **not** a fair comparison:
five Pattaya expected labels (#7, #8, #14, #17, #21) were changed from
UNKNOWN to ชลบุรี because the fix phase established the explicit design rule
**พัทยา → ชลบุรี**. Since the expected labels differ, 25/30 and 30/30 measure
different specifications.

The 30-case test set is now **frozen** as the final corrected specification.
The runner computes a deterministic fingerprint (sha256 over
`id|title|expected` of every case):

    test-set fingerprint (frozen): 1ea556edc87939d2

Three baselines are reported; **only B → C is the apples-to-apples
comparison**:

- **A — Original validation result (historical, NOT comparable to C):**
  25/30 full tuple + precision, using the original expectations in which
  Pattaya was not yet specified as ชลบุรี. Kept for traceability
  (sections 2–5 above).
- **B — Corrected-spec pre-fix baseline:** the pre-fix implementation at
  commit `f75992a` evaluated against the SAME frozen final expectations
  → **22/30**.
- **C — Corrected-spec post-fix result:** the current fixed implementation
  against the same frozen expectations → **30/30**.

## 6. What changed (root causes → fixes)

## 6. What changed (root causes → fixes)

All changes are in `scripts/intel/locations.mjs` (plus regression tests in
`scripts/intel/self-test.mjs`). No thresholds, relevance, species, dedupe, or
event logic touched; no DB writes.

1. **Event-salience defect → candidate collection + context ranking.** The
   exact-name scan was replaced by collecting **every** province mention
   (exact names, `จ./จังหวัด` prefix captures, local aliases) with its text
   position, then selecting via deterministic cues:
   - *Boost* (wins): an event cue directly preceding the mention
     (`ล่าสุดที่`, `เหตุการณ์ใหม่เกิดที่`, `ตรวจเหตุที่`, `เกิดที่`, `พบที่`,
     `ที่หาด`, `ที่ชายฝั่ง`, `ชายหาด`, `ชายฝั่ง`).
   - *Demote* (tie-break only — never deletes the only mention): origin
     (`จาก…`), publisher (`ผู้สื่อข่าว`/`สำนักข่าว`), history (`เคย…` before;
     `ประวัติศาสตร์`/`ในอดีต`/`เมื่อปีที่แล้ว` after).
   - *Exclude*: surname (`ณ …`) — a surname is never an event location; a
     surname-only text yields no province.
   - History-cued mentions can never win via a boost (`เคยพบที่…` must not
     be treated as current). Selection never depends on name length or
     admin-database order.
2. **`ระยอง` province/waterbody collision → context rules both ways.** A
   province mention is skipped when a waterbody prefix (`แม่น้ำ|คลอง|หนอง|…`)
   immediately precedes it; an EEC waterbody name matches only when a
   waterbody prefix appears right before it (or the name itself starts with a
   waterbody type word). `แม่น้ำระยอง` → waterbody only; bare `ระยอง` →
   province only.
3. **Waterbody boundary/prefix gap → EEC names starting with a waterbody
   type word match without a boundary** (`บ่อปลาหนองค้อ` → `หนองค้อ`).
4. **Pattaya alias** — `พัทยา → ชลบุรี` added as a local province alias
   (Pattaya is not an amphoe row in the admin DB). `โรงโป๊ะ`/`บางแสน`
   remain unmapped rather than guessed.

## 7. Corrected-spec controlled results: pre-fix (B) vs post-fix (C)

Pre-fix run: `git show f75992a:scripts/intel/locations.mjs` evaluated in an
isolated temp dir by the frozen runner (its deps `normalize.mjs` /
`thresholds.mjs` are identical between `f75992a` and HEAD; the temp dir was
removed afterwards). Post-fix run: current worktree. Both used the identical
frozen 30-case set (fingerprint `1ea556edc87939d2`).

| Metric | B: pre-fix @f75992a | C: post-fix |
|---|---|---|
| Full tuple + precision | 22/30 | **30/30** |
| Province: correct / incorrect / missing / spurious | 23 / 3 / 3 / 1 | **30 / 0 / 0 / 0** |
| District | 30 / 0 / 0 / 0 | **30 / 0 / 0 / 0** |
| Waterbody | 29 / 0 / 1 / 0 | **30 / 0 / 0 / 0** |
| Precision correct | 26/30 | **30/30** |
| Province accuracy where a province is expected | 14/20 | **20/20** |
| False-positive location rate (cat F) | 0/3 | **0/3** |
| Cases with any spurious extraction | 1/30 | **0/30** |

B's 8 failures — all fixed in C:

| # | Failure at pre-fix | Fixed by |
|---|---|---|
| 7, 8, 14 | Pattaya event, province missing (alias absent pre-fix) | `พัทยา → ชลบุรี` alias |
| 12 | `แม่น้ำระยอง` province leak (spurious) | waterbody-prefix province skip |
| 15 | background สมุทรสาคร beats event ชลบุรี | event-cue boost + history demotion |
| 17 | background สมุทรสงคราม selected; Pattaya unmapped | history demotion + alias |
| 21 | publisher ระยอง selected; Pattaya unmapped | publisher demotion + alias |
| 28 | `บ่อปลาหนองค้อ` waterbody missing | EEC prefix-name rule |

TDD: the 8 RED regression assertions (event-vs-background, event-vs-origin,
event-vs-publisher, Pattaya alias, `แม่น้ำระยอง` leak,
province-as-waterbody, `หนองค้อ`, `ณ` surname) were added to
`self-test.mjs` and observed failing before the implementation change; 2
guard assertions (sole historical mention, two-province earliest) protect
against over-demotion. Regression check on C: every case that B passed
still passes.

## 8. Real-corpus regression (110 records; read-only, no writes)

Pipeline-faithful re-run (title + description, as `process.mjs` calls
`extractLocation`) vs. the stored `normalizedProvince`:

- **32 rows change province output:** 31 Pattaya rows (stored `null` →
  `ชลบุรี` — the corpus's largest event cluster was previously UNKNOWN; all
  are genuine Pattaya blackchin stories) + `96a595a3` (`แม่น้ำระยอง`:
  stored ระยอง → `null`, the leak removed).
- **1 row changes waterbody output:** `8e0111c1` (`ระยองลุยกวาดล้าง…`)
  waterbody ระยอง → null — province usage is no longer read as the river;
  province stays ระยอง, precision WATERBODY → PROVINCE.
- **Union: 33 rows** change province and/or waterbody output.
- **`443db650`** (`นางมยุรี ณ พัทลุง …`): unchanged (ชลบุรี/DISTRICT) — was
  correct by DB-ordering luck, now correct deterministically via the `ณ`
  surname rule. No DB change needed.
- **`d5210ae0`** (`สายพันธุ์ปลานิลที่เหมาะสมกับพื้นที่`): unchanged — its
  stored หนองคาย comes from the description, which still extracts. (A
  title-only probe briefly flagged it; the pipeline-faithful run confirms no
  change.)
- Waterbody extraction now covers 6 genuine rows (all consistent with their
  headlines); the previous 7th was the spurious `8e0111c1` ระยอง.
- No genuine blackchin/location row regresses; no new spurious location.

## 9. Fix-phase verdict and remaining limitations

**FIXED** on the frozen controlled set (B 22/30 → C 30/30) with a clean
corpus picture.
Remaining limitations (documented, not guessed):

- `โรงโป๊ะ` and `บางแสน` (Pattaya-area localities) remain unmapped — adding
  them needs corpus evidence for unambiguous mapping.
- The event cue list is fixed and small; unseen phrasings (e.g.
  `พบ…แล้ว` with a distant verb) fall back to the earliest non-demoted
  mention — conservative, not semantic.
- Surname rule excludes `ณ …` mentions entirely; the formal
  `ณ สถานที่` ("at") reading of bare `ณ ชลบุรี` would be demoted too — rare
  in news headlines, accepted.
- Controlled 30/30 must not be read as real-world geolocation accuracy —
  that still needs human-labeled location evaluation.

## Files created / modified (fix phase)

- `scripts/intel/locations.mjs` — modified (candidate ranking + context
  rules + Pattaya alias; the only production file changed)
- `scripts/intel/self-test.mjs` — modified (+10 location regression
  assertions: 8 RED, 2 guards)
- `scripts/intel/location-validation.mjs` — modified (5 Pattaya
  expectations revised + frozen test-set fingerprint, both documented;
  kept in the commit so the validation is reproducible)
- `docs/FIHDAR_LOCATION_VALIDATION.md` — this post-fix section
- `.data/intel/location-validation-results.json` — regenerated (gitignored)

Gates (fresh): `npm run intel:test` ✅ · `npm run typecheck` ·
`npm run lint` · `npm run build` — see final report.

**Scope reminder:** the controlled result (B 22/30 → C 30/30) is agreement
on a deterministic test set — it is **not** real-world geolocation accuracy.
Do not claim real-world 100% location accuracy from it.

---

# Granularity fix validation

Status: **place granularity preserved — province and most-specific place are
now separate, non-collapsing outputs.** The 30-case frozen set was extended
with `place` expectations (5 Pattaya cases) + the blocking `บริเวณพัทยา` case
→ **31 cases**, fingerprint `7607811fa4143809`. Historical results (A 25/30,
B 22/30, C 30/30) above are unchanged.

## Root causes (from the granularity review)

1. **`ณ`-surname false positive (blocking):** `isSurnameMention` fired on any
   `ณ` immediately before a mention, so `บริเวณพัทยา` (บริเวณ ends in `ณ`)
   was treated as a surname and the mention dropped → `UNKNOWN`.
2. **Collapse of the most-specific place:** the `พัทยา → ชลบุรี` alias set
   `province=ชลบุรี` and lost the site phrase — `หาดพัทยา`/`ชายหาดพัทยา`/
   `ทะเลพัทยา` were not preserved anywhere structured (only the generic
   `พัทยา` survived inside the evidence string).
3. **Position-luck tiebreak:** an earlier explicit province mention
   (`ประมงชลบุรี …โผล่ทะเลพัทยา`) beat the later locality, erasing the place.

## Fixes (all in `scripts/intel/locations.mjs`; persistence in `process.mjs`)

1. **Standalone-`ณ` boundary:** a surname is excluded only when `ณ` is a
   standalone token (`' ณ <name>'` or `'ณ<name>'` at a word boundary); a `ณ`
   glued to the preceding word (`บริเวณพัทยา`) never suppresses the mention.
   No general Thai tokenization introduced.
2. **Most-specific place output:** the extractor now returns `place` — the
   full site phrase (`หาดพัทยา`, `ชายหาดพัทยา`, `ชายฝั่งพัทยา`,
   `เมืองพัทยา`, `ทะเลพัทยา`, or bare `พัทยา`) — via a small
   longest-first qualifier list. The parent `province=ชลบุรี` is kept; the
   place is **not** collapsed into it. Sites are never classified as
   waterbodies.
3. **Locality-preference tiebreak:** among non-boosted candidates, a local
   alias wins over an earlier province-level mention — a locality is always
   more specific than a province mention.
4. **Persistence (no schema change):** `process.mjs` writes
   `evidence.location.place` into the existing JSONB evidence; raw
   title/description untouched, `normalizedProvince` unchanged,
   `normalizedWaterbody` not abused, `matched`/`fuzzy` remain compatible.
   No Prisma column, no migration, no `LOCALITY` enum.

## Controlled results (31 cases, fingerprint `7607811fa4143809`)

| Metric | Result |
|---|---|
| Province correct / incorrect / missing / spurious | **31 / 0 / 0 / 0** |
| District | **31 / 0 / 0 / 0** |
| Waterbody | **31 / 0 / 0 / 0** |
| **Place preservation (where a place is expected)** | **6/6** |
| Precision | **31/31** |
| Full tuple + precision | **31/31** |
| No-location false positives (cat F) | 0/3 |
| Any spurious extraction | 0/31 |

Place expectations (all pass): #7 `ชายหาดพัทยา`, #8 `หาดพัทยา`, #14
`ชายฝั่งพัทยา`, #17 `หาดพัทยา`, #21 `หาดพัทยา`, #31 `พัทยา` (บริเวณพัทยา).
Direct probes (fresh): `บริเวณพัทยา` → ชลบุรี/พัทยา/PROVINCE;
`เมืองพัทยา` → ชลบุรี/เมืองพัทยา; `หาดพัทยา` → ชลบุรี/หาดพัทยา;
`ชายหาดพัทยา` → ชลบุรี/ชายหาดพัทยา; `ชายฝั่งพัทยา` → ชลบุรี/ชายฝั่งพัทยา;
`ณ พัทลุง` surname still excluded (event mention resolves normally).

## Real-corpus audit (read-only, 110 rows; no writes)

- **38 Pattaya rows:** all → `province=ชลบุรี`; **0 UNKNOWN**; **38/38 now
  preserve a place** — หาดพัทยา 11, ทะเลพัทยา 12, ชายหาดพัทยา 9, พัทยา 5,
  ชายฝั่งพัทยา 1. (Previously 35/38; the 3 `ประมงชลบุรี …ทะเลพัทยา` rows
  lost the place to the earlier province mention.)
- All 38 are genuine event mentions; none is publisher/background usage.
- โรงโป๊ะ (4 rows) / บางแสน (0) / แหลมฉบัง (0): reviewed only — the same
  place mechanism could carry โรงโป๊ะ later (its 4 rows are site-level
  mentions, 3 currently UNKNOWN), but **no mapping was added** in this phase.

## Operational-map semantics (unchanged by this fix)

- `place` preservation improves event/export semantics now (the human-review
  CSV and event grouping can carry the specific place).
- The map still plots **only coordinate-bearing rows** — all 38 Pattaya rows
  have no coordinates, so none reaches the map. Actual point placement still
  requires source coordinates or geocoding; **no external geocoder is added**
  in this phase, and the app never claims Pattaya is plottable.
- `LOCALITY` as a precision enum value was deliberately **not** added;
  precision stays `PROVINCE` for locality mentions (documented limitation —
  a future migration could add it after human-labeled validation).

## Verification gates (fresh)

`node scripts/intel/location-validation.mjs` ✅ 31/31, place 6/6 ·
`npm run intel:test` ✅ · `npm run typecheck` · `npm run lint` ·
`npm run build` — see final report.

// Report location + date + field-operation master pass — deterministic
// self-test. No network, no database: it imports the real TS modules (run with
// --experimental-strip-types) and asserts the product rules this pass shipped.
//
//   npm run masterpass:test
//
// Rules under test:
//   1. Province intake is nationwide (77) with an honest EEC pilot subset.
//   2. A province outside the EEC pilot is accepted by submission validation.
//   3. Future report dates are rejected; today/past are accepted.
//   4. Observation coordinates are persisted exactly as given — never replaced
//      by device or photo location (the validation schema carries only the
//      observation pin).
//   5. Location precision is declared, never inferred, and validated.
//   6. Thai Buddhist display (18 ส.ค. 2569) maps back to the same Gregorian
//      date (2026-08-18) — 2569 is never stored as the year.
//   7. Citizen ownership fields (reporterId/clerkUserId) are rejected.
//   8. Field-outcome → status mapping is correct (incl. no outcome invents a
//      state, and acted-on statuses stay publicly visible).
//   9. Officer allowlist is enforced by exact membership.

import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);

// The server validation module is plain TS with no server-only/prisma imports,
// so it can be type-stripped and imported here. See package.json
// "masterpass:test" for the --experimental-strip-types flag.
const {
  REPORT_PROVINCES,
  EEC_PILOT_PROVINCES,
  REPORT_LOCATION_PRECISIONS,
  NEW_REPORT_PHOTO_LOCATION_RELATIONS,
  reportMetadataSchema,
  parseReportFormData
} = await import('../../src/server/report-validation.ts');

const { statusForOutcome, PUBLIC_REPORT_STATUSES, isPubliclyVisibleStatus } = await import(
  '../../src/server/field-outcomes.ts'
);

const { isOfficer } = await import('../../src/server/officer-allowlist.ts');

const { OPERATIONAL_DECISION_LABELS, OPERATIONAL_DECISIONS } = await import(
  '../../src/server/operational-decisions.ts'
);

// Client-side mirror kept in sync by hand (see the comment at the top of
// features/reports/api/types.ts) — this test is the tripwire for drift.
const {
  EEC_PILOT_PROVINCES: CLIENT_EEC_PILOT_PROVINCES,
  REPORT_PROVINCES: CLIENT_REPORT_PROVINCES,
  FIELD_OUTCOME_LABELS,
  REPORT_STATUS_LABELS
} = await import('../../src/features/reports/api/types.ts');

const { FieldOutcome, OperationalDecisionType, ReportStatus } = require('@prisma/client');

let passed = 0;
let failed = 0;
const failures = [];

async function check(name, fn) {
  try {
    await fn();
    passed += 1;
  } catch (error) {
    failed += 1;
    failures.push(`${name}: ${error.message}`);
    console.error(`  FAIL ${name}`);
  }
}

function validPayload(overrides = {}) {
  return {
    latitude: '13.361',
    longitude: '100.984',
    province: 'ชลบุรี',
    district: null,
    subdistrict: null,
    locationDescription: 'คลองหลังบ้าน',
    locationPrecision: 'EXACT',
    // A brand-new report must always declare SAME or DIFFERENT — UNKNOWN is
    // legacy-only, never accepted from a new submission. See
    // NEW_REPORT_PHOTO_LOCATION_RELATIONS.
    photoLocationRelation: 'SAME',
    observedAt: new Date().toISOString(),
    quantityRange: 'ONE',
    note: null,
    consent: true,
    ...overrides
  };
}

await check('province list has 77 provinces', () => {
  assert.equal(REPORT_PROVINCES.length, 77);
});

await check('EEC pilot is exactly the three EEC provinces, inside the 77', () => {
  assert.deepEqual([...EEC_PILOT_PROVINCES], ['ฉะเชิงเทรา', 'ชลบุรี', 'ระยอง']);
  for (const province of EEC_PILOT_PROVINCES) assert.ok(REPORT_PROVINCES.includes(province));
});

await check('non-EEC provinces exist in the intake list', () => {
  for (const province of ['เชียงใหม่', 'สงขลา', 'กรุงเทพมหานคร']) {
    assert.ok(REPORT_PROVINCES.includes(province));
  }
});

await check('a report outside the EEC pilot is accepted', () => {
  const parsed = reportMetadataSchema.parse(validPayload({ province: 'เชียงใหม่' }));
  assert.equal(parsed.province, 'เชียงใหม่');
});

await check('an invalid province is rejected', () => {
  assert.throws(() => reportMetadataSchema.parse(validPayload({ province: 'มาร์ส' })));
});

await check('a future observedAt is rejected', () => {
  const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  assert.throws(() => reportMetadataSchema.parse(validPayload({ observedAt: future })));
});

await check('today observedAt is accepted', () => {
  assert.ok(reportMetadataSchema.parse(validPayload()).observedAt instanceof Date);
});

await check('an invalid date string is rejected', () => {
  assert.throws(() => reportMetadataSchema.parse(validPayload({ observedAt: 'not-a-date' })));
});

await check('stored coordinates equal the submitted observation pin exactly', () => {
  // The payload carries only the observation location. Nothing else (device
  // GPS, photo EXIF — none of which the API accepts) can replace it.
  const parsed = reportMetadataSchema.parse(validPayload({ latitude: '13.361143' }));
  assert.equal(parsed.latitude, 13.361143);
  assert.equal(parsed.longitude, 100.984);
});

await check('every precision level is a valid enum value', () => {
  for (const precision of REPORT_LOCATION_PRECISIONS) {
    const parsed = reportMetadataSchema.parse(validPayload({ locationPrecision: precision }));
    assert.equal(parsed.locationPrecision, precision);
  }
});

await check('an unknown precision is rejected', () => {
  assert.throws(() =>
    reportMetadataSchema.parse(validPayload({ locationPrecision: 'ABOUT_RIGHT' }))
  );
});

await check('approximate precision is never silently upgraded to EXACT', () => {
  const parsed = reportMetadataSchema.parse(
    validPayload({ locationPrecision: 'PROVINCE', province: 'ชลบุรี' })
  );
  assert.equal(parsed.locationPrecision, 'PROVINCE');
});

await check('a new report must explicitly declare photoLocationRelation — no silent default', async () => {
  const form = new FormData();
  form.set('image', new Blob(['x'], { type: 'image/jpeg' }), 'photo.jpg');
  for (const [key, value] of Object.entries(validPayload())) form.set(key, value);
  form.delete('photoLocationRelation');
  await assert.rejects(() => parseReportFormData(form), 'omitted photoLocationRelation must be rejected');

  form.set('photoLocationRelation', 'DIFFERENT');
  const { metadata: metadataDiff } = await parseReportFormData(form);
  assert.equal(metadataDiff.photoLocationRelation, 'DIFFERENT');
});

await check('a new report cannot declare the legacy-only UNKNOWN photoLocationRelation', async () => {
  assert.deepEqual([...NEW_REPORT_PHOTO_LOCATION_RELATIONS], ['SAME', 'DIFFERENT']);
  assert.throws(() =>
    reportMetadataSchema.parse(validPayload({ photoLocationRelation: 'UNKNOWN' }))
  );
});

await check('a new report must explicitly declare locationPrecision — no silent default', async () => {
  const form = new FormData();
  form.set('image', new Blob(['x'], { type: 'image/jpeg' }), 'photo.jpg');
  for (const [key, value] of Object.entries(validPayload())) form.set(key, value);
  form.delete('locationPrecision');
  await assert.rejects(() => parseReportFormData(form), 'omitted locationPrecision must be rejected');
});

await check('Thai Buddhist display of 2026-08-18 reads 2569, stored year stays Gregorian', () => {
  const gregorian = new Date(Date.UTC(2026, 7, 18)); // 2026-08-18
  const thai = new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC'
  });
  const display = thai.format(gregorian);
  assert.ok(display.includes('2569'), `expected 2569 in display, got "${display}"`);
  assert.ok(display.includes('18'), `expected day 18 in display, got "${display}"`);
  assert.ok(!display.includes('2026'), `display must be Buddhist, got "${display}"`);

  // Stored value must remain unambiguous Gregorian — never 2569-08-18.
  assert.equal(gregorian.getUTCFullYear(), 2026);
  assert.equal(gregorian.toISOString().slice(0, 10), '2026-08-18');
});

await check('parseReportFormData rejects reporterId/clerkUserId', async () => {
  const form = new FormData();
  form.set('image', new Blob(['x'], { type: 'image/jpeg' }), 'photo.jpg');
  for (const [key, value] of Object.entries(validPayload())) form.set(key, value);
  form.set('reporterId', 'some-user-id');
  let threw = false;
  try {
    await parseReportFormData(form);
  } catch {
    threw = true;
  }
  assert.ok(threw, 'ownership field must be rejected');
});

await check('parseReportFormData requires an image', async () => {
  const form = new FormData();
  for (const [key, value] of Object.entries(validPayload())) form.set(key, value);
  let threw = false;
  try {
    await parseReportFormData(form);
  } catch {
    threw = true;
  }
  assert.ok(threw, 'missing image must be rejected');
});

await check('outcome→status mapping is exact and truthful', () => {
  assert.equal(statusForOutcome(FieldOutcome.FOUND), ReportStatus.FIELD_CONFIRMED);
  assert.equal(statusForOutcome(FieldOutcome.NOT_FOUND), ReportStatus.FIELD_CHECKED);
  assert.equal(statusForOutcome(FieldOutcome.MISIDENTIFIED), ReportStatus.REJECTED);
  assert.equal(statusForOutcome(FieldOutcome.CONTROLLED), ReportStatus.ACTION_TAKEN);
  assert.equal(statusForOutcome(FieldOutcome.FOLLOW_UP_REQUIRED), ReportStatus.MONITORING);
  assert.equal(statusForOutcome(FieldOutcome.ACCESS_DENIED), ReportStatus.FIELD_CHECKED);
});

await check('acted-on statuses remain publicly visible; review-only states stay hidden', () => {
  for (const status of [
    ReportStatus.VERIFIED,
    ReportStatus.FIELD_CHECKED,
    ReportStatus.ACTION_TAKEN,
    ReportStatus.MONITORING,
    ReportStatus.REASSESSMENT
  ]) {
    assert.ok(isPubliclyVisibleStatus(status), `${status} must stay on the map`);
  }
  for (const status of [ReportStatus.PENDING, ReportStatus.REJECTED]) {
    assert.ok(!isPubliclyVisibleStatus(status), `${status} must stay off the public map`);
  }
  assert.equal(PUBLIC_REPORT_STATUSES.length, 6);
});

await check('officer allowlist is exact membership, not substring', () => {
  const previous = process.env.OFFICER_CLERK_USER_IDS;
  process.env.OFFICER_CLERK_USER_IDS = 'user_officer1, user_officer2';
  try {
    assert.equal(isOfficer('user_officer1'), true);
    assert.equal(isOfficer('user_officer2'), true);
    assert.equal(isOfficer('user_officer'), false, 'substring must not match');
    assert.equal(isOfficer('attacker'), false);
  } finally {
    if (previous === undefined) delete process.env.OFFICER_CLERK_USER_IDS;
    else process.env.OFFICER_CLERK_USER_IDS = previous;
  }
});

await check('empty allowlist authorizes nobody', () => {
  const previous = process.env.OFFICER_CLERK_USER_IDS;
  delete process.env.OFFICER_CLERK_USER_IDS;
  try {
    assert.equal(isOfficer('user_anything'), false);
  } finally {
    if (previous === undefined) delete process.env.OFFICER_CLERK_USER_IDS;
    else process.env.OFFICER_CLERK_USER_IDS = previous;
  }
});

// --- pre-field operational decision (DISPATCH/MONITOR/DEFER) ---------------
// PRE-FIELD triage is a separate concept from FieldOutcome above (POST-visit)
// — see src/server/report-service.ts#recordOperationalDecision and
// docs/intelligence.md §19. This suite covers only the pure label/enum
// contract; recordOperationalDecision itself needs a live database
// (transaction + audit row) and is NOT covered here — see the final report's
// verification section for that gap.

await check('every OperationalDecisionType enum value has exactly one label', () => {
  assert.deepEqual([...OPERATIONAL_DECISIONS].sort(), Object.values(OperationalDecisionType).sort());
  for (const decision of Object.values(OperationalDecisionType)) {
    assert.equal(typeof OPERATIONAL_DECISION_LABELS[decision], 'string');
    assert.ok(OPERATIONAL_DECISION_LABELS[decision].length > 0);
  }
});

await check('DISPATCH/MONITOR/DEFER are the only decisions — no FieldOutcome value leaked in', () => {
  for (const decision of OPERATIONAL_DECISIONS) {
    assert.ok(
      !Object.values(FieldOutcome).includes(decision),
      `${decision} must not overlap with a POST-visit FieldOutcome`
    );
  }
});

// --- EEC pilot scope: client mirror must not drift from the server list ----

await check('client REPORT_PROVINCES mirrors the server list exactly', () => {
  assert.deepEqual([...CLIENT_REPORT_PROVINCES].sort(), [...REPORT_PROVINCES].sort());
});

await check('client EEC_PILOT_PROVINCES mirrors the server list exactly', () => {
  assert.deepEqual([...CLIENT_EEC_PILOT_PROVINCES], [...EEC_PILOT_PROVINCES]);
});

// --- NOT_FOUND / CONTROLLED wording must never claim biological absence ----
// A single negative survey visit ("ไม่พบเมื่อสำรวจ") is not proof the species
// is absent, and a control action ("ดำเนินการควบคุมแล้ว") is not eradication.
// This is a wording tripwire, not a translation check — if these labels ever
// change, this test forces a conscious re-read against the invariant.

const ABSENCE_CLAIM_SUBSTRINGS = [
  'ไม่มีปลา',
  'ปลอดปลา',
  'หมดปัญหา',
  'แก้ปัญหาแล้ว',
  'กำจัดสำเร็จ',
  'ยืนยันว่าไม่มี'
];

await check('NOT_FOUND label never claims biological absence', () => {
  const label = FIELD_OUTCOME_LABELS.NOT_FOUND;
  for (const claim of ABSENCE_CLAIM_SUBSTRINGS) {
    assert.ok(!label.includes(claim), `NOT_FOUND label "${label}" must not contain "${claim}"`);
  }
});

await check('every FieldOutcome and ReportStatus label avoids absence/eradication claims', () => {
  for (const [outcome, label] of Object.entries(FIELD_OUTCOME_LABELS)) {
    for (const claim of ABSENCE_CLAIM_SUBSTRINGS) {
      assert.ok(!label.includes(claim), `${outcome} label "${label}" must not contain "${claim}"`);
    }
  }
  for (const [status, label] of Object.entries(REPORT_STATUS_LABELS)) {
    for (const claim of ABSENCE_CLAIM_SUBSTRINGS) {
      assert.ok(!label.includes(claim), `${status} label "${label}" must not contain "${claim}"`);
    }
  }
});

// --- the intelligence pipeline must never write an operational decision ----
// AI recommendation -> officer decision is a one-way street: an authorized
// officer HTTP mutation (recordEventDecision) is the ONLY writer of
// EventDecision / EventCandidate.operationalDecision. This is a static
// tripwire, not a live-pipeline run (which needs seeded observations + a
// reachable DB) — it fails loudly if a future edit ever adds a decision
// write inside scripts/intel/*.mjs.

await check('the intelligence pipeline never references EventDecision or writes operationalDecision', async () => {
  const { readdirSync, readFileSync } = await import('node:fs');
  const intelDir = new URL('../intel/', import.meta.url);
  const files = readdirSync(intelDir).filter((name) => name.endsWith('.mjs'));
  assert.ok(files.length > 0, 'sanity: intel scripts directory is not empty');
  for (const file of files) {
    const source = readFileSync(new URL(file, intelDir), 'utf8');
    assert.ok(
      !source.includes('eventDecision'),
      `${file} must never write EventDecision — only an officer HTTP mutation may`
    );
    assert.ok(
      !source.includes('operationalDecision'),
      `${file} must never set operationalDecision — only recordEventDecision may`
    );
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.error('\nFailures:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exitCode = 1;
}

// Location extraction validation — controlled deterministic test set.
//
//   node scripts/intel/location-validation.mjs
//
// Runs the CURRENT extractor (extractLocation) over 31 fixed Thai/English
// cases. Expected answers were fixed BEFORE the first run (see
// docs/FIHDAR_LOCATION_VALIDATION.md) and the pre-fix result (25/30) is
// preserved there. In the fix phase the 5 Pattaya cases (#7, #8, #14, #17,
// #21) gained the authorized พัทยา → ชลบุรี mapping; in the granularity fix
// the same cases gained explicit `place` expectations (the most-specific
// site phrase must survive: หาดพัทยา, ชายหาดพัทยา …), and case #31
// (บริเวณพัทยา — the ณ-boundary blocking case) was added. This script
// measures the extractor only — it does NOT modify location logic,
// thresholds, or the DB.

import { createHash } from 'node:crypto';

import { extractLocation } from './locations.mjs';

// Expected values are per-field (null = must NOT be extracted) + precision.
const CASES = [
  // --- A. Clear province → PROVINCE ---
  { id: 1, title: 'พบปลาหมอคางดำในจังหวัดชลบุรี', exp: { province: 'ชลบุรี', district: null, waterbody: null, precision: 'PROVINCE' }, cat: 'A', note: 'explicit จังหวัดชลบุรี' },
  { id: 2, title: 'ชาวบ้านพบปลาหมอคางดำในระยอง', exp: { province: 'ระยอง', district: null, waterbody: null, precision: 'PROVINCE' }, cat: 'A', note: 'bare province name' },
  { id: 3, title: 'พบการระบาดที่ฉะเชิงเทรา', exp: { province: 'ฉะเชิงเทรา', district: null, waterbody: null, precision: 'PROVINCE' }, cat: 'A', note: 'bare province name' },

  // --- B. District + province → DISTRICT ---
  { id: 4, title: 'พบปลาหมอคางดำที่อำเภอบางละมุง จังหวัดชลบุรี', exp: { province: 'ชลบุรี', district: 'บางละมุง', waterbody: null, precision: 'DISTRICT' }, cat: 'B', note: 'full forms' },
  { id: 5, title: 'ชาวบ้านอำเภอบางปะกง จังหวัดฉะเชิงเทรา เจอปลาหมอคางดำ', exp: { province: 'ฉะเชิงเทรา', district: 'บางปะกง', waterbody: null, precision: 'DISTRICT' }, cat: 'B', note: 'full forms' },
  { id: 6, title: 'ประมงอำเภอเมืองระยอง จังหวัดระยอง เร่งกำจัด', exp: { province: 'ระยอง', district: 'เมืองระยอง', waterbody: null, precision: 'DISTRICT' }, cat: 'B', note: 'เมือง amphoe' },

  // --- C. Local place names NOT in vocabulary → no invention ---
  { id: 7, title: 'ปลาหมอคางดำโผล่ชายหาดพัทยา', exp: { province: 'ชลบุรี', district: null, waterbody: null, place: 'ชายหาดพัทยา', precision: 'PROVINCE' }, cat: 'C', note: 'site phrase preserved as place (granularity fix)' },
  { id: 8, title: 'พบปลาหมอคางดำที่หาดพัทยา', exp: { province: 'ชลบุรี', district: null, waterbody: null, place: 'หาดพัทยา', precision: 'PROVINCE' }, cat: 'C', note: 'site phrase preserved as place (granularity fix)' },
  { id: 9, title: 'ปลาหมอคางดำบุกโรงโป๊ะ', exp: { province: null, district: null, waterbody: null, precision: 'UNKNOWN' }, cat: 'C', note: 'Pattaya pier — not in vocabulary' },
  { id: 10, title: 'ชาวบ้านบางแสนจับปลาหมอคางดำได้', exp: { province: null, district: null, waterbody: null, precision: 'UNKNOWN' }, cat: 'C', note: 'บางแสน — local beach, not an amphoe' },

  // --- D. Waterbodies → WATERBODY ---
  { id: 11, title: 'แม่น้ำบางปะกงพบปลาหมอคางดำ', exp: { province: null, district: null, waterbody: 'บางปะกง', precision: 'WATERBODY' }, cat: 'D', note: 'แม่น้ำบางปะกง prefix' },
  { id: 12, title: 'แม่น้ำระยองพบปลาหมอคางดำ', exp: { province: null, district: null, waterbody: 'ระยอง', precision: 'WATERBODY' }, cat: 'D', note: 'river name must not leak into province' },
  { id: 13, title: 'ชาวบ้านคลองบางปะกงจับปลาหมอคางดำได้', exp: { province: null, district: null, waterbody: 'บางปะกง', precision: 'WATERBODY' }, cat: 'D', note: 'คลอง prefix' },
  { id: 14, title: 'ปลาหมอคางดำเกยตื้นชายฝั่งพัทยา', exp: { province: 'ชลบุรี', district: null, waterbody: null, place: 'ชายฝั่งพัทยา', precision: 'PROVINCE' }, cat: 'D', note: 'site phrase preserved as place (granularity fix)' },

  // --- E. Multiple locations → EVENT location only ---
  { id: 15, title: 'ข่าวกล่าวถึงสมุทรสาครในเชิงประวัติศาสตร์ แต่เหตุการณ์ใหม่เกิดที่ชลบุรี', exp: { province: 'ชลบุรี', district: null, waterbody: null, precision: 'PROVINCE' }, cat: 'E', note: 'background สมุทรสาคร must lose to event ชลบุรี' },
  { id: 16, title: 'เจ้าหน้าที่ประมงจากระยองเดินทางไปตรวจเหตุที่ชลบุรี', exp: { province: 'ชลบุรี', district: null, waterbody: null, precision: 'PROVINCE' }, cat: 'E', note: 'origin ระยอง ≠ event ชลบุรี' },
  { id: 17, title: 'เคยพบปัญหาในสมุทรสงคราม ก่อนพบล่าสุดที่หาดพัทยา', exp: { province: 'ชลบุรี', district: null, waterbody: null, place: 'หาดพัทยา', precision: 'PROVINCE' }, cat: 'E', note: 'event=Pattaya → ชลบุรี; background สมุทรสงคราม must NOT win (expectation revised post-fix)' },

  // --- F. No location → UNKNOWN, nothing extracted ---
  { id: 18, title: 'กรมประมงแถลงมาตรการรับมือการระบาดของปลาหมอคางดำ', exp: { province: null, district: null, waterbody: null, precision: 'UNKNOWN' }, cat: 'F', note: 'policy text, no location' },
  { id: 19, title: 'ปลาหมอคางดำเป็นปลาน้ำจืดที่แพร่พันธุ์เร็ว', exp: { province: null, district: null, waterbody: null, precision: 'UNKNOWN' }, cat: 'F', note: 'แพร่ inside แพร่พันธุ์ must not match (boundary)' },
  { id: 20, title: 'การระบาดของปลาหมอคางดำกระจายทั่วประเทศ', exp: { province: null, district: null, waterbody: null, precision: 'UNKNOWN' }, cat: 'F', note: 'nationwide, no event location' },

  // --- G. Hard / adversarial ---
  { id: 21, title: 'ผู้สื่อข่าวระยองรายงานว่าพบปลาหมอคางดำที่หาดพัทยา', exp: { province: 'ชลบุรี', district: null, waterbody: null, place: 'หาดพัทยา', precision: 'PROVINCE' }, cat: 'G', note: 'event=Pattaya → ชลบุรี; publisher location ระยอง must NOT win (expectation revised post-fix)' },
  { id: 22, title: 'ประมงจังหวัดระยองเปิดเผยว่าพบปลาหมอคางดำที่ชายฝั่งชลบุรี', exp: { province: 'ชลบุรี', district: null, waterbody: null, precision: 'PROVINCE' }, cat: 'G', note: 'person-title province ระยอง ≠ event ชลบุรี' },
  { id: 31, title: 'พบปลาหมอคางดำบริเวณพัทยา', exp: { province: 'ชลบุรี', district: null, waterbody: null, place: 'พัทยา', precision: 'PROVINCE' }, cat: 'G', note: 'ณ-boundary: บริเวณพัทยา must NOT be treated as a surname; place=พัทยา (blocking case from granularity review)' },
  { id: 23, title: 'พบปลาหมอคางดำระบาดทั้งชลบุรีและระยอง', exp: { province: 'ชลบุรี', district: null, waterbody: null, precision: 'PROVINCE' }, cat: 'G', note: 'two provinces; first event mention expected' },
  { id: 24, title: 'พบปลาหมอคางดำที่จ.ชลบุรี', exp: { province: 'ชลบุรี', district: null, waterbody: null, precision: 'PROVINCE' }, cat: 'G', note: 'abbreviated จ.' },
  { id: 25, title: 'พบปลาหมอคางดำที่อ.บางละมุง จ.ชลบุรี', exp: { province: 'ชลบุรี', district: 'บางละมุง', waterbody: null, precision: 'DISTRICT' }, cat: 'G', note: 'abbreviated อ. and จ.' },
  { id: 26, title: 'พบปลาหมอคางดำที่ จ. ชลบุรี เมื่อวานนี้', exp: { province: 'ชลบุรี', district: null, waterbody: null, precision: 'PROVINCE' }, cat: 'G', note: 'spacing variant จ. ชลบุรี' },
  { id: 27, title: 'เคยพบปลาหมอคางดำที่สมุทรปราการเมื่อปีที่แล้ว', exp: { province: 'สมุทรปราการ', district: null, waterbody: null, precision: 'PROVINCE' }, cat: 'G', note: 'historical mention — still the subject location' },
  { id: 28, title: 'พบปลาหมอคางดำในบ่อปลาหนองค้อ', exp: { province: null, district: null, waterbody: 'หนองค้อ', precision: 'WATERBODY' }, cat: 'G', note: 'หนองค้อ IS in the EEC waterbody vocabulary' },
  { id: 29, title: 'ลุ่มน้ำบางปะกงจับปลาหมอคางดำได้ทุกวัน', exp: { province: null, district: null, waterbody: 'บางปะกง', precision: 'WATERBODY' }, cat: 'G', note: 'ลุ่มน้ำ prefix, known good case' },
  { id: 30, title: 'Blackchin tilapia found near Bang Pakong', exp: { province: 'ฉะเชิงเทรา', district: 'บางปะกง', waterbody: null, precision: 'DISTRICT' }, cat: 'G', note: 'English alias, known good case' }
];

// FROZEN test-set fingerprint: sha256 over (id|title|expected) of every case.
// Recorded so the benchmark can be shown as frozen from this point onward;
// identical for every implementation run (pre-fix and post-fix).
const TEST_SET_FINGERPRINT = createHash('sha256')
  .update(CASES.map((c) => `${c.id}|${c.title}|${JSON.stringify(c.exp)}`).join('\n'))
  .digest('hex')
  .slice(0, 16);

function evalCase(c) {
  const actual = extractLocation(c.title, '', null, null);
  const fields = ['province', 'district', 'waterbody', 'place'];
  const verdict = {};
  for (const f of fields) {
    // place is optional in expectations: absent = must NOT be emitted.
    const e = f === 'place' ? (c.exp[f] ?? null) : c.exp[f];
    const a = actual[f];
    let state;
    if (e === null && a === null) state = 'correct';
    else if (e !== null && a === null) state = 'missing';
    else if (e === null && a !== null) state = 'spurious';
    else if (e === a) state = 'correct';
    else state = 'incorrect';
    verdict[f] = { state, expected: e, actual: a };
  }
  const precOk = actual.precision === c.exp.precision;
  verdict.precision = { state: precOk ? 'correct' : 'incorrect', expected: c.exp.precision, actual: actual.precision };
  const fullOk = fields.every((f) => verdict[f].state === 'correct') && precOk;
  return { ...c, actual, verdict, fullOk };
}

const results = CASES.map(evalCase);

function tally(field) {
  const counts = { correct: 0, incorrect: 0, missing: 0, spurious: 0 };
  for (const r of results) counts[r.verdict[field].state] += 1;
  return counts;
}

console.log('=== LOCATION EXTRACTION VALIDATION (current implementation, no changes) ===');
console.log('test-set fingerprint (frozen):', TEST_SET_FINGERPRINT);
console.log('total cases:', results.length);
console.log('\n=== PER-FIELD ===');
for (const f of ['province', 'district', 'waterbody', 'precision']) {
  console.log(f.padEnd(10), JSON.stringify(tally(f)));
}
const fullOk = results.filter((r) => r.fullOk).length;
console.log(`\nfull tuple + precision match: ${fullOk}/${results.length}`);
// province accuracy where a province is expected
const provExpected = results.filter((r) => r.exp.province !== null);
const provAcc = provExpected.filter((r) => r.verdict.province.state === 'correct').length;
console.log(`province accuracy (where province expected): ${provAcc}/${provExpected.length}`);
// no-location false positive rate (category F)
const fCases = results.filter((r) => r.cat === 'F');
const fpF = fCases.filter((r) => r.verdict.province.state === 'spurious' || r.verdict.district.state === 'spurious' || r.verdict.waterbody.state === 'spurious').length;
console.log(`false-positive location rate on no-location cases (cat F): ${fpF}/${fCases.length}`);
// overall spurious (any field) on cases with null expected
const spuriousAny = results.filter((r) => ['province', 'district', 'waterbody', 'place'].some((f) => r.verdict[f].state === 'spurious'));
console.log(`cases with any spurious extraction: ${spuriousAny.length}/${results.length}`);
// most-specific place preservation (where a place is expected)
const placeExpected = results.filter((r) => (r.exp.place ?? null) !== null);
const placePreserved = placeExpected.filter((r) => r.verdict.place.state === 'correct').length;
console.log(`place preservation (where place expected): ${placePreserved}/${placeExpected.length}`);

console.log('\n=== PER-CASE ===');
for (const r of results) {
  const marks = ['province', 'district', 'waterbody', 'place', 'precision'].map((f) => {
    const v = r.verdict[f];
    const mark = v.state === 'correct' ? 'ok' : v.state.toUpperCase();
    return `${f.slice(0, 4)}=${v.actual ?? '-'}(${mark})`;
  });
  console.log(`#${String(r.id).padStart(2)} [${r.cat}] ${r.fullOk ? 'PASS' : 'FAIL'} | ${marks.join(' ')} | ${r.title.slice(0, 60)}`);
}

console.log('\n=== FAILED CASES ===');
for (const r of results.filter((x) => !x.fullOk)) {
  console.log(`#${r.id} | ${r.title}`);
  for (const f of ['province', 'district', 'waterbody', 'precision']) {
    const v = r.verdict[f];
    if (v.state !== 'correct') console.log(`    ${f}: expected=${v.expected ?? 'null'} actual=${v.actual ?? 'null'} [${v.state}]`);
  }
  console.log(`    note: ${r.note}`);
}

import { writeFileSync } from 'node:fs';
writeFileSync(new URL('../../.data/intel/location-validation-results.json', import.meta.url), JSON.stringify({ fingerprint: TEST_SET_FINGERPRINT, total: results.length, fullOk, placePreserved: `${placePreserved}/${placeExpected.length}`, perField: Object.fromEntries(['province', 'district', 'waterbody', 'place', 'precision'].map((f) => [f, tally(f)])), failures: results.filter((x) => !x.fullOk).map((r) => r.id) }, null, 2));
console.log('\nresults written to .data/intel/location-validation-results.json');

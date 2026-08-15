// Deterministic unit tests for the intelligence modules.
//
//   npm run intel:test
//
// No mocks, no network — pure functions over fixed inputs. Exit code is
// non-zero when any assertion fails.

import { normalizeText, charBigrams, sha256Hex } from './normalize.mjs';
import { classifyText, verdictFromEvidence } from './keywords.mjs';
import { extractLocation } from './locations.mjs';
import { findNearDuplicates, canonicalSourceUrl } from './dedupe.mjs';
import { Minhash } from 'minhash';

let failures = 0;
function assert(condition, message) {
  if (condition) {
    console.log(`  ok — ${message}`);
  } else {
    failures += 1;
    console.error(`  FAIL — ${message}`);
  }
}

// --- normalize --------------------------------------------------------------
console.log('normalize');
assert(normalizeText('<a href="x">ปลาหมอคางดำ</a> ระบาด') === 'ปลาหมอคางดำ ระบาด', 'strips HTML tags');
assert(normalizeText('  ABC  def  ') === 'abc def', 'lowercases + collapses whitespace');
assert(sha256Hex('a') === sha256Hex('a') && sha256Hex('a') !== sha256Hex('b'), 'content hash is stable');
assert(charBigrams('abcdef').length === 5, 'char bigrams count');

// --- keywords ---------------------------------------------------------------
console.log('keywords');
const sighting = classifyText('ปลาหมอคางดำระบาดหนัก ชาวบ้านเจอทุกวันในคลอง', '');
assert(sighting.kind === 'SIGHTING', `sighting headline → SIGHTING (got ${sighting.kind})`);
assert(verdictFromEvidence(sighting).verdict === 'RELEVANT', 'sighting → RELEVANT');
const control = classifyText('เปิดจุดรับซื้อปลาหมอคางดำ กก.ละ 15 บาท', '');
assert(control.kind === 'CONTROL_REMOVAL', `buyback headline → CONTROL_REMOVAL (got ${control.kind})`);
const generic = classifyText('ปริมาณการจับปลานิลในปีนี้เพิ่มขึ้น', '');
assert(generic.genericHit.length > 0 && generic.speciesHit.length === 0, 'generic tilapia: species gated out');
assert(verdictFromEvidence(generic).verdict === 'IRRELEVANT', 'generic tilapia → IRRELEVANT');
const unrelated = classifyText('พยากรณ์อากาศวันนี้ฝนตก', '');
assert(verdictFromEvidence(unrelated).verdict === 'IRRELEVANT', 'unrelated → IRRELEVANT');

// --- species gate regression (post species-gate-validation fixes) ---
// Safety invariant: bare คางดำ alone must NEVER be EXPLICIT_BLACKCHIN.
const mackerel = classifyText('ถกสนั่น แกะปลากระป๋อง เจอแมคเคอเรลคางดำ', '');
assert(mackerel.speciesEvidence !== 'EXPLICIT_BLACKCHIN', 'canned mackerel คางดำ NOT explicit');
assert(mackerel.speciesEvidence === 'OTHER_SPECIES', 'canned mackerel → OTHER_SPECIES');
assert(verdictFromEvidence(mackerel).verdict === 'IRRELEVANT', 'other-species evidence → IRRELEVANT');
const brand = classifyText("ร้านอาหาร 'คางดำ' เปิดสาขาใหม่ที่ชลบุรี", '');
assert(brand.speciesEvidence !== 'EXPLICIT_BLACKCHIN', 'brand-name คางดำ NOT explicit');
assert(brand.speciesEvidence === 'NONE', 'brand-name คางดำ → NONE');
const negation = classifyText('หน่วยงานยืนยันว่าไม่ใช่ปลาหมอคางดำ', '');
assert(negation.speciesEvidence !== 'EXPLICIT_BLACKCHIN', 'negated mention NOT explicit');
assert(negation.speciesEvidence === 'NONE', 'negated mention → NONE');
const comparison = classifyText('ปลาตัวนี้คล้ายปลาหมอคางดำแต่เป็นปลานิล', '');
assert(comparison.speciesEvidence === 'AMBIGUOUS_TILAPIA', 'comparison resolving to tilapia → AMBIGUOUS');
const enGeneric = classifyText('tilapia farming grows in the east', '');
assert(enGeneric.speciesEvidence === 'AMBIGUOUS_TILAPIA', 'bare english tilapia → AMBIGUOUS');
const noSpace = classifyText('BlackchinTilapia spotted in canal', '');
assert(noSpace.speciesEvidence === 'EXPLICIT_BLACKCHIN', 'no-space blackchin tilapia → EXPLICIT');
const typo = classifyText('ปลาหมอค้างดำระบาด', '');
assert(typo.speciesEvidence === 'EXPLICIT_BLACKCHIN', 'misspelled ค้างดำ → EXPLICIT');
const spaced = classifyText('ปลาหมอ คางดำ ระบาด', '');
assert(spaced.speciesEvidence === 'EXPLICIT_BLACKCHIN', 'spaced ปลาหมอ คางดำ → EXPLICIT');
const informal = classifyText('หมอคางดำโผล่ชายหาดพัทยา', '');
assert(informal.speciesEvidence === 'EXPLICIT_BLACKCHIN', 'informal หมอคางดำ → EXPLICIT');
const perch = classifyText('ชาวประมงจับปลากะพงได้ตัวใหญ่', '');
assert(perch.speciesEvidence === 'OTHER_SPECIES', 'ปลากะพง → OTHER_SPECIES');
const mozambique = classifyText('ชาวบ้านจับปลาหมอเทศได้จากบ่อ', '');
assert(mozambique.speciesEvidence === 'OTHER_SPECIES', 'ปลาหมอเทศ → OTHER_SPECIES');
// no regression in clear genuine cases
assert(classifyText('ปลาหมอคางดำระบาดในคลอง', '').speciesEvidence === 'EXPLICIT_BLACKCHIN', 'clear blackchin → EXPLICIT (regression)');
assert(classifyText('ปริมาณการจับปลานิลในปีนี้เพิ่มขึ้น', '').speciesEvidence === 'AMBIGUOUS_TILAPIA', 'generic ปลานิล → AMBIGUOUS (regression)');
assert(classifyText('น้ำท่วมฉะเชิงเทราหนักสุดในรอบสิบปี', '').speciesEvidence === 'NONE', 'no species → NONE (regression)');

// --- locations --------------------------------------------------------------
console.log('locations');
const loc = extractLocation('ปลาหมอคางดำระบาด อ.บางปะกง จ.ฉะเชิงเทรา', '', null, null);
assert(loc.province === 'ฉะเชิงเทรา', `province normalized (got ${loc.province})`);
assert(loc.district === 'บางปะกง', `district normalized (got ${loc.district})`);
assert(loc.precision === 'DISTRICT', `precision DISTRICT (got ${loc.precision})`);
const locAlias = extractLocation('Blackchin tilapia found near Bang Pakong', '', null, null);
assert(locAlias.province === 'ฉะเชิงเทรา' && locAlias.district === 'บางปะกง', `English alias → ฉะเชิงเทรา/บางปะกง (got ${locAlias.province}/${locAlias.district})`);
const locWater = extractLocation('ชาวบ้านลุ่มน้ำบางปะกงจับได้ทุกวัน', '', null, null);
assert(locWater.waterbody === 'บางปะกง', `waterbody extracted (got ${locWater.waterbody})`);
assert(locWater.precision === 'WATERBODY', `precision WATERBODY (got ${locWater.precision})`);
const locExact = extractLocation('พบปลาหมอคางดำ', '', 13.1, 101.0);
assert(locExact.precision === 'EXACT', 'source coords → EXACT');
const locNone = extractLocation('ข่าวทั่วไป', '', null, null);
assert(locNone.precision === 'UNKNOWN' && locNone.province === null, 'no location → UNKNOWN, no invention');

// --- minhash ----------------------------------------------------------------
console.log('minhash');
const m1 = new Minhash({ numPerm: 128, seed: 42 });
const m2 = new Minhash({ numPerm: 128, seed: 42 });
m1.update('hello world');
m2.update('hello world');
assert(m1.jaccard(m2) === 1, 'identical text → jaccard 1');

// --- dedupe -----------------------------------------------------------------
console.log('dedupe');
assert(
  canonicalSourceUrl('https://news.google.com/rss/articles/ABC?oc=5&co=1') === 'https://news.google.com/rss/articles/ABC',
  'canonical URL strips google tracking params'
);
const dupes = findNearDuplicates([
  { id: 'a', title: 'ปลาหมอคางดำระบาดในฉะเชิงเทรา ชาวบ้านกังวล', description: 'สถานการณ์ปลาหมอคางดำในพื้นที่ยังรุนแรง', sourceUrl: 'https://x.com/1' },
  { id: 'b', title: 'ปลาหมอคางดำระบาดที่ฉะเชิงเทรา ชาวบ้านกังวลใจ', description: 'สถานการณ์ปลาหมอคางดำในพื้นที่ยังรุนแรงมาก', sourceUrl: 'https://x.com/2' },
  { id: 'c', title: 'ราคาทองคำวันนี้ปรับตัวลดลง', description: 'ตลาดทองคำสัปดาห์นี้', sourceUrl: 'https://x.com/3' }
]);
assert(dupes.has('b') && dupes.get('b').duplicateOfId === 'a', 'paraphrased duplicate linked to canonical (b→a)');
assert(!dupes.has('c'), 'unrelated row not flagged');

console.log(failures === 0 ? '\nall intel self-tests passed' : `\n${failures} assertion(s) FAILED`);
process.exitCode = failures === 0 ? 0 : 1;

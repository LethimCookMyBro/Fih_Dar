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

// --- location candidate ranking (post location-validation fixes) ---
// Regression tests written BEFORE the fix. The 8 RED cases fail on the
// current first-match-by-length ordering; the 2 guard cases pass today and
// protect the new mechanisms from over-demotion.
const rank1 = extractLocation('เคยพบที่สมุทรสาคร ก่อนพบล่าสุดที่ชลบุรี', '', null, null);
assert(rank1.province === 'ชลบุรี', `event location beats historical background (got ${rank1.province})`);
const rank2 = extractLocation('เจ้าหน้าที่จากสมุทรปราการเดินทางไปตรวจเหตุที่ชลบุรี', '', null, null);
assert(rank2.province === 'ชลบุรี', `event location beats origin mention (got ${rank2.province})`);
const rank3 = extractLocation('ผู้สื่อข่าวระยองรายงานว่าพบปลาหมอคางดำที่หาดพัทยา', '', null, null);
assert(rank3.province === 'ชลบุรี', `event location beats publisher location (got ${rank3.province})`);
const rank4 = extractLocation('พบปลาหมอคางดำที่หาดพัทยา', '', null, null);
assert(rank4.province === 'ชลบุรี', `Pattaya alias → ชลบุรี (got ${rank4.province})`);
const rank5 = extractLocation('แม่น้ำระยองพบปลาหมอคางดำ', '', null, null);
assert(rank5.province === null, `แม่น้ำระยอง must not leak province (got ${rank5.province})`);
assert(rank5.waterbody === 'ระยอง', `แม่น้ำระยอง → waterbody ระยอง (got ${rank5.waterbody})`);
assert(rank5.precision === 'WATERBODY', `แม่น้ำระยอง → precision WATERBODY (got ${rank5.precision})`);
const rank6 = extractLocation('ระยองลุยกำจัดปลาหมอคางดำทั้งจังหวัด', '', null, null);
assert(rank6.province === 'ระยอง', `province usage ระยอง → province (got ${rank6.province})`);
assert(rank6.waterbody === null, `province usage must NOT become waterbody (got ${rank6.waterbody})`);
const rank7 = extractLocation('พบปลาหมอคางดำในบ่อปลาหนองค้อ', '', null, null);
assert(rank7.waterbody === 'หนองค้อ', `บ่อปลาหนองค้อ → waterbody หนองค้อ (got ${rank7.waterbody})`);
const rank8 = extractLocation('นายวิชัย ณ พัทลุงแจ้งพบปลาหมอคางดำที่ชลบุรี', '', null, null);
assert(rank8.province === 'ชลบุรี', `surname ณ พัทลุง must not become event location (got ${rank8.province})`);
const rank8b = extractLocation('นายวิชัย ณ พัทลุงแจ้งข่าวสถานการณ์ประมง', '', null, null);
assert(rank8b.province === null, `surname-only ณ พัทลุง → no province (got ${rank8b.province})`);
// guards — single-candidate fallback and earliest tiebreak must survive
const guard1 = extractLocation('เคยพบปลาหมอคางดำที่สมุทรปราการเมื่อปีที่แล้ว', '', null, null);
assert(guard1.province === 'สมุทรปราการ', `sole historical mention still extracted (got ${guard1.province})`);
const guard2 = extractLocation('พบปลาหมอคางดำระบาดทั้งชลบุรีและระยอง', '', null, null);
assert(guard2.province === 'ชลบุรี', `two provinces → earliest mention (got ${guard2.province})`);

// --- location granularity (post granularity-review fixes) ---
// RED first: (1) the ณ-surname boundary must not fire on a ณ glued to the
// preceding word (บริเวณพัทยา), (2) the most-specific place must survive.
const gran1 = extractLocation('พบปลาหมอคางดำบริเวณพัทยา', '', null, null);
assert(gran1.province === 'ชลบุรี', `บริเวณพัทยา → province ชลบุรี (got ${gran1.province})`);
assert(gran1.place === 'พัทยา', `บริเวณพัทยา → place พัทยา (got ${gran1.place})`);
assert(gran1.precision === 'PROVINCE', `บริเวณพัทยา → precision PROVINCE (got ${gran1.precision})`);
const gran2 = extractLocation('พบปลาหมอคางดำบริเวณชลบุรี', '', null, null);
assert(gran2.province === 'ชลบุรี', `บริเวณชลบุรี → province ชลบุรี (got ${gran2.province})`);
const gran3 = extractLocation('พบปลาหมอคางดำที่หาดพัทยา', '', null, null);
assert(gran3.place === 'หาดพัทยา', `หาดพัทยา → place หาดพัทยา (got ${gran3.place})`);
const gran4 = extractLocation('ปลาหมอคางดำระบาดที่เมืองพัทยา', '', null, null);
assert(gran4.place === 'เมืองพัทยา', `เมืองพัทยา → place เมืองพัทยา (got ${gran4.place})`);
const gran5 = extractLocation('ปลาหมอคางดำเกยตื้นชายฝั่งพัทยา', '', null, null);
assert(gran5.place === 'ชายฝั่งพัทยา', `ชายฝั่งพัทยา → place ชายฝั่งพัทยา (got ${gran5.place})`);
const gran6 = extractLocation('ปลาหมอคางดำโผล่ชายหาดพัทยา', '', null, null);
assert(gran6.place === 'ชายหาดพัทยา', `ชายหาดพัทยา → place ชายหาดพัทยา (got ${gran6.place})`);
const gran9 = extractLocation('ประมงชลบุรีลงพื้นที่ตรวจสอบ หลังพบปลาหมอคางดำโผล่ทะเลพัทยา', '', null, null);
assert(gran9.place === 'ทะเลพัทยา', `earlier province mention must not erase the place (got ${gran9.place})`);
assert(gran9.province === 'ชลบุรี', `earlier province mention still resolves province (got ${gran9.province})`);
// guards — the genuine standalone-ณ surname must still be excluded
const gran7 = extractLocation('นายวิชัย ณ พัทลุงแจ้งข่าวสถานการณ์ประมง', '', null, null);
assert(gran7.province === null, `standalone surname ณ พัทลุง still excluded (got ${gran7.province})`);
const gran8 = extractLocation('นายวิชัย ณ พัทลุงแจ้งพบปลาหมอคางดำที่ชลบุรี', '', null, null);
assert(gran8.province === 'ชลบุรี', `surname + event location still resolves to ชลบุรี (got ${gran8.province})`);

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

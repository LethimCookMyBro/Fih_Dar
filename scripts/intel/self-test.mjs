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

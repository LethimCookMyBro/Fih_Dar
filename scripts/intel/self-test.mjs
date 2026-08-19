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
import { computeEventPriority, rankEvents, publisherOf } from './priority.mjs';
import { bestPrecision, summarizeEventMembers } from './event-summary.mjs';
import { resolveEvents } from './events.mjs';
import { matchReportsForReassessment, runReassessmentMatches } from './reassess.mjs';
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

// --- dedupe: geographic veto for coordinate-bearing observations ---
console.log('dedupe (geographic veto)');

// Same templated title, far-apart coordinates (Krabi ~8.09,98.91 vs Bangkok ~13.76,100.50) -> MUST NOT dedupe
const geoFar = findNearDuplicates([
  { id: 'g1', title: 'การพบปลาหมอคางดำ (Sarotherodon melanotheron) — จังหวัดกระบี่', description: 'พบในแม่น้ำกระบี่', sourceUrl: 'https://inaturalist.org/1', latitude: 8.0863, longitude: 98.9063 },
  { id: 'g2', title: 'การพบปลาหมอคางดำ (Sarotherodon melanotheron) — จังหวัดกรุงเทพมหานคร', description: 'พบในคลองบางกะปิ', sourceUrl: 'https://inaturalist.org/2', latitude: 13.7563, longitude: 100.5018 }
]);
assert(!geoFar.has('g2'), 'templated title with far-apart exact coords MUST NOT dedupe (Krabi→Bangkok ~650 km)');

// Same templated title, near coordinates (same site) -> SHOULD dedupe
const geoNear = findNearDuplicates([
  { id: 'g3', title: 'การพบปลาหมอคางดำ (Sarotherodon melanotheron) — หาดพัทยา', description: 'พบที่ชายหาดพัทยา', sourceUrl: 'https://inaturalist.org/3', latitude: 12.9296, longitude: 100.8826 },
  { id: 'g4', title: 'การพบปลาหมอคางดำ (Sarotherodon melanotheron) — ทะเลพัทยา', description: 'พบที่ทะเลพัทยา', sourceUrl: 'https://inaturalist.org/4', latitude: 12.9356, longitude: 100.8921 }
]);
assert(geoNear.has('g4') && geoNear.get('g4').duplicateOfId === 'g3', 'templated title with near exact coords SHOULD dedupe (Pattaya ~1 km)');

// One has coords, other doesn't -> locality guard applies (no geographic veto)
const geoMixed = findNearDuplicates([
  { id: 'g5', title: 'ปลาหมอคางดำบุกหาดพัทยา', description: 'พบที่ชายหาดพัทยา', sourceUrl: 'https://news.example.com/1' },
  { id: 'g6', title: 'ปลาหมอคางดำบุกหาดพัทยา', description: 'พบที่ชายหาดพัทยา', sourceUrl: 'https://news.example.com/2', latitude: 12.9296, longitude: 100.8826 }
]);
assert(geoMixed.has('g6') && geoMixed.get('g6').duplicateOfId === 'g5', 'mixed coords (one missing) with same locality + identical text SHOULD dedupe');

// Neither has coords -> existing locality/text logic applies
const geoNone = findNearDuplicates([
  { id: 'g7', title: 'ปลาหมอคางดำบุกหาดพัทยา', description: 'พบที่ชายหาดพัทยา', sourceUrl: 'https://news.example.com/3' },
  { id: 'g8', title: 'ปลาหมอคางดำบุกชายหาดบางแสน', description: 'พบที่ชายหาดบางแสน', sourceUrl: 'https://news.example.com/4' }
]);
assert(!geoNone.has('g8'), 'no coords: different locality names veto match (Pattaya vs Bangsaen)');

// --- priority (EXPERIMENTAL MVP operational ranking) ------------------------
console.log('priority');
const NOW = new Date('2026-08-16T00:00:00Z');
const member = (id, sourceName, publishedAt, duplicateOfId = null) => ({ id, sourceName, publishedAt, duplicateOfId });

const fresh3source = {
  slug: 'fresh-3-source',
  locationPrecision: 'WATERBODY',
  mostRecentPublishedAt: '2026-08-15T00:00:00Z',
  members: [member('a', 'ThaiPBS', '2026-08-15'), member('b', 'PPTV', '2026-08-14'), member('c', 'Ch7', '2026-08-13')]
};
const oldSingleSource = {
  slug: 'old-1-source',
  locationPrecision: 'WATERBODY',
  mostRecentPublishedAt: '2026-06-01T00:00:00Z',
  members: [member('d', 'ThaiPBS', '2026-06-01')]
};
const rankedFreshVsOld = rankEvents([oldSingleSource, fresh3source], NOW);
assert(rankedFreshVsOld[0].event.slug === 'fresh-3-source', 'fresher, corroborated event outranks an old single-source event');

// Duplicate articles (same canonical id) must not inflate corroboration.
const inflatedByDupes = {
  slug: 'inflated',
  locationPrecision: 'PROVINCE',
  mostRecentPublishedAt: '2026-08-15T00:00:00Z',
  members: [
    member('e', 'ThaiPBS', '2026-08-15'),
    member('f', 'ThaiPBS-mirror', '2026-08-15', 'e'), // near-duplicate of e
    member('g', 'ThaiPBS-syndicate', '2026-08-15', 'e') // near-duplicate of e
  ]
};
const genuineSingleSource = {
  slug: 'genuine-1-source',
  locationPrecision: 'PROVINCE',
  mostRecentPublishedAt: '2026-08-15T00:00:00Z',
  members: [member('h', 'ThaiPBS', '2026-08-15')]
};
assert(
  computeEventPriority(inflatedByDupes, NOW).independentSourceCount === 1,
  'duplicate articles (shared canonical id) do not inflate independent source count'
);
assert(
  computeEventPriority(inflatedByDupes, NOW).score === computeEventPriority(genuineSingleSource, NOW).score,
  'duplicate-inflated event scores identically to an equivalent genuine single-source event'
);

// Same real event, 5 independent outlets → corroboration strictly increases.
const fiveOutlets = {
  ...fresh3source,
  slug: 'five-outlets',
  members: [
    ...fresh3source.members,
    member('i', 'Matichon', '2026-08-15'),
    member('j', 'Khaosod', '2026-08-15')
  ]
};
assert(
  computeEventPriority(fiveOutlets, NOW).score > computeEventPriority(fresh3source, NOW).score,
  '5-outlet corroboration scores higher than 3-outlet corroboration'
);

// Unknown location/date must never silently become a high score.
const allUnknown = { slug: 'all-unknown', locationPrecision: null, mostRecentPublishedAt: null, members: [member('k', 'X', null)] };
const unknownResult = computeEventPriority(allUnknown, NOW);
assert(unknownResult.score <= 10, `unknown location + unknown date → low score, not silently high (got ${unknownResult.score})`);
assert(unknownResult.breakdown.location.precision === 'UNKNOWN', 'missing precision reported as UNKNOWN, never invented');

// Text volume alone (more members, same 1 real source) must not outrank real corroboration.
const verbose1Source = {
  slug: 'verbose-1-source',
  locationPrecision: 'WATERBODY',
  mostRecentPublishedAt: '2026-08-15T00:00:00Z',
  members: [
    member('l', 'ThaiPBS', '2026-08-15'),
    member('m', 'ThaiPBS', '2026-08-15', 'l'),
    member('n', 'ThaiPBS', '2026-08-15', 'l')
  ]
};
assert(
  computeEventPriority(verbose1Source, NOW).score < computeEventPriority(fresh3source, NOW).score,
  'low evidence (1 real source, padded with duplicates) cannot outrank genuine multi-source corroboration'
);

// Deterministic tie-break: identical score inputs must always sort the same way (by slug).
const tieA = { slug: 'tie-a', locationPrecision: 'PROVINCE', mostRecentPublishedAt: '2026-08-01', members: [member('o', 'X', '2026-08-01')] };
const tieB = { slug: 'tie-b', locationPrecision: 'PROVINCE', mostRecentPublishedAt: '2026-08-01', members: [member('p', 'Y', '2026-08-01')] };
const order1 = rankEvents([tieB, tieA], NOW).map((r) => r.event.slug);
const order2 = rankEvents([tieA, tieB], NOW).map((r) => r.event.slug);
assert(JSON.stringify(order1) === JSON.stringify(order2), `tied events sort deterministically regardless of input order (got ${order1} vs ${order2})`);
assert(order1[0] === 'tie-a', 'tie-break falls back to slug ascending');

// --- priority: aggregator-feed publisher extraction (live-corpus regression) ---
// Found against the live production DB: every Google News RSS row shares
// sourceName='google-news-th' regardless of which outlet wrote it, so raw
// sourceName silently collapsed every event to "1 independent source" no
// matter how many real outlets covered it. The outlet is reliably the last
// " - Publisher" segment of the aggregator's own title format.
console.log('priority (aggregator publisher extraction)');
assert(publisherOf('ปลาหมอคางดำโผล่ทะเล - ผู้จัดการออนไลน์', 'google-news-th') === 'ผู้จัดการออนไลน์', 'extracts publisher from aggregator title suffix');
assert(publisherOf('พบปลาหมอคางดำที่ชลบุรี', 'data.go.th') === 'data.go.th', 'falls back to sourceName when no " - Publisher" suffix exists');

// --- event-summary: shared derivation used by both the pipeline (persisted
// priority) and priority-service.ts (on-demand detail path) ------------------
console.log('event-summary');

assert(bestPrecision(['PROVINCE', 'EXACT', 'DISTRICT']) === 'EXACT', 'one EXACT member is enough to call the event EXACT');
assert(bestPrecision(['UNKNOWN', 'UNKNOWN']) === 'UNKNOWN', 'all-unknown members stay UNKNOWN, never invented');
assert(bestPrecision([]) === 'UNKNOWN', 'no members defaults to UNKNOWN, never throws');

const obs = (over) => ({
  id: 'o1',
  sourceName: 'X',
  sourceUrl: 'https://x.invalid',
  title: 'title',
  publishedAt: null,
  latitude: null,
  longitude: null,
  normalizedProvince: null,
  locationPrecision: null,
  duplicateOfId: null,
  evidence: null,
  ...over
});

const summary = summarizeEventMembers([
  obs({ id: 'a', publishedAt: '2026-08-10', locationPrecision: 'PROVINCE', normalizedProvince: 'ชลบุรี' }),
  obs({
    id: 'b',
    publishedAt: '2026-08-15',
    locationPrecision: 'EXACT',
    latitude: 13.1,
    longitude: 101.1,
    evidence: { location: { place: 'คลองหลังบ้าน' } }
  })
]);
assert(summary.mostRecentPublishedAt.getTime() === new Date('2026-08-15').getTime(), 'mostRecentPublishedAt picks the latest, not the first');
assert(summary.locationPrecision === 'EXACT', 'event-level precision is the best across members');
assert(summary.place === 'คลองหลังบ้าน', 'place taken from whichever member evidence carries it');
assert(summary.coordinate?.latitude === 13.1, 'coordinate taken from the first member that actually has one');
assert(summary.province === 'ชลบุรี', 'province taken from whichever member has it, order-independent of coordinate');

const summaryNoData = summarizeEventMembers([obs({})]);
assert(summaryNoData.mostRecentPublishedAt === null, 'no published dates -> null, never fabricated');
assert(summaryNoData.coordinate === null, 'no coordinates among members -> null, never a fabricated centroid');
assert(summaryNoData.locationPrecision === 'UNKNOWN', 'no precision data -> UNKNOWN');
const aggregatorEvent = {
  slug: 'aggregator-multi-outlet',
  locationPrecision: 'WATERBODY',
  mostRecentPublishedAt: '2026-08-15T00:00:00Z',
  members: [
    { id: 'ag1', title: 'ปลาหมอคางดำโผล่ทะเลโรงโป๊ะ - ผู้จัดการออนไลน์', sourceName: 'google-news-th', publishedAt: '2026-08-15', duplicateOfId: null },
    { id: 'ag2', title: 'ปลาหมอคางดำ โผล่ทะเลโรงโป๊ะ! - ข่าวสด', sourceName: 'google-news-th', publishedAt: '2026-08-15', duplicateOfId: null },
    { id: 'ag3', title: 'อึ้ง! ปลาหมอคางดำโผล่ทะเลโรงโป๊ะ - แนวหน้า', sourceName: 'google-news-th', publishedAt: '2026-08-15', duplicateOfId: null }
  ]
};
assert(
  computeEventPriority(aggregatorEvent, NOW).independentSourceCount === 3,
  `three different outlets sharing one aggregator sourceName still count as 3 independent sources (got ${computeEventPriority(aggregatorEvent, NOW).independentSourceCount})`
);

// --- events: transitive activity-kind bridging (live-corpus regression) ---
// Found in a live 110-row corpus replay: a control-removal row and a
// promotional row never compare directly (both only ever match a neutral
// no-cue "bridge" row), but without root-level tracking they still ended up
// in one connected component via that bridge. Mirrors the same mechanism
// already guarded for province/locality.
console.log('events (transitive activity bridge)');
const bridgeRows = [
  { id: 'CTRL', title: 'ประมงชลบุรีลงกำจัดปลาหมอคางดำที่หาดพัทยา', description: 'เจ้าหน้าที่ประมงลงพื้นที่กำจัดปลาหมอคางดำที่หาดพัทยา', sourceName: 'A', sourceExternalId: 'bridge-a', publishedAt: new Date('2026-05-14T07:00:00Z'), normalizedProvince: 'ชลบุรี', relevanceKind: 'CONTROL_REMOVAL' },
  { id: 'NEUTRAL', title: 'พบปลาหมอคางดำจำนวนมากที่หาดพัทยา', description: 'ชาวบ้านพบปลาหมอคางดำจำนวนมากที่หาดพัทยา วันนี้', sourceName: 'B', sourceExternalId: 'bridge-b', publishedAt: new Date('2026-05-14T08:00:00Z'), normalizedProvince: 'ชลบุรี', relevanceKind: 'SIGHTING' },
  { id: 'PROMO', title: 'จัดประกวดกินปลาหมอคางดำที่หาดพัทยา', description: 'จัดกิจกรรมประกวดกินปลาหมอคางดำบริเวณหาดพัทยา', sourceName: 'C', sourceExternalId: 'bridge-c', publishedAt: new Date('2026-05-14T09:00:00Z'), normalizedProvince: 'ชลบุรี', relevanceKind: 'CONTROL_REMOVAL' }
];
const bridgeCandidates = resolveEvents(bridgeRows, null);
const ctrlGroup = bridgeCandidates.find((c) => c.members.some((m) => m.id === 'CTRL'));
const promoGroup = bridgeCandidates.find((c) => c.members.some((m) => m.id === 'PROMO'));
assert(
  !ctrlGroup || !ctrlGroup.members.some((m) => m.id === 'PROMO'),
  'control-removal row and promotional row never share a group, even via a neutral bridge row'
);
assert(!(ctrlGroup && promoGroup && ctrlGroup === promoGroup), 'CTRL and PROMO never resolve to the same group object');

// --- reassessment matcher (automatic reopen) ------------------------------
console.log('reassess (matcher)');
const baseReport = {
  id: 'r1',
  province: 'ชลบุรี',
  district: 'เมืองชลบุรี',
  status: 'MONITORING',
  createdAt: new Date('2026-07-01T00:00:00Z'),
  lastFieldActionAt: new Date('2026-08-01T00:00:00Z'),
  reassessmentTrigger: null
};
const sig = (id, scrapedAt, province = 'ชลบุรี', district = null, publishedAt = null) => ({
  observation: { id, scrapedAt, publishedAt },
  location: { province, district }
});
assert(matchReportsForReassessment({ reports: [], signals: [] }).length === 0, 'empty reports and signals → no matches');
assert(matchReportsForReassessment({ reports: null, signals: null }).length === 0, 'null inputs → no matches');
const newer = matchReportsForReassessment({
  reports: [baseReport],
  signals: [sig('s1', '2026-08-10T00:00:00Z')]
});
assert(newer.length === 1, 'same province + newer signal → 1 match');
assert(newer[0].report.id === 'r1' && newer[0].signal.observation.id === 's1', 'match carries the report and the signal');
assert(newer[0].matchedProvince === 'ชลบุรี', 'matchedProvince recorded');
assert(newer[0].matchedDistrict === 'เมืองชลบุรี', 'matchedDistrict recorded from the report');
assert(
  matchReportsForReassessment({ reports: [baseReport], signals: [sig('s2', '2026-07-01T00:00:00Z')] }).length === 0,
  'signal older than report’s last field action → no match'
);
assert(
  matchReportsForReassessment({
    reports: [{ ...baseReport, id: 'r-no-action', lastFieldActionAt: null, createdAt: new Date('2026-08-05T00:00:00Z') }],
    signals: [sig('s2b', '2026-08-10T00:00:00Z')]
  }).length === 1,
  'report with no recorded field action falls back to createdAt as the anchor'
);
// Core fix: an old article scraped LATE must not look like a fresh signal —
// scrapedAt alone is never sufficient proof of a new biological sighting.
assert(
  matchReportsForReassessment({
    reports: [baseReport], // last field action 2026-08-01
    signals: [sig('s-old-published', '2026-08-18T00:00:00Z', 'ชลบุรี', null, '2026-07-15T00:00:00Z')]
  }).length === 0,
  'article published BEFORE the last field action, scraped after it → no match even though scrapedAt is newer'
);
assert(
  matchReportsForReassessment({
    reports: [baseReport], // last field action 2026-08-01
    signals: [sig('s-new-published', '2026-08-18T00:00:00Z', 'ชลบุรี', null, '2026-08-05T00:00:00Z')]
  }).length === 1,
  'article genuinely published AFTER the last field action → matches (publishedAt preferred over scrapedAt)'
);
assert(
  matchReportsForReassessment({
    reports: [baseReport],
    signals: [sig('s-no-published', '2026-08-10T00:00:00Z', 'ชลบุรี', null, null)]
  }).length === 1,
  'no publishedAt available → falls back to scrapedAt'
);
assert(
  matchReportsForReassessment({ reports: [baseReport], signals: [sig('s3', '2026-08-10T00:00:00Z', 'ระยอง')] }).length === 0,
  'different province → no match'
);
assert(
  matchReportsForReassessment({ reports: [baseReport], signals: [sig('s4', '2026-08-10T00:00:00Z', 'ชลบุรี', 'ศรีราชา')] }).length === 0,
  'district mismatch when both present → no match'
);
assert(
  matchReportsForReassessment({ reports: [baseReport], signals: [sig('s5', '2026-08-10T00:00:00Z', 'ชลบุรี', 'เมืองชลบุรี')] }).length === 1,
  'district agree → match'
);
assert(
  matchReportsForReassessment({ reports: [baseReport], signals: [sig('s6', '2026-08-10T00:00:00Z', 'ชลบุรี')] }).length === 1,
  'province-level signal (no district) still reopens a district-level report'
);
const noDistrictReport = matchReportsForReassessment({
  reports: [{ ...baseReport, id: 'r3', district: null }],
  signals: [sig('s10', '2026-08-10T00:00:00Z')]
});
assert(noDistrictReport.length === 1 && noDistrictReport[0].matchedDistrict === null, 'district-less report matched with matchedDistrict null');
assert(
  matchReportsForReassessment({ reports: [{ ...baseReport, id: 'r2', province: null }], signals: [sig('s7', '2026-08-10T00:00:00Z')] }).length === 0,
  'report without province → never matched'
);
assert(
  matchReportsForReassessment({
    reports: [{ ...baseReport, reassessmentTrigger: { observationId: 's8' } }],
    signals: [sig('s8', '2026-08-10T00:00:00Z')]
  }).length === 0,
  'same observationId already triggered → skipped (idempotent)'
);
const freshObservation = matchReportsForReassessment({
  reports: [{ ...baseReport, reassessmentTrigger: { observationId: 's8' } }],
  signals: [sig('s8', '2026-08-10T00:00:00Z'), sig('s9', '2026-08-11T00:00:00Z')]
});
assert(freshObservation.length === 1 && freshObservation[0].signal.observation.id === 's9', 'a NEW observation about the same place still reopens');
const firstWins = matchReportsForReassessment({
  reports: [baseReport],
  signals: [sig('a', '2026-08-10T00:00:00Z'), sig('b', '2026-08-11T00:00:00Z')]
});
assert(firstWins.length === 1 && firstWins[0].signal.observation.id === 'a', 'first qualifying signal per report wins');

// --- reassessment db runner ------------------------------------------------
// The runner queries Prisma directly (fieldActions relation, not
// lastFieldActionAt) and derives lastFieldActionAt itself before calling the
// pure matcher above — the fake mirrors that real select shape.
console.log('reassess (db runner)');
const dbReport = {
  id: baseReport.id,
  province: baseReport.province,
  district: baseReport.district,
  status: baseReport.status,
  createdAt: baseReport.createdAt,
  reassessmentTrigger: baseReport.reassessmentTrigger,
  fieldActions: [{ createdAt: baseReport.lastFieldActionAt }]
};
const seenIds = [];
const seenData = [];
const fakePrisma = {
  sightingReport: {
    findMany: async () => [dbReport],
    update: async ({ where, data }) => {
      seenIds.push(where.id);
      seenData.push(data);
      return data;
    }
  }
};
const reopened = await runReassessmentMatches({
  prisma: fakePrisma,
  relevant: [{ observation: { id: 's1', scrapedAt: '2026-08-10T00:00:00Z' }, location: { province: 'ชลบุรี', district: null } }],
  logger: { log: () => {} }
});
assert(reopened === 1, 'runner returns the count of reopened reports');
assert(seenIds[0] === 'r1', 'runner updates the matched report');
assert(seenData[0].status === 'REASSESSMENT', 'runner flips status to REASSESSMENT');
assert(seenData[0].reassessmentTrigger.observationId === 's1', 'runner records the triggering observationId');
assert(
  typeof seenData[0].reassessmentTrigger.matchedAt === 'string' && !Number.isNaN(Date.parse(seenData[0].reassessmentTrigger.matchedAt)),
  'runner records an ISO matchedAt'
);
assert(seenData[0].reassessmentTrigger.matchedProvince === 'ชลบุรี', 'runner records matchedProvince');
assert(seenData[0].reassessmentTrigger.matchedDistrict === 'เมืองชลบุรี', 'runner records matchedDistrict from the report');
let findCalled = false;
const idlePrisma = {
  sightingReport: {
    findMany: async () => {
      findCalled = true;
      return [];
    }
  }
};
assert(await runReassessmentMatches({ prisma: idlePrisma, relevant: [] }) === 0, 'runner with no relevant rows → 0');
assert(findCalled === false, 'runner skips the report query when no relevant rows');

console.log(failures === 0 ? '\nall intel self-tests passed' : `\n${failures} assertion(s) FAILED`);
process.exitCode = failures === 0 ? 0 : 1;

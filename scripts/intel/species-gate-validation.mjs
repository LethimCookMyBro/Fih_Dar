// Species hard-gate validation — controlled adversarial test set.
//
//   node scripts/intel/species-gate-validation.mjs
//
// Runs the CURRENT species classifier (classifyText → speciesEvidence) over 30
// deterministic Thai/English cases with pre-defined expected classes. Does NOT
// change the gate: it only measures it. Expected classes were fixed BEFORE the
// first run (see docs/FIHDAR_SPECIES_GATE_VALIDATION.md for the write-up).
//
// Scoring note: OTHER_SPECIES is a declared class in the gate but currently
// never emitted (reserved) — the confusion matrix records that fact.

import { classifyText, SPECIES_EVIDENCE } from './keywords.mjs';

// expected: one of SPECIES_EVIDENCE values
// category: A (clear) / B (ambiguous) / C (other species) / D (none) / E (adversarial)
const CASES = [
  // --- A. Clear Blackchin Tilapia → EXPLICIT_BLACKCHIN ---
  { id: 1, title: 'ปลาหมอคางดำระบาดในคลองบางปะกง', expected: 'EXPLICIT_BLACKCHIN', category: 'A', note: 'clear occurrence, full term' },
  { id: 2, title: 'หมอคางดำโผล่ชายหาดพัทยา', expected: 'EXPLICIT_BLACKCHIN', category: 'A', note: 'informal shorthand หมอคางดำ' },
  { id: 3, title: 'Sarotherodon melanotheron found in Rayong river', expected: 'EXPLICIT_BLACKCHIN', category: 'A', note: 'scientific name, exact' },
  { id: 4, title: 'Blackchin tilapia invasion reported in Chachoengsao', expected: 'EXPLICIT_BLACKCHIN', category: 'A', note: 'English common name' },
  { id: 5, title: 'ชาวบ้านพบปลาหมอคางดำจำนวนมากในบ่อกุ้ง', expected: 'EXPLICIT_BLACKCHIN', category: 'A', note: 'clear occurrence' },

  // --- B. Ambiguous tilapia references → AMBIGUOUS_TILAPIA ---
  { id: 6, title: 'ปริมาณการจับปลานิลในปีนี้เพิ่มขึ้น', expected: 'AMBIGUOUS_TILAPIA', category: 'B', note: 'generic tilapia dataset' },
  { id: 7, title: 'ปล่อยลูกปลานิลลงบ่อเลี้ยง', expected: 'AMBIGUOUS_TILAPIA', category: 'B', note: 'generic tilapia farming' },
  { id: 8, title: 'tilapia farming grows in the east', expected: 'AMBIGUOUS_TILAPIA', category: 'B', note: 'English bare "tilapia" (not "nile tilapia")' },
  { id: 9, title: 'ปลาหมอชุกชุมในบ่อน้ำจืด', expected: 'AMBIGUOUS_TILAPIA', category: 'B', note: 'bare ปลาหมอ — blackchin shorthand OR climbing perch' },
  { id: 10, title: 'ราคาปลานิลตลาดสดวันนี้', expected: 'AMBIGUOUS_TILAPIA', category: 'B', note: 'generic tilapia market' },

  // --- C. Other fish species → OTHER_SPECIES (per reviewer grouping) ---
  { id: 11, title: 'ชาวประมงจับปลากะพงได้ตัวใหญ่', expected: 'OTHER_SPECIES', category: 'C', note: 'sea bass' },
  { id: 12, title: 'ปลาทับทิมราคาดีช่วงเทศกาล', expected: 'OTHER_SPECIES', category: 'C', note: 'red tilapia breed (tilapia, but not blackchin)' },
  { id: 13, title: 'ปลาช่อนชุกชุมในฤดูฝน', expected: 'OTHER_SPECIES', category: 'C', note: 'snakehead' },
  { id: 14, title: 'ชาวบ้านจับปลาหมอเทศได้จากบ่อ', expected: 'OTHER_SPECIES', category: 'C', note: 'Mozambique tilapia (a tilapia, but not blackchin)' },

  // --- D. No species evidence → NONE ---
  { id: 15, title: 'น้ำท่วมฉะเชิงเทราหนักสุดในรอบสิบปี', expected: 'NONE', category: 'D', note: 'flood news, no fish' },
  { id: 16, title: 'การระบาดในพื้นที่ยังไม่คลี่คลาย', expected: 'NONE', category: 'D', note: 'infestation without species name' },
  { id: 17, title: 'กรมประมงแถลงมาตรการรับมือสถานการณ์', expected: 'NONE', category: 'D', note: 'policy without species name' },

  // --- E. Hard / adversarial ---
  { id: 18, title: 'ถกสนั่น แกะปลากระป๋อง เจอแมคเคอเรลคางดำ', expected: 'OTHER_SPECIES', category: 'E', note: 'canned mackerel labeled คางดำ — subject is mackerel, not blackchin' },
  { id: 19, title: "ร้านอาหาร 'คางดำ' เปิดสาขาใหม่ที่ชลบุรี", expected: 'NONE', category: 'E', note: 'brand name, no fish at all' },
  { id: 20, title: 'หน่วยงานยืนยันว่าไม่ใช่ปลาหมอคางดำ', expected: 'NONE', category: 'E', note: 'quoted negation — no affirmative evidence' },
  { id: 21, title: 'ปลาตัวนี้คล้ายปลาหมอคางดำแต่เป็นปลานิล', expected: 'AMBIGUOUS_TILAPIA', category: 'E', note: 'comparison — subject is tilapia' },
  { id: 22, title: 'พบปลานิลและปลาหมอคางดำปะปนกันในบ่อ', expected: 'EXPLICIT_BLACKCHIN', category: 'E', note: 'both named; blackchin present' },
  { id: 23, title: 'ปลาหมอค้างดำระบาด', expected: 'EXPLICIT_BLACKCHIN', category: 'E', note: 'misspelling ค้างดำ (wrong vowel)' },
  { id: 24, title: 'BlackchinTilapia spotted in canal', expected: 'EXPLICIT_BLACKCHIN', category: 'E', note: 'no-space English variant' },
  { id: 25, title: 'ปลาหมอ คางดำ ระบาด', expected: 'EXPLICIT_BLACKCHIN', category: 'E', note: 'spacing variant — คางดำ still contiguous' },
  { id: 26, title: 'Sarotherodon genus found in aquaculture', expected: 'NONE', category: 'E', note: 'genus only, not full species name' },
  { id: 27, title: 'เมนูปลาหมอคางดำทอดกรอบอร่อย', expected: 'EXPLICIT_BLACKCHIN', category: 'E', note: 'dish mention still names the species' },
  { id: 28, title: 'ข่าวปลอม! ปลาหมอคางดำระบาดกรุงเทพ', expected: 'EXPLICIT_BLACKCHIN', category: 'E', note: 'fake-news headline still names the species' },
  { id: 29, title: 'tilapia prices rise this month', expected: 'AMBIGUOUS_TILAPIA', category: 'E', note: 'bare English generic' },
  { id: 30, title: 'ปลานิลแดงโตเร็วเลี้ยงง่าย', expected: 'AMBIGUOUS_TILAPIA', category: 'E', note: 'red tilapia — contains ปลานิล' }
];

const CLASSES = Object.values(SPECIES_EVIDENCE);

function run() {
  const results = CASES.map((c) => {
    const cls = classifyText(c.title, c.description ?? '');
    return { ...c, actual: cls.speciesEvidence, hits: cls.speciesHit, generic: cls.genericHit };
  });

  // confusion matrix: [expected][actual]
  const cm = Object.fromEntries(CLASSES.map((e) => [e, Object.fromEntries(CLASSES.map((a) => [a, 0]))]));
  for (const r of results) cm[r.expected][r.actual] += 1;

  const correct = results.filter((r) => r.expected === r.actual).length;

  // per-class metrics
  const metrics = {};
  for (const c of CLASSES) {
    const tp = cm[c][c];
    const fp = CLASSES.reduce((s, e) => s + (e === c ? 0 : cm[e][c]), 0);
    const fn = CLASSES.reduce((s, a) => s + (a === c ? 0 : cm[c][a]), 0);
    const precision = tp + fp ? tp / (tp + fp) : NaN;
    const recall = tp + fn ? tp / (tp + fn) : NaN;
    const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : NaN;
    metrics[c] = {
      tp, fp, fn,
      precision: Number.isNaN(precision) ? null : +precision.toFixed(3),
      recall: Number.isNaN(recall) ? null : +recall.toFixed(3),
      f1: Number.isNaN(f1) ? null : +f1.toFixed(3)
    };
  }

  console.log('=== SPECIES GATE VALIDATION (current implementation, no changes) ===');
  console.log(`total cases: ${results.length}`);
  console.log(`correct: ${correct}`);
  console.log(`incorrect: ${results.length - correct}`);
  console.log(`accuracy: ${(correct / results.length).toFixed(3)}`);
  console.log('\n=== CONFUSION MATRIX (expected row × actual col) ===');
  console.log('expected\\actual | ' + CLASSES.join(' | '));
  for (const e of CLASSES) {
    console.log(`${e.padEnd(18)} | ` + CLASSES.map((a) => String(cm[e][a]).padEnd(17)).join(' | '));
  }
  console.log('\n=== PER-CLASS METRICS ===');
  for (const [c, m] of Object.entries(metrics)) {
    console.log(`${c.padEnd(18)} tp=${m.tp} fp=${m.fp} fn=${m.fn} precision=${m.precision} recall=${m.recall} f1=${m.f1}`);
  }
  console.log('\n=== PER-CASE ===');
  for (const r of results) {
    const mark = r.expected === r.actual ? 'PASS' : 'FAIL';
    console.log(`#${String(r.id).padStart(2)} [${r.category}] ${mark} expected=${r.expected.padEnd(18)} actual=${r.actual.padEnd(18)} | ${r.title}`);
  }
  console.log('\n=== FAILED CASES ===');
  const fails = results.filter((r) => r.expected !== r.actual);
  for (const r of fails) {
    console.log(`#${r.id} expected=${r.expected} actual=${r.actual} | ${r.title} | note: ${r.note} | speciesHit=${JSON.stringify(r.hits)} genericHit=${JSON.stringify(r.generic)}`);
  }
  return { total: results.length, correct, incorrect: results.length - correct, accuracy: correct / results.length, cm, metrics, failures: fails.map((r) => r.id) };
}

const out = run();
// machine-readable copy for the docs
import { writeFileSync } from 'node:fs';
writeFileSync(new URL('../../.data/intel/species-gate-results.json', import.meta.url), JSON.stringify(out, null, 2));
console.log('\nresults written to .data/intel/species-gate-results.json');

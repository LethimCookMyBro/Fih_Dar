// Species gating and category classification for the relevance pipeline.
//
// The classification is keyword-count driven and fully explainable: every hit
// is recorded in the evidence, no numeric "confidence" is invented. Category
// sets below were chosen to separate sighting reports from control/removal
// activity, policy discussion, generic aquaculture, and unrelated content.

import { normalizeText } from './normalize.mjs';

/** Terms that identify the target species (Blackchin tilapia, S. melanotheron). */
export const SPECIES_TERMS = [
  'ปลาหมอคางดำ',
  'blackchin tilapia',
  'sarotherodon melanotheron',
  'คางดำ'
];

/** Generic tilapia (a different species — Nile tilapia farming, catch stats). */
export const GENERIC_TILAPIA_TERMS = ['ปลานิล', 'nile tilapia'];

// All patterns are matched against lowercased, NFKC-normalized text.
export const CATEGORY_PATTERNS = {
  // Actual/possible sighting language: spread, discovery, infestation.
  SIGHTING: [
    'ระบาด', 'พบ', 'เจอ', 'แพร่กระจาย', 'แพร่ระบาด', 'รุกราน', 'บุกรุก',
    'เอเลียนสปีชีส์', 'ชุกชุม', 'แหล่งน้ำ', 'ลำน้ำ', 'คลอง', 'ลุ่มน้ำ', 'ปากน้ำ',
    'จับได้', 'ดักจับ', 'วางลอบ', 'ขยายพันธุ์', 'ต้นตอ', 'น้ำจืด', 'หนอง', 'บึง',
    'บ่อ', 'อ่าง', 'เขื่อน', 'การพบ'
    // note: bare 'จับ' is intentionally absent — it is shared control/removal
    // and aquaculture vocabulary ('ปริมาณการจับปลานิล' is not a sighting).
  ],
  // Control / removal / buyback activity.
  CONTROL_REMOVAL: [
    'กำจัด', 'รับซื้อ', 'จุดรับซื้อ', 'กก.ละ', 'ต่อกิโล', 'ทำหมัน', 'ลอบดัก',
    'มาตรการกำจัด', 'คัดแยก', 'เก็บกู้', 'ควบคุม', 'ระบายออก', 'ชาวบ้านจับ',
    'จับปลา', 'ราคา', 'เปิดรับซื้อ', 'จุดรับ', 'ซื้อ', 'ขาย'
  ],
  // Policy / administration / funding / research discussion.
  POLICY: [
    'กรมประมง', 'รัฐบาล', 'งบประมาณ', 'งบ', 'นโยบาย', 'โครงการ', 'แผน',
    'ประชุม', 'สั่งการ', 'หน่วยงาน', 'กระทรวง', 'ครม', 'ข้อเสนอ', 'ศึกษาวิจัย',
    'วิจัย', 'สภา', 'ตรวจสอบ', 'ติดตาม', 'จี้', 'ทวง', 'นักวิชาการ', 'มติ'
  ],
  // Generic aquaculture / fisheries industry (usually about Nile tilapia).
  AQUACULTURE: [
    'ฟาร์ม', 'เลี้ยงปลา', 'เพาะพันธุ์', 'อาหารปลา', 'ผลผลิต', 'ตลาดปลา',
    'ส่งออก', 'เกษตรกร', 'บ่อเลี้ยง', 'ปริมาณการจับ', 'ประมงน้ำจืด', 'พันธุ์ปลา',
    'ลูกพันธุ์', 'โรงเพาะฟัก'
  ]
};

const KIND_ORDER = ['SIGHTING', 'CONTROL_REMOVAL', 'POLICY', 'AQUACULTURE'];

/**
 * Classify one observation text into a primary kind with per-kind hit counts.
 * Returns { kind, kindScores, speciesHit, speciesTerms, evidence }
 * — evidence lists the actual matched patterns per category.
 */
export function classifyText(title, description) {
  const text = normalizeText(`${title ?? ''} ${description ?? ''}`);

  const speciesHit = SPECIES_TERMS.filter((term) => text.includes(term.toLowerCase()));
  const genericHit = GENERIC_TILAPIA_TERMS.filter((term) => text.includes(term.toLowerCase()));

  const hits = {};
  for (const [kind, patterns] of Object.entries(CATEGORY_PATTERNS)) {
    const matched = patterns.filter((pattern) => text.includes(pattern));
    hits[kind] = matched;
  }

  // Weight: exact species term is the strongest signal; category hits are
  // counted 1:1. Scores are raw counts, kept separate in evidence — no
  // pseudo-scientific weighting.
  const kindScores = {};
  for (const kind of KIND_ORDER) kindScores[kind] = hits[kind].length;
  kindScores.UNRELATED = speciesHit.length === 0 ? 1 : 0;

  const ranked = KIND_ORDER.filter((kind) => kindScores[kind] > 0)
    .sort((a, b) => kindScores[b] - kindScores[a]);
  const kind = ranked[0] ?? (speciesHit.length > 0 ? 'UNRELATED' : 'UNRELATED');

  return {
    kind,
    kindScores,
    speciesHit,
    genericHit,
    evidence: {
      speciesTerms: speciesHit,
      genericTilapiaTerms: genericHit,
      categoryHits: hits
    }
  };
}

/**
 * Verdict from keyword evidence. Three-way, conservative: relevance here means
 * "worth a human's attention", never "confirmed biological occurrence".
 */
export function verdictFromEvidence(classification) {
  const { kind, speciesHit, genericHit, kindScores } = classification;

  if (speciesHit.length === 0 && genericHit.length > 0) {
    return { verdict: 'IRRELEVANT', reason: 'generic tilapia (different species), no blackchin mention' };
  }
  if (speciesHit.length === 0) {
    return { verdict: 'IRRELEVANT', reason: 'no target species terms' };
  }
  if (kind === 'SIGHTING' || kind === 'CONTROL_REMOVAL') {
    return { verdict: 'RELEVANT', reason: `${kind} language present (${kindScores[kind]} hit(s))` };
  }
  if (kind === 'POLICY') {
    return { verdict: 'RELEVANT', reason: 'policy/administration discussion of the species' };
  }
  if (kind === 'UNRELATED') {
    return { verdict: 'UNCERTAIN', reason: 'species mentioned without sighting/control/policy context' };
  }
  return { verdict: 'UNCERTAIN', reason: `unclassified context (${kind})` };
}

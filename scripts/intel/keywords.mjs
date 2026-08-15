// Species gating and category classification for the relevance pipeline.
//
// The classification is keyword-count driven and fully explainable: every hit
// is recorded in the evidence, no numeric "confidence" is invented. Category
// sets below were chosen to separate sighting reports from control/removal
// activity, policy discussion, generic aquaculture, and unrelated content.

import { normalizeText } from './normalize.mjs';

/**
 * Terms that identify the target species (Blackchin tilapia, S. melanotheron).
 *
 * Deliberately NO bare 'คางดำ': alone it is not sufficient evidence — it
 * matches canned mackerel ('แมคเคอเรลคางดำ'), brand/product names, and other
 * non-fish uses. Strong evidence requires a species context (ปลาหมอ/หมอ
 * prefix, full English name, or scientific name). Misspelling variants
 * (ค้างดำ) are listed explicitly — deterministic, zero fuzzy matching.
 */
export const SPECIES_TERMS = [
  'ปลาหมอคางดำ',
  'ปลาหมอค้างดำ', // misspelling variant (คาง → ค้าง)
  'หมอคางดำ',
  'หมอค้างดำ', // misspelling variant
  'blackchin tilapia',
  'sarotherodon melanotheron'
];

/** Generic tilapia (a different species — Nile tilapia farming, catch stats). */
export const GENERIC_TILAPIA_TERMS = ['ปลานิล', 'nile tilapia', 'tilapia'];

/**
 * Smallest explicit vocabulary for OTHER_SPECIES (identifiable non-blackchin
 * fish). Kept to what the controlled validation tests need — deliberately not
 * a fish taxonomy. OTHER_SPECIES is declared in the SPEC as an intended real
 * output ('reserved; not detected yet').
 */
export const OTHER_SPECIES_TERMS = [
  'ปลากะพง', // sea bass
  'ปลาทับทิม', // red tilapia breed
  'ปลาช่อน', // snakehead
  'ปลาหมอเทศ', // Mozambique tilapia
  'แมคเคอเรล' // mackerel (canned-fish scandal headlines)
];

/**
 * Negation triggers: only the smallest set needed to keep quoted denials from
 * becoming affirmative evidence. Checked against the characters immediately
 * preceding a species-term occurrence.
 */
export const NEGATION_TRIGGERS = ['ไม่ใช่', 'มิใช่', 'ไม่พบ', 'ไม่เจอ', 'ไม่เห็น'];

/** Comparison/correction marker: species term + generic tilapia + this ⇒ the
 * sentence resolves the specimen to the generic fish, not blackchin. */
export const COMPARISON_MARKER = 'แต่เป็น';

/**
 * Species hard gate. ONLY EXPLICIT_BLACKCHIN may enter the Blackchin Tilapia
 * sighting/event pipeline. Generic-tilapia and other-species content may stay
 * as contextual external data but is never blackchin-sighting evidence. The
 * gate is recorded on every row and never deletes source data.
 */
export const SPECIES_EVIDENCE = {
  EXPLICIT_BLACKCHIN: 'EXPLICIT_BLACKCHIN', // text names ปลาหมอคางดำ / Blackchin tilapia / S. melanotheron
  AMBIGUOUS_TILAPIA: 'AMBIGUOUS_TILAPIA', // tilapia mentioned, species unclear (e.g. only ปลานิล)
  OTHER_SPECIES: 'OTHER_SPECIES', // an identifiable non-blackchin fish (reserved; not detected yet)
  NONE: 'NONE' // no fish species mentioned
};

export function speciesEvidenceFor(classification) {
  const { speciesHit, genericHit, otherHit, resolvedToGeneric } = classification;
  // Comparison/correction ('คล้ายปลาหมอคางดำแต่เป็นปลานิล') resolves the
  // specimen to the generic fish — the species term is not affirmative here.
  if (speciesHit.length > 0 && !resolvedToGeneric) return SPECIES_EVIDENCE.EXPLICIT_BLACKCHIN;
  if (genericHit.length > 0) return SPECIES_EVIDENCE.AMBIGUOUS_TILAPIA;
  if (otherHit.length > 0) return SPECIES_EVIDENCE.OTHER_SPECIES;
  return SPECIES_EVIDENCE.NONE;
}

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
 * Whitespace-insensitive occurrence scan of `term` inside `text` (original
 * normalized text, indexes preserved so negation windows work). Tolerates
 * 'BlackchinTilapia' (zero space), 'ปลาหมอ คางดำ' (inserted space), etc.
 * Deterministic — `\s*` between characters, no fuzzy matching.
 */
function termOccurrences(text, term) {
  const parts = [];
  for (const ch of term) {
    if (ch === ' ') {
      parts.push('\\s*');
      continue;
    }
    parts.push(ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), '\\s*');
  }
  if (parts[parts.length - 1] === '\\s*') parts.pop(); // no trailing whitespace
  const re = new RegExp(parts.join(''), 'g');
  const out = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    out.push(m.index);
    re.lastIndex = m.index + 1; // allow overlaps (หมอคางดำ inside ปลาหมอคางดำ)
  }
  return out;
}

/**
 * True when the chars immediately before the occurrence end with a negation
 * trigger. `anchor` is the EARLIEST overlapping species-term start, so a term
 * nested inside another ('หมอคางดำ' inside 'ไม่ใช่ปลาหมอคางดำ') inherits the
 * outer occurrence's negation window.
 */
function isNegated(text, anchor) {
  const before = text.slice(Math.max(0, anchor - 8), anchor).trimEnd();
  return NEGATION_TRIGGERS.some((trigger) => before.endsWith(trigger));
}

/**
 * Classify one observation text into a primary kind with per-kind hit counts.
 * Returns { kind, kindScores, speciesHit, speciesTerms, evidence }
 * — evidence lists the actual matched patterns per category.
 */
export function classifyText(title, description) {
  const text = normalizeText(`${title ?? ''} ${description ?? ''}`);

  // Strong species terms: only affirmative (non-negated) occurrences count.
  // All occurrences across all strong terms share one negation map — a nested
  // occurrence anchors to the earliest overlapping term start.
  const occurrences = [];
  for (const term of SPECIES_TERMS) {
    for (const index of termOccurrences(text, term.toLowerCase())) {
      occurrences.push({ term, index, length: term.length });
    }
  }
  const negatedIndexes = new Set();
  for (const occ of occurrences) {
    const anchor = Math.min(
      ...occurrences
        .filter((o) => o.index <= occ.index && o.index + o.length > occ.index)
        .map((o) => o.index)
    );
    if (isNegated(text, anchor)) negatedIndexes.add(occ.index);
  }
  const speciesHit = [
    ...new Set(
      occurrences.filter((occ) => !negatedIndexes.has(occ.index)).map((occ) => occ.term)
    )
  ];
  const genericHit = GENERIC_TILAPIA_TERMS.filter((term) => text.includes(term.toLowerCase()));
  const otherHit = OTHER_SPECIES_TERMS.filter((term) => text.includes(term.toLowerCase()));

  // Comparison/correction: species + generic tilapia + 'แต่เป็น' ⇒ the text
  // explicitly resolves the specimen to the generic fish (minimal rule).
  const resolvedToGeneric =
    speciesHit.length > 0 && genericHit.length > 0 && text.includes(COMPARISON_MARKER);

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
  const kind = ranked[0] ?? 'UNRELATED';

  const speciesEvidence = speciesEvidenceFor({ speciesHit, genericHit, otherHit, resolvedToGeneric });

  return {
    kind,
    kindScores,
    speciesHit,
    genericHit,
    otherHit,
    resolvedToGeneric,
    speciesEvidence,
    evidence: {
      speciesEvidence,
      speciesTerms: speciesHit,
      genericTilapiaTerms: genericHit,
      otherSpeciesTerms: otherHit,
      categoryHits: hits
    }
  };
}

/**
 * Verdict from keyword evidence. Three-way, conservative: relevance here means
 * "worth a human's attention", never "confirmed biological occurrence".
 *
 * Species hard gate: only EXPLICIT_BLACKCHIN rows can reach RELEVANT.
 * AMBIGUOUS_TILAPIA / NONE are IRRELEVANT for blackchin purposes (they may
 * remain contextual data — nothing is deleted).
 */
export function verdictFromEvidence(classification) {
  const { kind, speciesEvidence, kindScores } = classification;

  if (speciesEvidence === SPECIES_EVIDENCE.NONE) {
    return { verdict: 'IRRELEVANT', reason: 'no fish species terms' };
  }
  if (speciesEvidence === SPECIES_EVIDENCE.AMBIGUOUS_TILAPIA) {
    return { verdict: 'IRRELEVANT', reason: 'generic tilapia (different species), no blackchin mention' };
  }
  if (speciesEvidence === SPECIES_EVIDENCE.OTHER_SPECIES) {
    return { verdict: 'IRRELEVANT', reason: 'identifiable non-blackchin species, no blackchin mention' };
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

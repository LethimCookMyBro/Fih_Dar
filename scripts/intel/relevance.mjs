// Explainable relevance scoring.
//
// Evidence is kept as separate, inspectable dimensions — never a single fake
// "confidence". The three component scores (keyword, semantic, species) are
// stored raw; the verdict is a documented, deterministic combination. No
// threshold in this file is presented as scientific — distributions are dumped
// for manual inspection before any threshold is trusted.

import { classifyText, verdictFromEvidence } from './keywords.mjs';

// Prototype texts used as semantic anchors. Written as neutral Thai sentences;
// e5 uses 'query:' prefixes for these.
export const PROTOTYPES = {
  SIGHTING: 'ปลาหมอคางดำระบาดในแหล่งน้ำ ชาวบ้านพบและจับได้จำนวนมาก',
  CONTROL_REMOVAL: 'กำจัดและรับซื้อปลาหมอคางดำ มาตรการควบคุมประชากรปลา',
  POLICY: 'นโยบายและมาตรการของกรมประมงในการแก้ปัญหาปลาหมอคางดำ',
  AQUACULTURE: 'การเลี้ยงปลานิลในฟาร์มและปริมาณผลผลิตปลานิล'
};

export const PROTOTYPE_ORDER = ['SIGHTING', 'CONTROL_REMOVAL', 'POLICY', 'AQUACULTURE'];

/**
 * Combine keyword classification with optional semantic scores into the final
 * evidence + verdict for one observation.
 */
export function scoreRelevance({ title, description }, semantic) {
  const classification = classifyText(title, description);
  const keywordVerdict = verdictFromEvidence(classification);

  const evidence = {
    ...classification.evidence,
    keywordScores: classification.kindScores,
    keywordKind: classification.kind,
    keywordVerdict,
    semantic: semantic ?? null
  };

  // Semantic refinement: only ever softens an UNCERTAIN verdict upward when a
  // sighting prototype is strongly similar — it never overrides a clear
  // keyword verdict, because semantic similarity is not biological evidence.
  let verdict = keywordVerdict.verdict;
  let reason = keywordVerdict.reason;
  if (semantic && semantic.available) {
    const bestKind = PROTOTYPE_ORDER.reduce((best, kind) =>
      semantic[kind] > semantic[best] ? kind : best, PROTOTYPE_ORDER[0]);
    evidence.semantic.bestKind = bestKind;
    evidence.semantic.bestScore = Math.round(semantic[bestKind] * 1000) / 1000;
    if (verdict === 'UNCERTAIN' && semantic.SIGHTING >= 0.75) {
      verdict = 'RELEVANT';
      reason = `uncertain keyword context; semantic similarity to sighting prototype ${semantic.SIGHTING.toFixed(2)}`;
    }
  }

  evidence.finalVerdict = { verdict, reason };
  return { classification, evidence, verdict, reason };
}

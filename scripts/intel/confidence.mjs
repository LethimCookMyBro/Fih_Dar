// Multi-dimensional evidence confidence for a ranked priority event.
//
// Deliberately NOT a new scoring model: every dimension below is a
// categorical (HIGH/MEDIUM/LOW/UNKNOWN) bucketing of a number ALREADY
// computed elsewhere in the pipeline (priority.mjs's own breakdown,
// locationPrecision, relevance.mjs's verdict reason, independentSourceCount).
// Nothing here retunes priority.mjs's frozen weights or invents a new
// threshold disconnected from an existing, already-tested one. A single
// collapsed "confidence: 87%" number is exactly what this avoids — species,
// location, time, and source-corroboration evidence can (and often do)
// disagree, and the caller must be able to see that.
//
// NONE of these four dimensions are a calibrated statistical probability —
// every rule here is a deterministic bucketing of an existing heuristic
// signal, documented per-function below. In particular `species: HIGH` means
// "an explicit species keyword/name was matched (or, for MEDIUM, only a
// weaker semantic-similarity upgrade applied)" — it is evidence STRENGTH
// under this pipeline's keyword/semantic heuristic, never a field-confirmed
// identification or a claim of species-classification accuracy.
//
// Pure functions only — no I/O, no Prisma. Exercised by `npm run intel:test`.

/**
 * Species evidence STRENGTH (heuristic, not a calibrated identification) —
 * from the SAME relevance evidence already stored on each observation
 * (scripts/intel/relevance.mjs). Every RELEVANT member already passed the
 * EXPLICIT_BLACKCHIN species keyword gate — HIGH vs MEDIUM distinguishes HOW
 * that verdict was reached: a direct keyword match (HIGH) vs. the
 * semantic-similarity upgrade of an otherwise-uncertain keyword context
 * (MEDIUM, a strictly weaker signal — see relevance.mjs's own comment on
 * never letting semantic similarity override a clear keyword verdict). This
 * is never a confirmed field identification of the species.
 */
function speciesConfidence(members) {
  const withEvidence = members.filter((m) => m.evidence?.finalVerdict);
  if (withEvidence.length === 0) return 'UNKNOWN';
  const reasons = withEvidence.map((m) => String(m.evidence.finalVerdict.reason ?? ''));
  if (reasons.some((reason) => !reason.includes('uncertain keyword context'))) return 'HIGH';
  return 'MEDIUM';
}

/**
 * Location evidence, bucketed from the same LOCATION_PRECISION_SCORE tiers
 * priority.mjs already uses for the location component of the score (EXACT
 * 100 / WATERBODY 90 down to PROVINCE 35 / UNKNOWN 0) — not a new scale.
 */
function locationConfidence(locationPrecision) {
  switch (locationPrecision) {
    case 'EXACT':
    case 'WATERBODY':
      return 'HIGH';
    case 'SUBDISTRICT':
    case 'DISTRICT':
      return 'MEDIUM';
    case 'PROVINCE':
      return 'LOW';
    default:
      return 'UNKNOWN';
  }
}

/**
 * Time evidence, bucketed from priority.mjs's OWN recency score (0-100, a
 * linear decay already computed for the event) — not a second, disconnected
 * recency model. ageDays === null means no publishedAt was ever recorded on
 * any member, which is a genuinely different (weaker) fact than "published
 * but old", so it stays UNKNOWN rather than being folded into LOW.
 */
function timeConfidence(recencyBreakdown) {
  if (recencyBreakdown.ageDays === null) return 'UNKNOWN';
  if (recencyBreakdown.score >= 60) return 'HIGH';
  if (recencyBreakdown.score >= 20) return 'MEDIUM';
  return 'LOW';
}

/**
 * SOURCE CORROBORATION — deliberately NOT named "provenance". This is
 * bucketed from the SAME independentSourceCount priority.mjs already
 * computes after collapsing syndicated/duplicate/Google-News-wrapper copies
 * to their canonical publisher: it measures how many independent outlets
 * corroborate the event, i.e. evidence DIVERSITY. It does NOT measure actual
 * provenance (chain of custody — e.g. direct government API vs. an anonymous
 * social post vs. a citizen upload); this pipeline has no such signal for
 * external observations today (contrast ImageProvenance on citizen reports,
 * which IS real provenance evidence). Do not rename this back to
 * "provenance" without adding a genuine provenance signal to back it.
 */
function sourceCorroborationConfidence(independentSourceCount) {
  if (independentSourceCount >= 2) return 'HIGH';
  if (independentSourceCount === 1) return 'MEDIUM';
  return 'UNKNOWN';
}

/**
 * @param {object} event - same shape passed to computeEventPriority
 * @param {{evidence?: {finalVerdict?: {reason?: string}} | null}[]} event.members
 * @param {string | null} event.locationPrecision
 * @param {ReturnType<typeof import('./priority.mjs').computeEventPriority>} priority
 * @returns {{ species: string, location: string, time: string, sourceCorroboration: string }}
 */
export function deriveConfidence(event, priority) {
  return {
    species: speciesConfidence(event.members),
    location: locationConfidence(event.locationPrecision),
    time: timeConfidence(priority.breakdown.recency),
    sourceCorroboration: sourceCorroborationConfidence(priority.independentSourceCount)
  };
}

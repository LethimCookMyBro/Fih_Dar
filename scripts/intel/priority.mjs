// EXPERIMENTAL MVP operational priority score.
//
// Answers "which place should the field team check first?" using ONLY
// signals defensible from validated report intelligence — recency,
// independent-source corroboration, and location specificity. This is
// explicitly NOT the full research model: habitat suitability (MaxEnt),
// protected aquaculture value, and field accessibility are not implemented
// and must never be silently approximated by this module. Every score ships
// with a reason breakdown; nothing here is a biological confirmation.
//
// Pure functions only — no I/O, no Prisma, safe to import from either the
// Node intel scripts or the Next.js server layer.

export const PRIORITY_VERSION = 'experimental-mvp-v1';

// Recency: linear decay from 100 (today) to 0 at this many days old.
// EXPERIMENTAL / UNCALIBRATED — a working guess, not a statistically fit
// half-life.
const RECENCY_DECAY_DAYS = 45;

// Corroboration: step function over the number of INDEPENDENT sources
// (distinct sourceName, near-duplicate articles collapsed to their canonical
// row first so re-published copies never inflate this count).
const CORROBORATION_STEPS = [
  { minSources: 4, score: 100 },
  { minSources: 3, score: 78 },
  { minSources: 2, score: 55 },
  { minSources: 1, score: 25 },
  { minSources: 0, score: 0 }
];

// Location specificity: an exact/waterbody-level fix is immediately
// actionable for a field team; a bare province name is not.
const LOCATION_PRECISION_SCORE = {
  EXACT: 100,
  WATERBODY: 90,
  SUBDISTRICT: 80,
  DISTRICT: 60,
  PROVINCE: 35,
  UNKNOWN: 0
};

const WEIGHTS = { recency: 0.35, corroboration: 0.35, location: 0.3 };

function recencyScore(mostRecentDate, now = new Date()) {
  if (!mostRecentDate) return { score: 0, ageDays: null };
  const ageDays = Math.max(0, (now.getTime() - new Date(mostRecentDate).getTime()) / 86_400_000);
  const score = Math.round(Math.max(0, 100 * (1 - ageDays / RECENCY_DECAY_DAYS)));
  return { score, ageDays: Math.round(ageDays * 10) / 10 };
}

function corroborationScore(independentSourceCount) {
  const step = CORROBORATION_STEPS.find((s) => independentSourceCount >= s.minSources);
  return step.score;
}

function locationScore(precision) {
  return LOCATION_PRECISION_SCORE[precision ?? 'UNKNOWN'] ?? 0;
}

/**
 * @param {object} event
 * @param {{ sourceName: string, duplicateOfId: string | null, id: string }[]} event.members
 * @param {string | Date | null} event.mostRecentPublishedAt
 * @param {'EXACT'|'WATERBODY'|'SUBDISTRICT'|'DISTRICT'|'PROVINCE'|'UNKNOWN'|null} event.locationPrecision
 * @param {Date} [now]
 * @returns {{ score: number, breakdown: object, independentSourceCount: number }}
 */
export function computeEventPriority(event, now = new Date()) {
  // Duplicate articles must never inflate corroboration — collapse each
  // member to its canonical id (or its own id when it IS the canonical row)
  // before counting distinct sources.
  const canonicalSources = new Map();
  for (const member of event.members) {
    const canonicalId = member.duplicateOfId ?? member.id;
    if (!canonicalSources.has(canonicalId)) canonicalSources.set(canonicalId, member.sourceName);
  }
  const independentSourceCount = new Set(canonicalSources.values()).size;

  const recency = recencyScore(event.mostRecentPublishedAt, now);
  const corroboration = corroborationScore(independentSourceCount);
  const location = locationScore(event.locationPrecision);

  const score = Math.round(
    WEIGHTS.recency * recency.score + WEIGHTS.corroboration * corroboration + WEIGHTS.location * location
  );

  return {
    score,
    independentSourceCount,
    breakdown: {
      recency: { score: recency.score, ageDays: recency.ageDays, weight: WEIGHTS.recency },
      corroboration: { score: corroboration, independentSourceCount, weight: WEIGHTS.corroboration },
      location: { score: location, precision: event.locationPrecision ?? 'UNKNOWN', weight: WEIGHTS.location }
    }
  };
}

/**
 * Deterministic ranking: score desc, then recency (fresher first), then
 * corroboration desc, then slug asc — so ties never depend on array/DB order.
 */
export function rankEvents(events, now = new Date()) {
  return events
    .map((event) => ({ event, priority: computeEventPriority(event, now) }))
    .sort((a, b) => {
      if (b.priority.score !== a.priority.score) return b.priority.score - a.priority.score;
      const ageA = a.priority.breakdown.recency.ageDays ?? Infinity;
      const ageB = b.priority.breakdown.recency.ageDays ?? Infinity;
      if (ageA !== ageB) return ageA - ageB;
      if (b.priority.independentSourceCount !== a.priority.independentSourceCount) {
        return b.priority.independentSourceCount - a.priority.independentSourceCount;
      }
      return String(a.event.slug).localeCompare(String(b.event.slug));
    });
}

// Shared derivation of an EventCandidate's scoring/display summary from its
// member observations. Used by BOTH the intelligence pipeline
// (process.mjs, which persists a priority score once per event at
// pipeline-write time) and the Next.js server (priority-service.ts, the
// on-demand detail path) — keeping this in one place is what makes
// "persisted score" and "freshly computed score" provably the same
// computation, not two implementations that can silently drift apart.
//
// Pure functions only — no I/O, no Prisma.

export const LOCATION_PRECISION_RANK = [
  'UNKNOWN',
  'PROVINCE',
  'DISTRICT',
  'SUBDISTRICT',
  'WATERBODY',
  'EXACT'
];

/** The single most-specific precision across an event's members — one loose
 * observation should never drag a well-located event down to UNKNOWN, and one
 * precise observation is enough to say the event's location is known that
 * well. */
export function bestPrecision(precisions) {
  let best = 'UNKNOWN';
  for (const p of precisions) {
    if (LOCATION_PRECISION_RANK.indexOf(p) > LOCATION_PRECISION_RANK.indexOf(best)) best = p;
  }
  return best;
}

/**
 * @param {{ id: string, sourceName: string, sourceUrl: string, title: string,
 *   publishedAt: Date|string|null, latitude: number|null, longitude: number|null,
 *   normalizedProvince: string|null, locationPrecision: string|null,
 *   duplicateOfId: string|null, evidence: { location?: { place?: string|null } }|null }[]} members
 *   Raw ExternalObservation-shaped rows belonging to one EventCandidate.
 */
export function summarizeEventMembers(members) {
  const mostRecentPublishedAt =
    members
      .map((m) => m.publishedAt)
      .filter((d) => d !== null && d !== undefined)
      .map((d) => new Date(d))
      .toSorted((a, b) => b.getTime() - a.getTime())[0] ?? null;

  const locationPrecision = bestPrecision(members.map((m) => m.locationPrecision ?? 'UNKNOWN'));

  const place =
    members.map((m) => m.evidence?.location?.place ?? null).find((p) => Boolean(p)) ?? null;

  const coordinateMember = members.find((m) => m.latitude !== null && m.longitude !== null);
  const coordinate = coordinateMember
    ? { latitude: coordinateMember.latitude, longitude: coordinateMember.longitude }
    : null;

  const province = members.find((m) => m.normalizedProvince)?.normalizedProvince ?? null;

  return { mostRecentPublishedAt, locationPrecision, place, coordinate, province };
}

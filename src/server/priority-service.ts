import 'server-only';

import { prisma } from '@/lib/prisma';
// Single source of truth for the scoring math — also exercised by
// `npm run intel:test` (scripts/intel/self-test.mjs). Kept in scripts/intel
// because it is a pure function with no Prisma/Next dependency, consistent
// with the rest of the intelligence pipeline.
import {
  computeEventPriority,
  rankEvents,
  publisherOf,
  PRIORITY_VERSION
} from '../../scripts/intel/priority.mjs';

const LOCATION_PRECISION_RANK = [
  'UNKNOWN',
  'PROVINCE',
  'DISTRICT',
  'SUBDISTRICT',
  'WATERBODY',
  'EXACT'
] as const;

interface EvidenceLocation {
  location?: { place?: string | null };
}

function bestPrecision(precisions: string[]): string {
  let best = 'UNKNOWN';
  for (const p of precisions) {
    if (
      LOCATION_PRECISION_RANK.indexOf(p as (typeof LOCATION_PRECISION_RANK)[number]) >
      LOCATION_PRECISION_RANK.indexOf(best as (typeof LOCATION_PRECISION_RANK)[number])
    ) {
      best = p;
    }
  }
  return best;
}

/**
 * Ranked EXPERIMENTAL operational priority for every resolved event
 * candidate — "which area should the field team check first?". Every score
 * carries its reason breakdown; nothing here is a biological confirmation,
 * and habitat suitability / protected value / accessibility are NOT included
 * (see docs/FIHDAR_PRIORITY_MVP.md).
 */
export async function listPriorityAreas() {
  const candidates = await prisma.eventCandidate.findMany({
    include: {
      observations: {
        include: {
          observation: {
            select: {
              id: true,
              sourceName: true,
              sourceUrl: true,
              title: true,
              publishedAt: true,
              latitude: true,
              longitude: true,
              normalizedProvince: true,
              normalizedDistrict: true,
              locationPrecision: true,
              duplicateOfId: true,
              evidence: true
            }
          }
        }
      }
    }
  });

  const events = candidates.map((candidate) => {
    const members = candidate.observations.map((row) => row.observation);
    const mostRecentPublishedAt =
      members
        .map((m) => m.publishedAt)
        .filter((d): d is Date => d !== null)
        .toSorted((a, b) => b.getTime() - a.getTime())[0] ?? null;
    const locationPrecision = bestPrecision(members.map((m) => m.locationPrecision));
    const place = members
      .map((m) => (m.evidence as EvidenceLocation | null)?.location?.place ?? null)
      .find((p): p is string => Boolean(p));
    const coordinate = members.find((m) => m.latitude !== null && m.longitude !== null);
    const province =
      members.find((m) => m.normalizedProvince)?.normalizedProvince ?? candidate.province ?? null;

    return {
      slug: candidate.slug,
      kind: candidate.kind,
      eventDate: candidate.eventDate,
      areaLabel: place ?? province ?? 'ไม่ทราบพื้นที่',
      province,
      place: place ?? null,
      locationPrecision,
      mostRecentPublishedAt,
      coordinate: coordinate
        ? { latitude: coordinate.latitude as number, longitude: coordinate.longitude as number }
        : null,
      members: members.map((m) => ({
        id: m.id,
        sourceName: m.sourceName,
        sourceUrl: m.sourceUrl,
        title: m.title,
        publishedAt: m.publishedAt,
        duplicateOfId: m.duplicateOfId
      }))
    };
  });

  const ranked = rankEvents(events);

  return {
    version: PRIORITY_VERSION as string,
    areas: ranked.map(
      ({
        event,
        priority
      }: {
        event: (typeof events)[number];
        priority: ReturnType<typeof computeEventPriority>;
      }) => ({
        slug: event.slug,
        kind: event.kind,
        areaLabel: event.areaLabel,
        province: event.province,
        place: event.place,
        locationPrecision: event.locationPrecision,
        coordinate: event.coordinate,
        eventDate: event.eventDate?.toISOString() ?? null,
        mostRecentPublishedAt: event.mostRecentPublishedAt?.toISOString() ?? null,
        score: priority.score,
        breakdown: priority.breakdown,
        independentSourceCount: priority.independentSourceCount,
        sources: [...new Set(event.members.map((m) => publisherOf(m.title, m.sourceName)))],
        members: event.members.map((m) => ({
          title: m.title,
          sourceName: m.sourceName,
          sourceUrl: m.sourceUrl,
          publishedAt: m.publishedAt?.toISOString() ?? null,
          isDuplicate: m.duplicateOfId !== null
        }))
      })
    )
  };
}

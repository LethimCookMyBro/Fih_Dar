import 'server-only';

import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
// Single source of truth for the scoring math — also exercised by
// `npm run intel:test` (scripts/intel/self-test.mjs). Kept in scripts/intel
// because it is a pure function with no Prisma/Next dependency, consistent
// with the rest of the intelligence pipeline.
import { publisherOf } from '../../scripts/intel/priority.mjs';
import { NotFoundError } from './errors';
import { EEC_PILOT_PROVINCES } from './report-validation';

const EEC_PROVINCES: readonly string[] = EEC_PILOT_PROVINCES;

const MEMBERS_PREVIEW_LIMIT = 5;
const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 300;

interface PriorityBreakdown {
  recency: { score: number; ageDays: number | null; weight: number };
  corroboration: { score: number; independentSourceCount: number; weight: number };
  location: { score: number; precision: string; weight: number };
}

interface PriorityConfidence {
  species: string;
  location: string;
  time: string;
  sourceCorroboration: string;
}

interface EvidenceLocation {
  location?: { place?: string | null };
}

const candidateSummarySelect = {
  id: true,
  slug: true,
  kind: true,
  province: true,
  eventDate: true,
  locationPrecision: true,
  priorityScore: true,
  priorityVersion: true,
  priorityBreakdown: true,
  priorityConfidence: true,
  independentSourceCount: true,
  priorityComputedAt: true,
  operationalDecision: true
} as const;

type CandidateSummaryRow = Prisma.EventCandidateGetPayload<{
  select: typeof candidateSummarySelect;
}>;

export interface ListPriorityAreasOptions {
  cursor?: string;
  limit?: number;
  /** 'EEC' restricts to the current field-operation pilot provinces; 'ALL' (default) is nationwide. */
  scope?: 'EEC' | 'ALL';
}

/**
 * Ranked EXPERIMENTAL operational priority for resolved event candidates —
 * "which area should the field team check first?". Reads the PERSISTED score
 * (computed once by the intelligence pipeline at event-persistence time —
 * see scripts/intel/process.mjs) with a bounded, DB-ordered query. This does
 * NOT recompute priority per request and does NOT fetch every candidate's
 * full observation graph on every call — only a small members preview for
 * the page actually being returned, in one batched query. Candidates with no
 * persisted score yet (pre-migration rows awaiting
 * `npm run intel:backfill-priority`) are excluded rather than silently
 * ranked as zero.
 */
export async function listPriorityAreas(options: ListPriorityAreasOptions = {}) {
  const limit = Math.min(Math.max(options.limit ?? DEFAULT_LIST_LIMIT, 1), MAX_LIST_LIMIT);
  const scopeWhere: Prisma.EventCandidateWhereInput =
    options.scope === 'EEC' ? { province: { in: [...EEC_PROVINCES] } } : {};

  const rows = await prisma.eventCandidate.findMany({
    where: { ...scopeWhere, priorityScore: { not: null } },
    orderBy: [{ priorityScore: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(options.cursor ? { cursor: { slug: options.cursor }, skip: 1 } : {}),
    select: candidateSummarySelect
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  // One batched query for the whole page's coordinate + members preview —
  // never per-candidate, and never the full observation graph for every
  // EventCandidate in the table.
  const memberRows =
    page.length > 0
      ? await prisma.eventCandidateObservation.findMany({
          where: { candidateId: { in: page.map((row) => row.id) } },
          orderBy: { createdAt: 'asc' },
          select: {
            candidateId: true,
            observation: {
              select: {
                title: true,
                sourceName: true,
                sourceUrl: true,
                publishedAt: true,
                duplicateOfId: true,
                latitude: true,
                longitude: true,
                normalizedProvince: true,
                evidence: true
              }
            }
          }
        })
      : [];

  const membersByCandidateId = new Map<string, typeof memberRows>();
  for (const row of memberRows) {
    const list = membersByCandidateId.get(row.candidateId) ?? [];
    list.push(row);
    membersByCandidateId.set(row.candidateId, list);
  }

  const areas = page.map((candidate) =>
    summarizeArea(candidate, membersByCandidateId.get(candidate.id) ?? [])
  );

  return {
    version: page[0]?.priorityVersion ?? null,
    areas,
    hasMore,
    nextCursor: hasMore ? (page[page.length - 1]?.slug ?? null) : null
  };
}

function summarizeArea(
  candidate: CandidateSummaryRow,
  memberRows: {
    observation: {
      title: string;
      sourceName: string;
      sourceUrl: string;
      publishedAt: Date | null;
      duplicateOfId: string | null;
      latitude: number | null;
      longitude: number | null;
      normalizedProvince: string | null;
      evidence: unknown;
    };
  }[]
) {
  const observations = memberRows.map((row) => row.observation);

  const place =
    observations
      .map((m) => (m.evidence as EvidenceLocation | null)?.location?.place ?? null)
      .find((p): p is string => Boolean(p)) ?? null;
  const coordinateMember = observations.find((m) => m.latitude !== null && m.longitude !== null);
  const province =
    observations.find((m) => m.normalizedProvince)?.normalizedProvince ??
    candidate.province ??
    null;

  return {
    slug: candidate.slug,
    kind: candidate.kind,
    areaLabel: place ?? province ?? 'ไม่ทราบพื้นที่',
    province,
    place,
    locationPrecision: candidate.locationPrecision ?? 'UNKNOWN',
    coordinate: coordinateMember
      ? {
          latitude: coordinateMember.latitude as number,
          longitude: coordinateMember.longitude as number
        }
      : null,
    eventDate: candidate.eventDate?.toISOString() ?? null,
    mostRecentPublishedAt:
      observations
        .map((m) => m.publishedAt)
        .filter((d): d is Date => d !== null)
        .toSorted((a, b) => b.getTime() - a.getTime())[0]
        ?.toISOString() ?? null,
    score: candidate.priorityScore as number,
    breakdown: candidate.priorityBreakdown as unknown as PriorityBreakdown,
    independentSourceCount: candidate.independentSourceCount ?? 0,
    priorityVersion: candidate.priorityVersion,
    priorityComputedAt: candidate.priorityComputedAt?.toISOString() ?? null,
    operationalDecision: candidate.operationalDecision,
    // Multi-dimensional evidence — see confidence.mjs. Deliberately kept
    // separate from `score`: species/location/time/corroboration can (and
    // do) disagree, and collapsing them into one number would hide that.
    confidence: candidate.priorityConfidence as unknown as PriorityConfidence,
    sources: [...new Set(observations.map((m) => publisherOf(m.title, m.sourceName)))],
    // No consumer renders more than a handful of members (priority-panel
    // shows 5; the /ops lane shows none at all) — the full list is available
    // on demand via getPriorityAreaDetail().
    members: observations.slice(0, MEMBERS_PREVIEW_LIMIT).map((m) => ({
      title: m.title,
      sourceName: m.sourceName,
      sourceUrl: m.sourceUrl,
      publishedAt: m.publishedAt?.toISOString() ?? null,
      isDuplicate: m.duplicateOfId !== null
    }))
  };
}

/**
 * Full evidence detail for one EventCandidate, loaded on demand (officer
 * clicks "ดูหลักฐานทั้งหมด") — every member observation, not the
 * MEMBERS_PREVIEW_LIMIT-capped list the summary endpoint returns.
 */
export async function getPriorityAreaDetail(slug: string) {
  const candidate = await prisma.eventCandidate.findUnique({
    where: { slug },
    select: {
      slug: true,
      priorityScore: true,
      priorityVersion: true,
      priorityComputedAt: true,
      observations: {
        orderBy: { createdAt: 'asc' },
        select: {
          observation: {
            select: {
              title: true,
              sourceName: true,
              sourceUrl: true,
              publishedAt: true,
              duplicateOfId: true
            }
          }
        }
      }
    }
  });
  if (!candidate) throw new NotFoundError();

  return {
    slug: candidate.slug,
    score: candidate.priorityScore,
    priorityVersion: candidate.priorityVersion,
    priorityComputedAt: candidate.priorityComputedAt?.toISOString() ?? null,
    members: candidate.observations.map(({ observation: m }) => ({
      title: m.title,
      sourceName: m.sourceName,
      sourceUrl: m.sourceUrl,
      publishedAt: m.publishedAt?.toISOString() ?? null,
      isDuplicate: m.duplicateOfId !== null
    }))
  };
}

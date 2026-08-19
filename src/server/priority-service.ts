import 'server-only';

import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
// Single source of truth for the scoring math — also exercised by
// `npm run intel:test` (scripts/intel/self-test.mjs). Kept in scripts/intel
// because it is a pure function with no Prisma/Next dependency, consistent
// with the rest of the intelligence pipeline. sources-service.ts already
// imports computeEventPriority the same way for its live trace view.
import {
  computeEventPriority,
  publisherOf,
  PRIORITY_VERSION
} from '../../scripts/intel/priority.mjs';
import { deriveConfidence } from '../../scripts/intel/confidence.mjs';
import { summarizeEventMembers } from '../../scripts/intel/event-summary.mjs';
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
 * "which area should the field team check first?". Prefers the PERSISTED
 * score (computed once by the intelligence pipeline at event-persistence
 * time — see scripts/intel/process.mjs); a candidate whose pipeline run
 * predates persisted priority (or is awaiting the next
 * `npm run intel:backfill-priority`) still appears, falling back to the SAME
 * pure computation live in summarizeArea() — never silently ranked as zero,
 * and never a second, drifting implementation (shared via
 * scripts/intel/event-summary.mjs + priority.mjs + confidence.mjs). This
 * does NOT fetch every candidate's full observation graph on every call —
 * only a small members preview for the page actually being returned, in one
 * batched query.
 */
export async function listPriorityAreas(options: ListPriorityAreasOptions = {}) {
  const limit = Math.min(Math.max(options.limit ?? DEFAULT_LIST_LIMIT, 1), MAX_LIST_LIMIT);
  const scopeWhere: Prisma.EventCandidateWhereInput =
    options.scope === 'EEC' ? { province: { in: [...EEC_PROVINCES] } } : {};

  const rows = await prisma.eventCandidate.findMany({
    where: scopeWhere,
    orderBy: [{ priorityScore: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }],
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
                id: true,
                title: true,
                sourceName: true,
                sourceUrl: true,
                publishedAt: true,
                duplicateOfId: true,
                latitude: true,
                longitude: true,
                normalizedProvince: true,
                locationPrecision: true,
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
    // The pipeline's current version, not any one row's persisted value —
    // rows falling back to a live computation (see summarizeArea()) use this
    // same version, so it must never depend on page[0] having a persisted score.
    version: PRIORITY_VERSION,
    areas,
    hasMore,
    nextCursor: hasMore ? (page[page.length - 1]?.slug ?? null) : null
  };
}

function summarizeArea(
  candidate: CandidateSummaryRow,
  memberRows: {
    observation: {
      id: string;
      title: string;
      sourceName: string;
      sourceUrl: string;
      publishedAt: Date | null;
      duplicateOfId: string | null;
      latitude: number | null;
      longitude: number | null;
      normalizedProvince: string | null;
      locationPrecision: string | null;
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

  // Persisted score is authoritative once the pipeline has written it; a
  // candidate whose pipeline run predates persisted priority (or is awaiting
  // the next backfill) falls back to the exact same pure computation the
  // pipeline itself uses, via the shared summarizeEventMembers derivation —
  // never a second, drifting implementation, and never a silent zero.
  let score: number;
  let breakdown: PriorityBreakdown;
  let confidence: PriorityConfidence;
  let independentSourceCount: number;
  let priorityVersion: string | null;

  if (candidate.priorityScore !== null) {
    score = candidate.priorityScore;
    breakdown = candidate.priorityBreakdown as unknown as PriorityBreakdown;
    confidence = candidate.priorityConfidence as unknown as PriorityConfidence;
    independentSourceCount = candidate.independentSourceCount ?? 0;
    priorityVersion = candidate.priorityVersion;
  } else {
    // scripts/intel/event-summary.mjs, priority.mjs, and confidence.mjs are
    // JSDoc-typed pure functions shared with the intelligence pipeline (see
    // OBSERVATION_SELECT in backfill-priority.mjs, which selects this exact
    // shape) — cast the boundary rather than duplicate their types here.
    const rawMembers = observations as unknown as Parameters<typeof summarizeEventMembers>[0];
    const summary = summarizeEventMembers(rawMembers);
    type PriorityEvent = Parameters<typeof computeEventPriority>[0];
    const priorityEvent = {
      members: rawMembers,
      mostRecentPublishedAt: summary.mostRecentPublishedAt,
      locationPrecision: summary.locationPrecision
    } as unknown as PriorityEvent;
    const computed = computeEventPriority(priorityEvent);
    score = computed.score;
    breakdown = computed.breakdown as PriorityBreakdown;
    independentSourceCount = computed.independentSourceCount;
    confidence = deriveConfidence(
      priorityEvent as unknown as Parameters<typeof deriveConfidence>[0],
      computed
    ) as PriorityConfidence;
    priorityVersion = PRIORITY_VERSION;
  }

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
    score,
    breakdown,
    independentSourceCount,
    priorityVersion,
    // Persisted-write timestamp only — null here means "not yet backfilled",
    // even though `score` above is still a real, freshly computed number.
    priorityComputedAt: candidate.priorityComputedAt?.toISOString() ?? null,
    operationalDecision: candidate.operationalDecision,
    // Multi-dimensional evidence — see confidence.mjs. Deliberately kept
    // separate from `score`: species/location/time/corroboration can (and
    // do) disagree, and collapsing them into one number would hide that.
    confidence,
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

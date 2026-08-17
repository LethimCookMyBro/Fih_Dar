import 'server-only';

import { prisma } from '@/lib/prisma';
import { syncSourceRegistry } from './source-registry';
import { computeEventPriority, publisherOf } from '../../scripts/intel/priority.mjs';

/**
 * A run that is RUNNING for substantially longer than a normal refresh
 * (minutes) is stale — likely an externally killed process. Conservative:
 * 3 hours is far beyond any observed run and far below the 6h schedule.
 */
const STALE_RUN_MS = 3 * 60 * 60 * 1000;

export const SOURCES_PAGE_SIZE_DEFAULT = 20;
export const SOURCES_PAGE_SIZE_MAX = 100;
export const RUNS_PAGE_SIZE_DEFAULT = 25;
export const RUNS_PAGE_SIZE_MAX = 100;

type SourceResult = {
  sourceName: string;
  ok: boolean;
  matched: number;
  created: number;
  skipped: number;
  error: string | null;
};

export type SourceStatus = 'OK' | 'DEGRADED' | 'UNKNOWN';

function sanitizeStatus(runStatus: string | null, sourceOk: boolean | null): SourceStatus {
  if (runStatus === null || sourceOk === null) return 'UNKNOWN';
  if (runStatus === 'FAILED') return 'DEGRADED';
  if (runStatus === 'PARTIAL') return sourceOk ? 'OK' : 'DEGRADED';
  return sourceOk ? 'OK' : 'DEGRADED';
}

type HealthSnapshot = {
  latestRun: {
    status: string;
    startedAt: Date;
    finishedAt: Date | null;
    sourceResults: SourceResult[];
  } | null;
  counts: Map<string, number>;
  lastCreated: Map<string, Date | null>;
  relevantCounts: Map<string, number>;
};

async function healthSnapshot(): Promise<HealthSnapshot> {
  const [latestRun, observationCounts, lastCreatedBySource, relevantCounts] = await Promise.all([
    prisma.ingestionRun.findFirst({ orderBy: { startedAt: 'desc' } }),
    prisma.externalObservation.groupBy({ by: ['sourceName'], _count: { _all: true } }),
    prisma.externalObservation.groupBy({ by: ['sourceName'], _max: { createdAt: true } }),
    prisma.externalObservation.groupBy({
      by: ['sourceName'],
      where: { relevanceVerdict: 'RELEVANT' },
      _count: { _all: true }
    })
  ]);
  return {
    latestRun: latestRun
      ? {
          status: latestRun.status,
          startedAt: latestRun.startedAt,
          finishedAt: latestRun.finishedAt,
          sourceResults: (latestRun.sourceResults ?? []) as SourceResult[]
        }
      : null,
    counts: new Map(observationCounts.map((item) => [item.sourceName, item._count._all])),
    lastCreated: new Map(lastCreatedBySource.map((item) => [item.sourceName, item._max.createdAt])),
    relevantCounts: new Map(relevantCounts.map((item) => [item.sourceName, item._count._all]))
  };
}

/**
 * `status` is TECHNICAL health only — did the latest run's fetch/parse/upsert
 * succeed for this source. It says nothing about whether that fetch actually
 * surfaced a usable FihDar signal, which is why it is reported separately
 * from `relevantObservations` / `lastRunMatched` / `lastRunCreated`. A source
 * can be technically OK forever while never producing a single relevant
 * observation — the UI must show both, never collapse them into one pill.
 */
function healthForSource(
  slug: string,
  snapshot: HealthSnapshot
): {
  status: SourceStatus;
  lastCheckedAt: string | null;
  lastNewObservationAt: string | null;
  totalObservations: number;
  relevantObservations: number;
  lastRunMatched: number | null;
  lastRunCreated: number | null;
} {
  const sourceResult =
    snapshot.latestRun?.sourceResults.find((result) => result.sourceName === slug) ?? null;
  const status = sanitizeStatus(
    snapshot.latestRun?.status ?? null,
    sourceResult ? sourceResult.ok : null
  );
  return {
    status,
    lastCheckedAt: snapshot.latestRun?.finishedAt?.toISOString() ?? null,
    lastNewObservationAt: snapshot.lastCreated.get(slug)?.toISOString() ?? null,
    totalObservations: snapshot.counts.get(slug) ?? 0,
    relevantObservations: snapshot.relevantCounts.get(slug) ?? 0,
    lastRunMatched: sourceResult?.matched ?? null,
    lastRunCreated: sourceResult?.created ?? null
  };
}

/** Last run in which the given source itself succeeded (derived from run records). */
async function lastSourceSuccessAt(slug: string): Promise<string | null> {
  const runs = await prisma.ingestionRun.findMany({
    orderBy: { startedAt: 'desc' },
    take: 20,
    select: { startedAt: true, sourceResults: true }
  });
  for (const run of runs) {
    const results = (run.sourceResults ?? []) as SourceResult[];
    const mine = results.find((result) => result.sourceName === slug);
    if (mine?.ok) return run.startedAt.toISOString();
  }
  return null;
}

/**
 * Public, read-only operational summary of the ingestion pipeline.
 *
 * All values come from the database — no fabricated numbers. Source status is
 * derived from IngestionRun history plus ExternalObservation counts. The
 * source list itself comes from the DataSource table (synced from the code
 * registry), so the summary automatically reflects every trusted source.
 */
export async function getSourcesSummary() {
  await syncSourceRegistry();
  const [latestRun, recentRuns, snapshot, processingCounts, verdictCounts, eventCandidateCount] =
    await Promise.all([
      prisma.ingestionRun.findFirst({ orderBy: { startedAt: 'desc' } }),
      prisma.ingestionRun.findMany({ orderBy: { startedAt: 'desc' }, take: 5 }),
      healthSnapshot(),
      prisma.externalObservation.groupBy({ by: ['processingStatus'], _count: { _all: true } }),
      prisma.externalObservation.groupBy({ by: ['relevanceVerdict'], _count: { _all: true } }),
      prisma.eventCandidate.count()
    ]);

  const totalObservations = [...snapshot.counts.values()].reduce((sum, n) => sum + n, 0);
  const latestRunResult = latestRun
    ? {
        status: latestRun.status,
        trigger: latestRun.trigger,
        startedAt: latestRun.startedAt.toISOString(),
        finishedAt: latestRun.finishedAt?.toISOString() ?? null,
        durationMs: latestRun.finishedAt
          ? Math.max(0, latestRun.finishedAt.getTime() - latestRun.startedAt.getTime())
          : null,
        createdCount: latestRun.createdCount,
        skippedCount: latestRun.skippedCount,
        processedCount: latestRun.processedCount,
        failedCount: latestRun.failedCount,
        errorSummary: latestRun.errorSummary,
        isStale:
          latestRun.status === 'RUNNING' &&
          Date.now() - latestRun.startedAt.getTime() > STALE_RUN_MS
      }
    : null;

  const dbSources = await prisma.dataSource.findMany({ orderBy: { displayOrder: 'asc' } });
  const sources = dbSources.map((source) => ({
    id: source.slug,
    label: source.label,
    category: source.category,
    transport: source.transport,
    authorityType: source.authorityType,
    ...healthForSource(source.slug, snapshot)
  }));

  const pipeline = {
    externalObservations: totalObservations,
    raw: processingCounts.find((item) => item.processingStatus === 'RAW')?._count._all ?? 0,
    processed:
      processingCounts.find((item) => item.processingStatus === 'PROCESSED')?._count._all ?? 0,
    failed: processingCounts.find((item) => item.processingStatus === 'FAILED')?._count._all ?? 0,
    relevant: verdictCounts.find((item) => item.relevanceVerdict === 'RELEVANT')?._count._all ?? 0,
    irrelevant:
      verdictCounts.find((item) => item.relevanceVerdict === 'IRRELEVANT')?._count._all ?? 0,
    uncertain:
      verdictCounts.find((item) => item.relevanceVerdict === 'UNCERTAIN')?._count._all ?? 0,
    eventCandidates: eventCandidateCount,
    citizenReports: await prisma.sightingReport.count()
  };

  const recentRunsResult = recentRuns.map((run) => ({
    id: run.id,
    trigger: run.trigger,
    status: run.status,
    startedAt: run.startedAt.toISOString(),
    finishedAt: run.finishedAt?.toISOString() ?? null,
    durationMs: run.finishedAt
      ? Math.max(0, run.finishedAt.getTime() - run.startedAt.getTime())
      : null,
    createdCount: run.createdCount,
    skippedCount: run.skippedCount,
    processedCount: run.processedCount,
    failedCount: run.failedCount,
    errorSummary: run.errorSummary,
    isStale: run.status === 'RUNNING' && Date.now() - run.startedAt.getTime() > STALE_RUN_MS
  }));

  return {
    generatedAt: new Date().toISOString(),
    latestRun: latestRunResult,
    recentRuns: recentRunsResult,
    sources,
    pipeline
  };
}

const STATUS_RANK: Record<SourceStatus, number> = { OK: 0, DEGRADED: 1, UNKNOWN: 2 };

function filterAndSortSources(
  rows: {
    slug: string;
    label: string;
    category: string;
    transport: string;
    authorityType: string;
    trustTier: string;
    description: string | null;
    homepage: string | null;
    displayOrder: number;
    enabled: boolean;
    coverageMetadata: unknown;
    createdAt: Date;
    updatedAt: Date;
    health: ReturnType<typeof healthForSource>;
  }[],
  params: {
    q?: string;
    status?: string;
    category?: string;
    transport?: string;
    sort?: string;
  }
) {
  const q = params.q?.trim().toLowerCase() ?? '';
  const status = params.status ?? '';
  const category = params.category ?? '';
  const transport = params.transport ?? '';

  const filtered = rows.filter((row) => {
    if (q) {
      const haystack =
        `${row.label} ${row.category} ${row.transport} ${row.authorityType}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (status && row.health.status !== status) return false;
    if (category && row.category !== category) return false;
    if (transport && row.transport !== transport) return false;
    return true;
  });

  switch (params.sort ?? 'name') {
    case 'observations':
      filtered.sort((a, b) => b.health.totalObservations - a.health.totalObservations);
      break;
    case 'latest':
      filtered.sort(
        (a, b) =>
          b.health.lastNewObservationAt?.localeCompare(a.health.lastNewObservationAt ?? '') ?? 0
      );
      break;
    case 'status':
      filtered.sort((a, b) => STATUS_RANK[a.health.status] - STATUS_RANK[b.health.status]);
      break;
    case 'name':
    default:
      filtered.sort((a, b) => a.label.localeCompare(b.label, 'th'));
  }
  return filtered;
}

/**
 * Public, paginated source list with search / filter / sort. Sources come from
 * the DataSource table (synced from the code registry); health is derived
 * from IngestionRun history + ExternalObservation aggregates. The browser only
 * ever receives one page — designed to stay bounded at 1,000+ sources.
 */
export async function getSourceList(params: {
  q?: string;
  status?: string;
  category?: string;
  transport?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
}) {
  await syncSourceRegistry();

  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(
    SOURCES_PAGE_SIZE_MAX,
    Math.max(1, params.pageSize ?? SOURCES_PAGE_SIZE_DEFAULT)
  );

  const [dbSources, snapshot] = await Promise.all([
    prisma.dataSource.findMany({ orderBy: { displayOrder: 'asc' } }),
    healthSnapshot()
  ]);

  const rows = dbSources.map((source) => ({
    slug: source.slug,
    label: source.label,
    category: source.category,
    transport: source.transport,
    authorityType: source.authorityType,
    trustTier: source.trustTier,
    description: source.description,
    homepage: source.homepage,
    displayOrder: source.displayOrder,
    enabled: source.enabled,
    coverageMetadata: source.coverageMetadata,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
    health: healthForSource(source.slug, snapshot)
  }));

  const filtered = filterAndSortSources(rows, params);
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const slice = filtered.slice((page - 1) * pageSize, page * pageSize);

  return {
    generatedAt: new Date().toISOString(),
    sources: slice.map((row) => ({
      id: row.slug,
      slug: row.slug,
      label: row.label,
      category: row.category,
      transport: row.transport,
      authorityType: row.authorityType,
      trustTier: row.trustTier,
      description: row.description,
      homepage: row.homepage,
      displayOrder: row.displayOrder,
      enabled: row.enabled,
      ...row.health
    })),
    summary: {
      total,
      healthy: filtered.filter((row) => row.health.status === 'OK').length,
      degraded: filtered.filter((row) => row.health.status === 'DEGRADED').length,
      unknown: filtered.filter((row) => row.health.status === 'UNKNOWN').length
    },
    pagination: { page, pageSize, total, totalPages }
  };
}

/** Single-source detail for the observatory drawer. */
export async function getSourceBySlug(slug: string) {
  await syncSourceRegistry();
  const [source, snapshot, lastSuccessAt] = await Promise.all([
    prisma.dataSource.findUnique({ where: { slug } }),
    healthSnapshot(),
    lastSourceSuccessAt(slug)
  ]);
  if (!source) return null;

  const health = healthForSource(slug, snapshot);
  return {
    id: source.slug,
    slug: source.slug,
    label: source.label,
    category: source.category,
    transport: source.transport,
    authorityType: source.authorityType,
    trustTier: source.trustTier,
    description: source.description,
    homepage: source.homepage,
    enabled: source.enabled,
    coverageMetadata: source.coverageMetadata,
    createdAt: source.createdAt.toISOString(),
    updatedAt: source.updatedAt.toISOString(),
    ...health,
    lastSuccessAt
  };
}

/**
 * Bounded, paginated ingestion-run history. The UI only ever requests one
 * page — the system stays responsive at 10 or 1,000,000 runs.
 */
export async function getSourceRuns(params: { page?: number; pageSize?: number; status?: string }) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(
    RUNS_PAGE_SIZE_MAX,
    Math.max(1, params.pageSize ?? RUNS_PAGE_SIZE_DEFAULT)
  );
  const where = params.status
    ? { status: params.status as 'RUNNING' | 'SUCCEEDED' | 'PARTIAL' | 'FAILED' }
    : {};

  const [total, runs] = await Promise.all([
    prisma.ingestionRun.count({ where }),
    prisma.ingestionRun.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize
    })
  ]);

  return {
    generatedAt: new Date().toISOString(),
    runs: runs.map((run) => ({
      id: run.id,
      trigger: run.trigger,
      status: run.status,
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt?.toISOString() ?? null,
      durationMs: run.finishedAt
        ? Math.max(0, run.finishedAt.getTime() - run.startedAt.getTime())
        : null,
      createdCount: run.createdCount,
      skippedCount: run.skippedCount,
      processedCount: run.processedCount,
      failedCount: run.failedCount,
      errorSummary: run.errorSummary,
      sourceResults: run.sourceResults,
      isStale: run.status === 'RUNNING' && Date.now() - run.startedAt.getTime() > STALE_RUN_MS
    })),
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) }
  };
}

type TraceCandidate = {
  id: string;
  sourceName: string;
  sourceUrl: string;
  title: string;
  description: string | null;
  publishedAt: Date | null;
  scrapedAt: Date;
  province: string | null;
  district: string | null;
  subdistrict: string | null;
  latitude: number | null;
  longitude: number | null;
  locationPrecision: string;
  normalizedProvince: string | null;
  normalizedDistrict: string | null;
  normalizedSubdistrict: string | null;
  normalizedWaterbody: string | null;
  relevanceVerdict: string | null;
  relevanceKind: string | null;
  duplicateOfId: string | null;
  evidence: unknown;
  eventCandidates: {
    role: string;
    candidate: {
      slug: string;
      status: string;
      kind: string | null;
      province: string | null;
      eventDate: Date | null;
      locationPrecision: string | null;
      observations: {
        role: string;
        observation: {
          id: string;
          sourceName: string;
          sourceUrl: string;
          title: string;
          publishedAt: Date | null;
          latitude: number | null;
          longitude: number | null;
          normalizedProvince: string | null;
          locationPrecision: string;
          duplicateOfId: string | null;
        };
      }[];
    };
  }[];
};

/**
 * A REAL, recent, relevant signal with its full trace through the pipeline —
 * selected from the database, never fabricated. Prefers an observation that
 * belongs to an event with supporting members and has a location.
 */
export async function getSignalTrace() {
  const candidates = await prisma.externalObservation.findMany({
    where: {
      processingStatus: 'PROCESSED',
      relevanceVerdict: 'RELEVANT',
      duplicateOfId: null // the canonical row of each duplicate group
    },
    orderBy: { scrapedAt: 'desc' },
    take: 40,
    include: {
      eventCandidates: {
        include: {
          candidate: {
            include: {
              observations: {
                select: {
                  role: true,
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
                      locationPrecision: true,
                      duplicateOfId: true
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  });

  if (candidates.length === 0) return null;

  // Pick the strongest traceable signal: prefer event membership (with
  // supporting members), then coordinates, then province.
  const rank = (candidate: TraceCandidate): number => {
    let score = 0;
    const event = candidate.eventCandidates[0]?.candidate;
    if (event) {
      score += 4;
      score += Math.min(3, event.observations.length - 1);
    }
    if (candidate.latitude !== null && candidate.longitude !== null) score += 2;
    if (candidate.normalizedProvince) score += 1;
    if (candidate.description) score += 0.5;
    return score;
  };
  const chosen = [...candidates].sort((a, b) => rank(b) - rank(a))[0];

  const evidence = (chosen.evidence ?? {}) as {
    speciesEvidence?: string;
    speciesTerms?: string[];
    categoryHits?: Record<string, string[]>;
    keywordScores?: Record<string, number>;
    keywordKind?: string;
    finalVerdict?: { verdict: string; reason: string };
    semantic?: { available?: boolean; bestKind?: string; bestScore?: number } | null;
    location?: { matched?: string[]; fuzzy?: string[]; place?: string | null };
    nearDuplicate?: { duplicateOfId?: string | null; similarity?: number } | null;
  };

  const eventLink = chosen.eventCandidates[0]?.candidate ?? null;
  let priority = null;
  if (eventLink) {
    const members = eventLink.observations.map((row) => row.observation);
    const mostRecentPublishedAt =
      members
        .map((m) => m.publishedAt)
        .filter((d): d is Date => d !== null)
        .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
    const computed = computeEventPriority({
      members,
      mostRecentPublishedAt,
      locationPrecision: eventLink.locationPrecision
    });
    priority = {
      score: computed.score,
      independentSourceCount: computed.independentSourceCount,
      breakdown: computed.breakdown,
      sources: [...new Set(members.map((m) => publisherOf(m.title, m.sourceName)))]
    };
  }

  return {
    generatedAt: new Date().toISOString(),
    observation: {
      id: chosen.id,
      sourceName: chosen.sourceName,
      sourceUrl: chosen.sourceUrl,
      title: chosen.title,
      description: chosen.description,
      publishedAt: chosen.publishedAt?.toISOString() ?? null,
      scrapedAt: chosen.scrapedAt.toISOString()
    },
    species: {
      evidence: evidence.speciesEvidence ?? 'UNKNOWN',
      terms: evidence.speciesTerms ?? []
    },
    relevance: {
      verdict: chosen.relevanceVerdict,
      kind: chosen.relevanceKind,
      finalVerdict: evidence.finalVerdict ?? null,
      keywordScores: evidence.keywordScores ?? null,
      semantic: evidence.semantic?.available
        ? { bestKind: evidence.semantic.bestKind, bestScore: evidence.semantic.bestScore }
        : null
    },
    location: {
      province: chosen.normalizedProvince ?? chosen.province,
      district: chosen.normalizedDistrict ?? chosen.district,
      subdistrict: chosen.normalizedSubdistrict ?? chosen.subdistrict,
      waterbody: chosen.normalizedWaterbody,
      place: evidence.location?.place ?? null,
      precision: chosen.locationPrecision,
      latitude: chosen.latitude,
      longitude: chosen.longitude,
      evidence: {
        matched: evidence.location?.matched ?? [],
        fuzzy: evidence.location?.fuzzy ?? []
      }
    },
    dedupe: {
      isDuplicate: chosen.duplicateOfId !== null,
      duplicateOfId: chosen.duplicateOfId
    },
    event: eventLink
      ? {
          slug: eventLink.slug,
          status: eventLink.status,
          kind: eventLink.kind,
          province: eventLink.province,
          eventDate: eventLink.eventDate?.toISOString() ?? null,
          memberCount: eventLink.observations.length,
          role: chosen.eventCandidates[0]?.role ?? 'supporting',
          sources: [...new Set(eventLink.observations.map((row) => row.observation.sourceName))]
        }
      : null,
    priority
  };
}

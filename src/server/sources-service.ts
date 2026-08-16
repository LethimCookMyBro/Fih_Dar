import 'server-only';

import { prisma } from '@/lib/prisma';

/**
 * A run that is RUNNING for substantially longer than a normal refresh
 * (minutes) is stale — likely an externally killed process. Conservative:
 * 3 hours is far beyond any observed run and far below the 6h schedule.
 */
const STALE_RUN_MS = 3 * 60 * 60 * 1000;

/** Display definitions for the two implemented sources — the API only ever
 * reports these, never invents a third source. */
const SOURCE_DEFINITIONS = [
  { id: 'google-news-th', label: 'Google News RSS', category: 'ข่าวสาธารณะ' },
  { id: 'data.go.th', label: 'data.go.th', category: 'ข้อมูลเปิดภาครัฐ' }
];

type SourceResult = {
  sourceName: string;
  ok: boolean;
  matched: number;
  created: number;
  skipped: number;
  error: string | null;
};

function sanitizeStatus(
  runStatus: string | null,
  sourceOk: boolean | null
): 'OK' | 'DEGRADED' | 'UNKNOWN' {
  if (runStatus === null || sourceOk === null) return 'UNKNOWN';
  if (runStatus === 'FAILED') return 'DEGRADED';
  if (runStatus === 'PARTIAL') return sourceOk ? 'OK' : 'DEGRADED';
  return sourceOk ? 'OK' : 'DEGRADED';
}

/**
 * Public, read-only operational summary of the ingestion pipeline.
 *
 * All values come from the database — no fabricated numbers. Source status is
 * derived from IngestionRun history (lastCheckedAt, per-source ok) plus
 * ExternalObservation counts (total, last new data). A stale RUNNING run is
 * reported as such without mutating the row.
 */
export async function getSourcesSummary() {
  const [
    latestRun,
    observationCounts,
    processingCounts,
    verdictCounts,
    eventCandidateCount,
    lastCreatedBySource
  ] = await Promise.all([
    prisma.ingestionRun.findFirst({ orderBy: { startedAt: 'desc' } }),
    prisma.externalObservation.groupBy({ by: ['sourceName'], _count: { _all: true } }),
    prisma.externalObservation.groupBy({ by: ['processingStatus'], _count: { _all: true } }),
    prisma.externalObservation.groupBy({ by: ['relevanceVerdict'], _count: { _all: true } }),
    prisma.eventCandidate.count(),
    prisma.externalObservation.groupBy({ by: ['sourceName'], _max: { createdAt: true } })
  ]);

  const totalObservations = observationCounts.reduce((sum, item) => sum + item._count._all, 0);

  const latestRunResult = latestRun
    ? {
        status: latestRun.status,
        startedAt: latestRun.startedAt.toISOString(),
        finishedAt: latestRun.finishedAt?.toISOString() ?? null,
        durationMs: latestRun.finishedAt
          ? Math.max(0, latestRun.finishedAt.getTime() - latestRun.startedAt.getTime())
          : null,
        createdCount: latestRun.createdCount,
        skippedCount: latestRun.skippedCount,
        processedCount: latestRun.processedCount,
        failedCount: latestRun.failedCount,
        isStale:
          latestRun.status === 'RUNNING' &&
          Date.now() - latestRun.startedAt.getTime() > STALE_RUN_MS
      }
    : null;

  const latestSourceResults = (latestRun?.sourceResults ?? []) as SourceResult[];

  const sources = SOURCE_DEFINITIONS.map((definition) => {
    const sourceResult =
      latestSourceResults.find((result) => result.sourceName === definition.id) ?? null;
    const status = sanitizeStatus(
      latestRunResult?.status ?? null,
      sourceResult ? sourceResult.ok : null
    );
    return {
      id: definition.id,
      label: definition.label,
      category: definition.category,
      status,
      lastCheckedAt: latestRunResult?.finishedAt ?? null,
      lastNewObservationAt:
        lastCreatedBySource
          .find((item) => item.sourceName === definition.id)
          ?._max.createdAt?.toISOString() ?? null,
      totalObservations:
        observationCounts.find((item) => item.sourceName === definition.id)?._count._all ?? 0
    };
  });

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
    eventCandidates: eventCandidateCount
  };

  return {
    generatedAt: new Date().toISOString(),
    latestRun: latestRunResult,
    sources,
    pipeline
  };
}

/** Shape returned by GET /api/sources/summary — sanitized operational data, all from DB. */
export interface LatestRun {
  status: 'RUNNING' | 'SUCCEEDED' | 'PARTIAL' | 'FAILED';
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  createdCount: number;
  skippedCount: number;
  processedCount: number;
  failedCount: number;
  isStale: boolean;
}

export interface SourceStatus {
  id: string;
  label: string;
  category: string;
  status: 'OK' | 'DEGRADED' | 'UNKNOWN';
  lastCheckedAt: string | null;
  lastNewObservationAt: string | null;
  totalObservations: number;
}

export interface PipelineStats {
  externalObservations: number;
  raw: number;
  processed: number;
  failed: number;
  relevant: number;
  irrelevant: number;
  uncertain: number;
  eventCandidates: number;
}

export interface SourcesSummary {
  generatedAt: string;
  latestRun: LatestRun | null;
  recentRuns: RecentRun[];
  sources: SourceStatus[];
  pipeline: PipelineStats;
}

/** One row of recent run history from /api/sources/summary. */
export interface RecentRun {
  id: string;
  status: LatestRun['status'];
  startedAt: string;
  finishedAt: string | null;
  createdCount: number;
  skippedCount: number;
  processedCount: number;
  failedCount: number;
  isStale: boolean;
}

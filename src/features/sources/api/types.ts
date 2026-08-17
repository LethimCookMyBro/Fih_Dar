/** Shape returned by GET /api/sources/summary — sanitized operational data, all from DB. */
export type RunStatus = 'RUNNING' | 'SUCCEEDED' | 'PARTIAL' | 'FAILED';
export type RunTrigger = 'MANUAL' | 'SCHEDULED';
export type SourceStatus = 'OK' | 'DEGRADED' | 'UNKNOWN';

export interface LatestRun {
  status: RunStatus;
  trigger: RunTrigger;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  createdCount: number;
  skippedCount: number;
  processedCount: number;
  failedCount: number;
  errorSummary: string | null;
  isStale: boolean;
}

export interface RecentRun {
  id: string;
  trigger: RunTrigger;
  status: RunStatus;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  createdCount: number;
  skippedCount: number;
  processedCount: number;
  failedCount: number;
  errorSummary: string | null;
  isStale: boolean;
}

export interface SourceStatusRow {
  id: string;
  label: string;
  category: string;
  transport: string;
  authorityType: string;
  status: SourceStatus;
  lastCheckedAt: string | null;
  lastNewObservationAt: string | null;
  totalObservations: number;
  /** Lifetime count of this source's observations with relevanceVerdict=RELEVANT. */
  relevantObservations: number;
  /** This source's matched/created counts in the latest run only (null if not run yet). */
  lastRunMatched: number | null;
  lastRunCreated: number | null;
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
  citizenReports: number;
}

export interface SourcesSummary {
  generatedAt: string;
  latestRun: LatestRun | null;
  recentRuns: RecentRun[];
  sources: SourceStatusRow[];
  pipeline: PipelineStats;
}

// --- /api/sources (paginated registry list) ----------------------------------
export interface SourceListItem {
  id: string;
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
  status: SourceStatus;
  lastCheckedAt: string | null;
  lastNewObservationAt: string | null;
  totalObservations: number;
  relevantObservations: number;
  lastRunMatched: number | null;
  lastRunCreated: number | null;
}

export interface SourceListResponse {
  generatedAt: string;
  sources: SourceListItem[];
  summary: { total: number; healthy: number; degraded: number; unknown: number };
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export type SourceListSort = 'name' | 'observations' | 'latest' | 'status';

// --- /api/sources/[slug] ------------------------------------------------------
export interface SourceDetail extends SourceListItem {
  coverageMetadata: unknown;
  createdAt: string;
  updatedAt: string;
  lastSuccessAt: string | null;
}

// --- /api/sources/runs --------------------------------------------------------
export interface SourceRunRow {
  id: string;
  trigger: RunTrigger;
  status: RunStatus;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  createdCount: number;
  skippedCount: number;
  processedCount: number;
  failedCount: number;
  errorSummary: string | null;
  isStale: boolean;
  sourceResults: unknown;
}

export interface SourceRunsResponse {
  generatedAt: string;
  runs: SourceRunRow[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

// --- /api/sources/trace -------------------------------------------------------
export interface SignalTrace {
  generatedAt: string;
  observation: {
    id: string;
    sourceName: string;
    sourceUrl: string;
    title: string;
    description: string | null;
    publishedAt: string | null;
    scrapedAt: string;
  };
  species: { evidence: string; terms: string[] };
  relevance: {
    verdict: string | null;
    kind: string | null;
    finalVerdict: { verdict: string; reason: string } | null;
    keywordScores: Record<string, number> | null;
    semantic: { bestKind?: string; bestScore?: number } | null;
  };
  location: {
    province: string | null;
    district: string | null;
    subdistrict: string | null;
    waterbody: string | null;
    place: string | null;
    precision: string;
    latitude: number | null;
    longitude: number | null;
    evidence: { matched: string[]; fuzzy: string[] };
  };
  dedupe: { isDuplicate: boolean; duplicateOfId: string | null };
  event: {
    slug: string;
    status: string;
    kind: string | null;
    province: string | null;
    eventDate: string | null;
    memberCount: number;
    role: string;
    sources: string[];
  } | null;
  priority: {
    score: number;
    independentSourceCount: number;
    breakdown: {
      recency: { score: number; ageDays: number | null; weight: number };
      corroboration: { score: number; independentSourceCount: number; weight: number };
      location: { score: number; precision: string; weight: number };
    };
    sources: string[];
  } | null;
}

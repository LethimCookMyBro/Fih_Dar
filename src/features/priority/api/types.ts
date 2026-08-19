import type { LocationPrecision } from '@/features/reports/api/types';

/** Shape returned by /api/events/priority. EXPERIMENTAL MVP ranking — see docs/FIHDAR_PRIORITY_MVP.md. */
export interface PriorityBreakdownEntry {
  score: number;
  weight: number;
  [key: string]: unknown;
}

/**
 * HIGH/MEDIUM/LOW/UNKNOWN — never a fabricated percentage, and never a
 * calibrated statistical probability. See scripts/intel/confidence.mjs for
 * the deterministic rule behind each dimension.
 */
export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';

export interface EvidenceConfidence {
  /** Heuristic keyword/semantic evidence strength — never a confirmed field identification. */
  species: ConfidenceLevel;
  location: ConfidenceLevel;
  time: ConfidenceLevel;
  /**
   * How many independent outlets corroborate the event (evidence diversity).
   * Deliberately NOT named "provenance" — this pipeline has no chain-of-custody
   * signal for external observations to back that claim.
   */
  sourceCorroboration: ConfidenceLevel;
}

export interface PriorityArea {
  slug: string;
  kind: string | null;
  areaLabel: string;
  province: string | null;
  place: string | null;
  locationPrecision: LocationPrecision;
  coordinate: { latitude: number; longitude: number } | null;
  eventDate: string | null;
  mostRecentPublishedAt: string | null;
  score: number;
  breakdown: {
    recency: PriorityBreakdownEntry & { ageDays: number | null };
    corroboration: PriorityBreakdownEntry & { independentSourceCount: number };
    location: PriorityBreakdownEntry & { precision: LocationPrecision };
  };
  independentSourceCount: number;
  /** Algorithm version the persisted score was computed under — see PRIORITY_VERSION. */
  priorityVersion: string | null;
  /** When the intelligence pipeline last computed this score — never "live". */
  priorityComputedAt: string | null;
  /** The current PRE-FIELD officer call on this event, if any — see EventDecision. */
  operationalDecision: 'DISPATCH' | 'MONITOR' | 'DEFER' | null;
  confidence: EvidenceConfidence;
  sources: string[];
  members: {
    title: string;
    sourceName: string;
    sourceUrl: string;
    publishedAt: string | null;
    isDuplicate: boolean;
  }[];
}

export interface PriorityResponse {
  version: string | null;
  areas: PriorityArea[];
  hasMore: boolean;
  nextCursor: string | null;
}

/** Full evidence for one event, loaded on demand — see getPriorityAreaDetail(). */
export interface PriorityAreaDetail {
  slug: string;
  score: number | null;
  priorityVersion: string | null;
  priorityComputedAt: string | null;
  members: {
    title: string;
    sourceName: string;
    sourceUrl: string;
    publishedAt: string | null;
    isDuplicate: boolean;
  }[];
}

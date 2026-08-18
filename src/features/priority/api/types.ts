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
  locationPrecision: string;
  coordinate: { latitude: number; longitude: number } | null;
  eventDate: string | null;
  mostRecentPublishedAt: string | null;
  score: number;
  breakdown: {
    recency: PriorityBreakdownEntry & { ageDays: number | null };
    corroboration: PriorityBreakdownEntry & { independentSourceCount: number };
    location: PriorityBreakdownEntry & { precision: string };
  };
  independentSourceCount: number;
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
  version: string;
  areas: PriorityArea[];
}

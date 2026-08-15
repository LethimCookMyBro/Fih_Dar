/** Shape returned by /api/events/priority. EXPERIMENTAL MVP ranking — see docs/FIHDAR_PRIORITY_MVP.md. */
export interface PriorityBreakdownEntry {
  score: number;
  weight: number;
  [key: string]: unknown;
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

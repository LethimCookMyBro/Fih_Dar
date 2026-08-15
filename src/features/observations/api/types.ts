/** Shape returned by /api/observations/public. */
export interface ExternalObservation {
  id: string;
  sourceName: string;
  title: string;
  description: string | null;
  province: string | null;
  latitude: number | null;
  longitude: number | null;
  publishedAt: string | null;
  sourceUrl: string;
}

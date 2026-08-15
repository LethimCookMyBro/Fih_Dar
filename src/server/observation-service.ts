import 'server-only';

import { prisma } from '@/lib/prisma';

const publicObservationSelect = {
  id: true,
  sourceName: true,
  title: true,
  description: true,
  province: true,
  latitude: true,
  longitude: true,
  publishedAt: true,
  sourceUrl: true
} as const;

/**
 * Public read of ingested external observations. These come from public
 * sources (government open data, news feeds) and carry no personal data, so
 * the list is public — but ingestion itself is CLI-only (`npm run db:ingest`),
 * never exposed through an endpoint.
 *
 * Only coordinate-bearing rows are useful to the map; the API returns all rows
 * and lets the client decide, so province-only mentions remain available.
 */
export async function listPublicObservations() {
  const observations = await prisma.externalObservation.findMany({
    orderBy: [{ publishedAt: 'desc' }, { scrapedAt: 'desc' }],
    take: 200,
    select: publicObservationSelect
  });
  return observations.map((observation) => ({
    ...observation,
    publishedAt: observation.publishedAt?.toISOString() ?? null
  }));
}

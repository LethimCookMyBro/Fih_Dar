// Waterway association worker.
//
//   npm run waterways:analyze
//
// For every PROCESSED observation that carries SOURCE-provided coordinates,
// computes the nearest OSM waterway and stores the derived association in
// derivedNearestWaterway / derivedDistanceMeters / derivedWaterwaySource.
// Coordinates are never invented: observations without source coordinates are
// left untouched (the current corpus has none — the module is exercised below
// with clearly-marked synthetic test points, not persisted).

import { PrismaClient } from '@prisma/client';

import { nearestWaterway, loadWaterways } from './nearest.mjs';

const prisma = new PrismaClient();

async function main() {
  const dataset = loadWaterways();
  console.log(`waterways: ${dataset.features.length} segments loaded`);

  const observations = await prisma.externalObservation.findMany({
    where: { processingStatus: 'PROCESSED', latitude: { not: null }, longitude: { not: null } }
  });
  console.log(`observations with source coordinates: ${observations.length}`);
  let updated = 0;
  for (const observation of observations) {
    const nearest = nearestWaterway(observation.latitude, observation.longitude);
    await prisma.externalObservation.update({
      where: { id: observation.id },
      data: {
        derivedNearestWaterway: nearest ? (nearest.name ?? nearest.waterway) : null,
        derivedDistanceMeters: nearest ? nearest.distanceMeters : null,
        derivedWaterwaySource: nearest ? `OSM EEC extract (${nearest.osmId})` : null
      }
    });
    updated += 1;
    console.log(
      `  ${observation.id} (${observation.latitude}, ${observation.longitude}) → ` +
      `${nearest ? `${nearest.name ?? nearest.waterway} @ ${nearest.distanceMeters}m` : 'no waterway found'}`
    );
  }

  // --- Synthetic demonstration points (NOT persisted, NOT real observations) ---
  // Exercises the module end-to-end so the derived-association path is proven
  // even while the real corpus has no coordinate-bearing rows.
  const demo = [
    { label: 'Bang Pakong River mouth area (synthetic)', lat: 13.45, lon: 100.98 },
    { label: 'Nong Khok reservoir area, Rayong (synthetic)', lat: 12.82, lon: 101.2 },
    { label: 'Pattaya beachfront (synthetic)', lat: 12.93, lon: 100.88 }
  ];
  console.log('--- synthetic demo points (not persisted) ---');
  for (const point of demo) {
    const nearest = nearestWaterway(point.lat, point.lon);
    console.log(`  ${point.label}: ${nearest ? `${nearest.name ?? nearest.waterway} @ ${nearest.distanceMeters}m` : 'no waterway found'}`);
  }
  console.log(`done: ${updated} observation(s) updated`);
}

main()
  .catch((error) => {
    console.error('analyze failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

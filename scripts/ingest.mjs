// External-data ingestion — CLI entry point.
//
//   npm run db:ingest
//
// Pulls public, structured information about blackchin tilapia / tilapia in
// Eastern Thailand into the ExternalObservation table. FihDar never claims
// these are confirmed occurrences — they are provenance-tracked observations
// from named public sources.
//
// The orchestration lives in scripts/ingestion/run-ingestion.mjs so the same
// pipeline can be driven by the refresh runner (scripts/refresh-intelligence.mjs)
// and tested deterministically (npm run ingest:test). This file only wires a
// PrismaClient and prints the result.
import { PrismaClient } from '@prisma/client';

import { runIngestion } from './ingestion/run-ingestion.mjs';

const prisma = new PrismaClient();

async function main() {
  console.log('FihDar external-data ingestion');
  const result = await runIngestion({ prisma });

  const [total, bySource] = await Promise.all([
    prisma.externalObservation.count(),
    prisma.externalObservation.groupBy({ by: ['sourceName'], _count: { _all: true } })
  ]);
  console.log(
    `external observations in database: ${total} (${bySource
      .map((item) => `${item.sourceName}=${item._count._all}`)
      .join(', ')})`
  );
  console.log(`ingestion result: ${result.status} (created=${result.totalCreated} skipped=${result.totalSkipped} failedSources=${result.failedSources})`);

  if (result.status === 'FAILED') process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error('ingest failed:', error.message ?? error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

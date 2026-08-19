// Compute and persist priorityScore/breakdown/confidence for EventCandidate
// rows. Two callers:
//   - process.mjs calls this with `refreshAll: true` at the end of EVERY
//     intelligence run, recomputing every candidate (not just ones this run
//     touched) so recency decay and PRIORITY_VERSION bumps never leave a
//     score stale for longer than one ingestion cycle.
//   - This file run directly (`refreshAll: false`, the CLI default) only
//     catches up rows that predate this feature (priorityScore IS NULL) —
//     for a one-time migration-day backfill against a database the pipeline
//     hasn't run against yet.
//
//   node --env-file=.env scripts/intel/backfill-priority.mjs
//
// Safe to re-run either way: deterministic given the same DB state.

import { pathToFileURL } from 'node:url';

import { PrismaClient } from '@prisma/client';

import { computeEventPriority, PRIORITY_VERSION } from './priority.mjs';
import { deriveConfidence } from './confidence.mjs';
import { summarizeEventMembers } from './event-summary.mjs';

const OBSERVATION_SELECT = {
  id: true,
  sourceName: true,
  sourceUrl: true,
  title: true,
  publishedAt: true,
  latitude: true,
  longitude: true,
  normalizedProvince: true,
  locationPrecision: true,
  duplicateOfId: true,
  evidence: true
};

export async function backfillPriority({ prisma, logger = console, refreshAll = false } = {}) {
  const candidates = await prisma.eventCandidate.findMany({
    where: refreshAll ? {} : { priorityScore: null },
    select: {
      id: true,
      slug: true,
      observations: { select: { observation: { select: OBSERVATION_SELECT } } }
    }
  });

  let updated = 0;
  for (const candidate of candidates) {
    const members = candidate.observations.map((row) => row.observation);
    const summary = summarizeEventMembers(members);
    const priority = computeEventPriority(
      { members, mostRecentPublishedAt: summary.mostRecentPublishedAt, locationPrecision: summary.locationPrecision }
    );
    const confidence = deriveConfidence(
      { members, mostRecentPublishedAt: summary.mostRecentPublishedAt, locationPrecision: summary.locationPrecision },
      priority
    );

    await prisma.eventCandidate.update({
      where: { id: candidate.id },
      data: {
        locationPrecision: summary.locationPrecision,
        priorityScore: priority.score,
        priorityVersion: PRIORITY_VERSION,
        priorityBreakdown: priority.breakdown,
        priorityConfidence: confidence,
        independentSourceCount: priority.independentSourceCount,
        priorityComputedAt: new Date()
      }
    });
    updated += 1;
  }

  logger.log(
    `priority ${refreshAll ? 'refresh' : 'backfill'}: ${updated} of ${candidates.length} candidate(s) updated`
  );
  return { candidatesConsidered: candidates.length, updated };
}

async function main() {
  const prisma = new PrismaClient();
  try {
    await backfillPriority({ prisma });
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

// Ingestion orchestration — runs every configured source with failure
// isolation and returns a structured, persistable result.
//
//   runIngestion({ prisma, fetchFn }) → {
//     sources: [{ sourceName, ok, matched, created, skipped, error }],
//     totalCreated, totalSkipped, failedSources, status
//   }
//
// One source failing never destroys another source's data: each source runs
// in its own try/catch, successful rows are persisted, and the aggregate
// status reflects reality (SUCCEEDED / PARTIAL / FAILED). `status` is derived
// by the pure `ingestionStatus()` helper so tests can pin the rules.

import { SOURCE_DEFINITIONS } from './sources.mjs';

/** Skip rows already present under (sourceName, sourceExternalId); never overwrite. */
export async function upsertObservations(prisma, observations, sourceLabel) {
  let created = 0;
  let skipped = 0;
  for (const observation of observations) {
    const existing = await prisma.externalObservation.findUnique({
      where: {
        sourceName_sourceExternalId: {
          sourceName: observation.sourceName,
          sourceExternalId: observation.sourceExternalId
        }
      },
      select: { id: true }
    });
    if (existing) {
      skipped += 1;
      continue; // dedupe: never overwrite an existing observation
    }
    await prisma.externalObservation.create({ data: observation });
    created += 1;
  }
  return { created, skipped };
}

/**
 * Deterministic status over per-source results:
 * - zero sources → FAILED (nothing was checked)
 * - every source ok → SUCCEEDED
 * - ≥1 ok and ≥1 failed → PARTIAL
 * - every source failed → FAILED
 */
export function ingestionStatus(sourceResults) {
  if (sourceResults.length === 0) return 'FAILED';
  const failed = sourceResults.filter((source) => !source.ok).length;
  if (failed === sourceResults.length) return 'FAILED';
  if (failed > 0) return 'PARTIAL';
  return 'SUCCEEDED';
}

/** Run all configured sources; returns the aggregate result (never throws for a source failure). */
export async function runIngestion({ prisma, fetchFn = fetch }) {
  const sourceResults = [];
  let totalCreated = 0;
  let totalSkipped = 0;

  for (const source of SOURCE_DEFINITIONS) {
    const result = { sourceName: source.id, ok: false, matched: 0, created: 0, skipped: 0, error: null };
    try {
      const observations = await source.fetch(fetchFn);
      result.matched = observations.length;
      const { created, skipped } = await upsertObservations(prisma, observations, source.id);
      result.created = created;
      result.skipped = skipped;
      result.ok = true;
    } catch (error) {
      result.error = String(error?.message ?? error);
    }
    totalCreated += result.created;
    totalSkipped += result.skipped;
    sourceResults.push(result);
    console.log(
      `  ${source.id}: matched=${result.matched} created=${result.created} skipped=${result.skipped}${result.ok ? '' : ` failed=${result.error}`}`
    );
  }

  return {
    sources: sourceResults,
    totalCreated,
    totalSkipped,
    failedSources: sourceResults.filter((source) => !source.ok).length,
    status: ingestionStatus(sourceResults)
  };
}

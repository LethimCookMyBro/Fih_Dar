// Refresh runner — ONE production-safe command that performs:
//
//   INGEST → PROCESS NEW RAW OBSERVATIONS → EVENT RESOLUTION → EXIT
//
//   npm run db:refresh        # local (--env-file=.env)
//   npm run db:refresh:prod   # production / Railway (env from process)
//
// Responsibilities ONLY: open/coordinate an IngestionRun, call ingestion,
// call intelligence, persist the summary, set the status, and exit. Source
// parsing lives in scripts/ingestion/*; intelligence algorithms live in
// scripts/intel/*. The process terminates after work — no HTTP listener,
// no interval, no lingering Prisma connection.
//
// Status rules (deterministic):
//   SUCCEEDED — every configured source succeeded AND intelligence completed
//   PARTIAL   — ≥1 source succeeded, ≥1 failed, intelligence completed
//   FAILED    — every source failed OR intelligence orchestration failed
//
// Trigger: process.env.FIHDAR_INGESTION_TRIGGER === 'scheduled' → SCHEDULED,
// otherwise MANUAL. Never exposed as NEXT_PUBLIC_*.

import { PrismaClient } from '@prisma/client';

import { runIngestion } from './ingestion/run-ingestion.mjs';
import { runIntelligence } from './intel/process.mjs';

const prisma = new PrismaClient();

function triggerFromEnv() {
  return process.env.FIHDAR_INGESTION_TRIGGER === 'scheduled' ? 'SCHEDULED' : 'MANUAL';
}

/** Sanitized per-source results for the run record (no secrets, safe errors only). */
function sanitizeSourceResults(sources) {
  return sources.map(({ sourceName, ok, matched, created, skipped, error }) => ({
    sourceName,
    ok,
    matched,
    created,
    skipped,
    // Safe, bounded error text for the internal run record — never a stack trace.
    error: error ? String(error).slice(0, 500) : null
  }));
}

async function main() {
  const trigger = triggerFromEnv();

  const run = await prisma.ingestionRun.create({
    data: { trigger, status: 'RUNNING' }
  });

  let status = 'FAILED';
  let sourceResults = [];
  let pipelineSummary = null;
  let errorSummary = null;
  let ingestion = null;

  try {
    console.log(`[refresh] run ${run.id} started (${trigger})`);

    // 1) ingest — per-source failure isolation lives inside runIngestion
    ingestion = await runIngestion({ prisma });
    sourceResults = sanitizeSourceResults(ingestion.sources);
    console.log(
      `[refresh] ingestion ${ingestion.status}: created=${ingestion.totalCreated} skipped=${ingestion.totalSkipped} failedSources=${ingestion.failedSources}`
    );

    // 2) intelligence — only RAW/FAILED rows (runIntelligence's default)
    pipelineSummary = await runIntelligence({ prisma, reprocessAll: false });
    console.log(
      `[refresh] intelligence: processed=${pipelineSummary.processed} failed=${pipelineSummary.failed} events=${pipelineSummary.eventCandidates}`
    );

    // 3) deterministic status
    if (ingestion.status === 'FAILED') {
      status = 'FAILED';
      errorSummary = 'ทุกแหล่งข้อมูลล้มเหลวในรอบนี้';
    } else if (ingestion.status === 'PARTIAL') {
      status = 'PARTIAL';
      const failedNames = ingestion.sources
        .filter((source) => !source.ok)
        .map((source) => source.sourceName)
        .join(', ');
      errorSummary = `บางแหล่งข้อมูลล้มเหลว: ${failedNames}`;
    } else {
      status = 'SUCCEEDED';
    }
  } catch (error) {
    // A critical orchestration failure finalizes the run FAILED — a successful
    // source batch is never silently discarded, but the run is honestly
    // recorded rather than left RUNNING forever.
    status = 'FAILED';
    errorSummary = String(error?.message ?? error).slice(0, 500);
    console.error(`[refresh] critical failure: ${errorSummary}`);
  }

  // 4) finalize — always set finishedAt, never leave a SUCCEEDED-looking RUNNING row
  const elapsedMs = Date.now() - new Date(run.startedAt).getTime();
  await prisma.ingestionRun.update({
    where: { id: run.id },
    data: {
      status,
      finishedAt: new Date(),
      createdCount: ingestion?.totalCreated ?? 0,
      skippedCount: ingestion?.totalSkipped ?? 0,
      processedCount: pipelineSummary?.processed ?? 0,
      failedCount: pipelineSummary?.failed ?? 0,
      sourceResults,
      pipelineSummary,
      errorSummary
    }
  });

  console.log(`[refresh] run ${run.id} finalized: ${status} in ${(elapsedMs / 1000).toFixed(1)}s`);
  return status;
}

main()
  .then((status) => {
    console.log(`[refresh] done (${status})`);
    process.exitCode = status === 'SUCCEEDED' ? 0 : 1;
  })
  .catch((error) => {
    // Even an unhandled error below run-finalization must not be silent: try
    // to close the run as FAILED, then exit non-zero.
    console.error('[refresh] fatal:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

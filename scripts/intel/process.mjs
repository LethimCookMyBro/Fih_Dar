// Intelligence worker — the batch pipeline that turns RAW external
// observations into PROCESSED, enriched rows.
//
//   npm run db:intel            # process only RAW rows
//   npm run db:intel -- --all   # reprocess every row (idempotent)
//
// Architecture (RAW → PROCESSING → ENRICHED):
//   normalize → species/keyword classification → location extraction
//   → semantic relevance (optional, cached) → verdict + evidence
//   → near-duplicate linking → event candidate resolution
//
// Failure isolation: per-row failures mark the row FAILED and never abort the
// batch; embedding failures degrade to keyword-only relevance; the raw source
// text is never modified. Run this offline — nothing here runs in the Next.js
// request path.
//
// The pipeline logic lives in `runIntelligence()` so the refresh runner
// (scripts/refresh-intelligence.mjs) can call it and persist its summary.
// No algorithm, threshold, or model was changed in this refactor — only the
// entry point was extracted.

import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { PrismaClient } from '@prisma/client';

import { sha256Hex } from './normalize.mjs';
import { extractLocation } from './locations.mjs';
import { scoreRelevance, PROTOTYPES } from './relevance.mjs';
import { findNearDuplicates } from './dedupe.mjs';
import { resolveEvents } from './events.mjs';
import { embedTexts, cosineSimilarity } from './embed.mjs';
import { runReassessmentMatches } from './reassess.mjs';

const require = createRequire(import.meta.url);

/**
 * Run the intelligence batch over observations and return a structured
 * summary for orchestrators:
 *
 *   { rowsConsidered, processed, failed, verdicts, nearDuplicatesLinked, eventCandidates, reassessedReports }
 *
 * Reprocessing selects RAW + FAILED rows (retryable); `reprocessAll`
 * selects everything. Algorithms and thresholds are untouched.
 *
 * After event resolution, acted-on reports (MONITORING / ACTION_TAKEN /
 * VERIFIED / FIELD_CHECKED) are automatically reopened for reassessment when
 * a newly relevant observation matches their location — see reassess.mjs.
 */
export async function runIntelligence({ prisma, reprocessAll = false, logger = console } = {}) {
  const t0 = Date.now();
  // RAW + FAILED are retryable; PROCESSED rows are skipped unless --all.
  const where = reprocessAll ? {} : { processingStatus: { in: ['RAW', 'FAILED'] } };
  const observations = await prisma.externalObservation.findMany({
    where,
    orderBy: { scrapedAt: 'asc' }
  });
  logger.log(`intel: ${observations.length} observation(s) to process (${reprocessAll ? 'all' : 'raw only'})`);

  // ---- batch embedding (optional; failure degrades gracefully) --------------
  const texts = observations.map((o) => `${o.title} ${o.description ?? ''}`.trim());
  let vectors = null;
  let prototypeVectors = null;
  let embeddingAvailable = false;
  if (texts.length > 0) {
    const embedded = await embedTexts(texts);
    if (!embedded.vectors) {
      logger.log(`intel: ${embedded.reason} — continuing with keyword-only relevance`);
    } else {
      vectors = embedded.vectors;
      embeddingAvailable = true;
      const prototypes = await embedTexts(Object.values(PROTOTYPES), { kind: 'query' });
      prototypeVectors = prototypes.vectors;
    }
  }

  // ---- per-row processing ---------------------------------------------------
  const results = [];
  let failed = 0;
  for (let i = 0; i < observations.length; i += 1) {
    const observation = observations[i];
    try {
      const semantic = vectors && prototypeVectors
        ? computeSemanticScores(vectors[i], prototypeVectors)
        : null;
      const scored = scoreRelevance(observation, semantic);
      const location = extractLocation(
        observation.title,
        observation.description,
        observation.latitude,
        observation.longitude
      );
      // Evidence is built once per row and reused by later stages (dedupe,
      // events) — later updates must merge into THIS object, never read the
      // stale DB copy back.
      const evidenceForDb = {
        pipelineVersion: 1,
        textHash: sha256Hex(`${observation.title} ${observation.description ?? ''}`),
        ...scored.evidence,
        location: { ...location.evidence, place: location.place ?? null }
      };
      results.push({ observation, scored, location, evidenceForDb });
    } catch (error) {
      failed += 1;
      logger.error(`intel: row ${observation.id} failed: ${error.message ?? error}`);
      await prisma.externalObservation.update({
        where: { id: observation.id },
        data: { processingStatus: 'FAILED', processingError: String(error?.message ?? error), processedAt: new Date() }
      });
    }
  }

  // ---- persist enrichment ---------------------------------------------------
  const updated = [];
  for (const { observation, scored, location, evidenceForDb } of results) {
    updated.push(
      prisma.externalObservation.update({
        where: { id: observation.id },
        data: {
          processingStatus: 'PROCESSED',
          processedAt: new Date(),
          processingError: null,
          locationPrecision: location.precision,
          normalizedProvince: location.province,
          normalizedDistrict: location.district,
          normalizedSubdistrict: location.subdistrict,
          normalizedWaterbody: location.waterbody,
          relevanceVerdict: scored.verdict,
          relevanceKind: scored.classification.kind,
          evidence: evidenceForDb
        }
      })
    );
  }
  await Promise.all(updated);

  // ---- near-duplicate linking ----------------------------------------------
  const nearDuplicates = results.length > 0
    ? findNearDuplicates(results.map((r) => r.observation))
    : new Map();
  let linked = 0;
  for (const [id, info] of nearDuplicates) {
    const row = results.find((r) => r.observation.id === id);
    if (!row) continue;
    // Merge into the freshly computed evidence — never the stale DB copy.
    const evidence = { ...row.evidenceForDb, nearDuplicate: info.evidence };
    await prisma.externalObservation.update({
      where: { id },
      data: {
        duplicateOfId: info.duplicateOfId,
        evidence
      }
    });
    linked += 1;
  }

  // ---- event candidates -----------------------------------------------------
  const relevant = results.filter((r) => r.scored.verdict === 'RELEVANT');
  const vectorsByObservation = new Map();
  if (vectors) {
    results.forEach((row, index) => vectorsByObservation.set(row.observation.id, vectors[index]));
  }
  const eventInput = relevant.map((row) => ({
    ...row.observation,
    normalizedProvince: row.location.province,
    relevanceKind: row.scored.classification.kind
  }));
  const events = resolveEvents(eventInput, vectorsByObservation);

  let eventsPersisted = 0;
  for (const candidate of events) {
    await prisma.eventCandidate.deleteMany({ where: { slug: candidate.slug } }); // idempotent re-group
    await prisma.eventCandidate.create({
      data: {
        slug: candidate.slug,
        status: candidate.status,
        kind: candidate.kind,
        province: candidate.province,
        eventDate: candidate.eventDate,
        evidence: candidate.evidence,
        observations: {
          create: candidate.members.map((member, index) => ({
            observationId: member.id,
            role: index === 0 ? 'primary' : 'supporting'
          }))
        }
      }
    });
    eventsPersisted += 1;
  }

  // ---- automatic reassessment ----------------------------------------------
  // Newly relevant observations can invalidate an officer's prior field
  // decision. Reopen matching acted-on reports for reassessment so the
  // situation on the ground is re-examined.
  const reassessedReports = await runReassessmentMatches({ prisma, relevant, logger });

  // ---- summary + score distributions ----------------------------------------
  const verdictCounts = { RELEVANT: 0, IRRELEVANT: 0, UNCERTAIN: 0 };
  const precisionCounts = {};
  const kindCounts = {};
  const semanticScores = [];
  for (const { scored, observation, location } of results) {
    verdictCounts[scored.verdict] += 1;
    precisionCounts[location.precision] = (precisionCounts[location.precision] ?? 0) + 1;
    kindCounts[scored.classification.kind] = (kindCounts[scored.classification.kind] ?? 0) + 1;
    if (scored.evidence.semantic?.available) {
      semanticScores.push({ id: observation.id, title: observation.title, ...scored.evidence.semantic });
    }
  }
  writeDistributions({ counts: { ...verdictCounts, FAILED: failed }, precisionCounts, kindCounts, semanticScores });

  logger.log(`intel: done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  logger.log(`  verdicts: ${JSON.stringify({ ...verdictCounts, FAILED: failed })}`);
  logger.log(`  precision: ${JSON.stringify(precisionCounts)}`);
  logger.log(`  kinds: ${JSON.stringify(kindCounts)}`);
  logger.log(`  near-duplicates linked: ${linked}`);
  logger.log(`  event candidates: ${eventsPersisted}`);
  logger.log(`  reports reopened for reassessment: ${reassessedReports}`);
  logger.log('  distributions written to .data/intel/distributions.json');

  return {
    rowsConsidered: observations.length,
    processed: results.length,
    failed,
    verdicts: verdictCounts,
    nearDuplicatesLinked: linked,
    eventCandidates: eventsPersisted,
    reassessedReports,
    embeddingAvailable
  };
}

function computeSemanticScores(vector, prototypeVectors) {
  const names = Object.keys(PROTOTYPES);
  const out = {};
  names.forEach((name, index) => {
    out[name] = prototypeVectors[index] ? cosineSimilarity(vector, prototypeVectors[index]) : null;
  });
  if (Object.values(out).some((score) => score === null)) return null;
  return { ...out, available: true };
}

function writeDistributions(data) {
  mkdirSync(join(process.cwd(), '.data', 'intel'), { recursive: true });
  writeFileSync(join(process.cwd(), '.data', 'intel', 'distributions.json'), JSON.stringify(data, null, 2));
}

async function main() {
  const prisma = new PrismaClient();
  const reprocessAll = process.argv.includes('--all');
  try {
    await runIntelligence({ prisma, reprocessAll });
  } finally {
    await prisma.$disconnect();
  }
}

// CLI entry point — only when run directly, never when imported by the
// refresh runner.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error('intel worker failed:', error);
    process.exitCode = 1;
  });
}

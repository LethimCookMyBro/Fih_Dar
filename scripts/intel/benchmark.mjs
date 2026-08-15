// Performance benchmark for the intelligence pipeline.
//
//   npm run intel:benchmark
//
// Reports: model size on disk, model load time, per-text embedding time
// (batched), peak RSS, and corpus throughput over the real observation text.
// Numbers are written to .data/intel/benchmark.json for the record.

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { PrismaClient } from '@prisma/client';

import { embedTexts } from './embed.mjs';
import { PROTOTYPES } from './relevance.mjs';

const prisma = new PrismaClient();

function dirSize(directory) {
  const { readdirSync } = require('node:fs');
  let total = 0;
  if (!existsSync(directory)) return 0;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) total += dirSize(full);
    else total += statSync(full).size;
  }
  return total;
}

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

async function main() {
  const report = {};
  const modelDir = join(process.cwd(), '.data', 'intel', 'models');
  report.modelSizeBytes = dirSize(modelDir);
  report.modelSizeMB = Math.round(report.modelSizeBytes / 1048576);

  const observations = await prisma.externalObservation.findMany({
    where: { processingStatus: 'PROCESSED' },
    select: { title: true, description: true }
  });
  const texts = observations.map((o) => `${o.title} ${o.description ?? ''}`.trim());

  // Warm-load timing (cache present on repeat runs).
  const tLoad = Date.now();
  const warm = await embedTexts(['x']);
  report.loadMs = Date.now() - tLoad;
  report.embeddingAvailable = warm.vectors !== null;

  if (warm.vectors) {
    // Fresh synthetic Thai texts (never cached) — measures real inference.
    const batchSize = 64;
    const fresh = Array.from(
      { length: batchSize },
      (_, i) => `ปลาหมอคางดำระบาดในพื้นที่ ฉะเชิงเทรา ชาวบ้านจับได้ ${i} ตัวต่อวัน`
    );
    const tEmbed = Date.now();
    await embedTexts(fresh);
    const elapsed = Date.now() - tEmbed;
    report.batchSize = batchSize;
    report.batchMs = elapsed;
    report.perTextMs = Math.round((elapsed / batchSize) * 10) / 10;
    report.throughputTextsPerSecond = Math.round((batchSize / elapsed) * 1000);

    // Corpus timing: fresh (uncached) — the real-world first-run cost.
    const freshCorpus = texts.map((text, index) => `${text} [bench-${Date.now()}-${index}]`);
    const tCorpus = Date.now();
    await embedTexts(freshCorpus);
    await embedTexts(Object.values(PROTOTYPES).map((t, i) => `${t} [bench-q-${i}]`), { kind: 'query' });
    report.corpusMs = Date.now() - tCorpus;
    report.corpusObservations = texts.length;
    report.note = 'fresh-text timings (uncached inference); cache makes re-runs near-instant';
  }

  report.peakRssMB = Math.round(process.memoryUsage().rss / 1048576);
  report.model = 'Xenova/multilingual-e5-small (intfloat/multilingual-e5-small, ONNX q8)';
  report.dimensions = 384;
  report.runAt = new Date().toISOString();

  mkdirSync(join(process.cwd(), '.data', 'intel'), { recursive: true });
  writeFileSync(join(process.cwd(), '.data', 'intel', 'benchmark.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((error) => {
    console.error('benchmark failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

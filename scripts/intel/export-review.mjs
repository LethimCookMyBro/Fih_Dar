// Review-ready export for human labeling.
//
//   npm run intel:export-review
//
// Writes .data/intel/review-export.jsonl — one JSON object per line in the
// Label Studio import format. The `data` field carries the text a reviewer
// needs, `label` pre-fills the pipeline's own verdict (editable), and `meta`
// carries provenance + the exact evidence the pipeline recorded, so a human
// can judge: relevant/irrelevant, possible sighting vs non-sighting, location
// correct/incorrect, duplicate vs independent, same event vs different event.
//
// This export is the seed of a labeled set for later threshold/model
// evaluation against real human decisions.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const observations = await prisma.externalObservation.findMany({
    where: { processingStatus: 'PROCESSED' },
    orderBy: { scrapedAt: 'asc' },
    include: { duplicateOf: { select: { id: true, title: true } } }
  });
  const candidates = await prisma.eventCandidate.findMany({
    include: { observations: { select: { observationId: true, role: true } } }
  });
  const eventByObservation = new Map();
  for (const candidate of candidates) {
    for (const member of candidate.observations) {
      eventByObservation.set(member.observationId, { slug: candidate.slug, kind: candidate.kind });
    }
  }

  const lines = [];
  for (const observation of observations) {
    const evidence = observation.evidence ?? {};
    const event = eventByObservation.get(observation.id);
    lines.push({
      data: {
        text: `${observation.title}\n${observation.description ?? ''}`.trim(),
        source: observation.sourceName,
        published: observation.publishedAt ? observation.publishedAt.toISOString() : null,
        url: observation.sourceUrl
      },
      label: [
        `verdict:${observation.relevanceVerdict ?? 'UNKNOWN'}`,
        `kind:${observation.relevanceKind ?? 'UNKNOWN'}`,
        `species:${evidence.speciesEvidence ?? 'NONE'}`,
        `location:${observation.locationPrecision ?? 'UNKNOWN'}`
      ],
      meta: {
        id: observation.id,
        sourceName: observation.sourceName,
        sourceUrl: observation.sourceUrl,
        location: {
          precision: observation.locationPrecision,
          province: observation.normalizedProvince,
          district: observation.normalizedDistrict,
          subdistrict: observation.normalizedSubdistrict,
          waterbody: observation.normalizedWaterbody
        },
        duplicateOf: observation.duplicateOf ? observation.duplicateOf.id : null,
        nearDuplicate: evidence.nearDuplicate ?? null,
        event: event ?? null,
        keywordScores: evidence.keywordScores ?? null,
        keywordHits: evidence.categoryHits ?? null,
        speciesTerms: evidence.speciesTerms ?? [],
        semantic: evidence.semantic ?? null,
        processingError: observation.processingError ?? null
      }
    });
  }

  mkdirSync(join(process.cwd(), '.data', 'intel'), { recursive: true });
  const output = join(process.cwd(), '.data', 'intel', 'review-export.jsonl');
  writeFileSync(output, lines.map((line) => JSON.stringify(line)).join('\n'));
  console.log(`wrote ${lines.length} review item(s) to ${output}`);
}

main()
  .catch((error) => {
    console.error('export failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

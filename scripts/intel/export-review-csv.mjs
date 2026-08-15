// Human-review CSV export for manual labeling.
//
//   npm run intel:export-review-csv
//
// Exports EVERY ingested ExternalObservation with the minimum review
// information (title, short excerpt, source, URL, extracted facts) and the
// pipeline's current results. All `human_*` columns are LEFT EMPTY — a human
// labels the corpus; the pipeline's thresholds are NOT calibrated until that
// labeled set exists (see docs/FIHDAR_INTELLIGENCE_SPEC.md).
//
// Output: .data/intel/human-review.csv (gitignored — generated artifact, not
// source). No full article bodies are exported: titles + a short excerpt cap.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const EXCERPT_CHARS = 240;

const COLUMNS = [
  'id',
  'sourceName',
  'sourceUrl',
  'title',
  'shortExcerpt',
  'publishedAt',
  'currentProvince',
  'currentDistrict',
  'currentWaterbody',
  'currentLocationPrecision',
  'currentRelevanceResult',
  'currentSpeciesResult',
  'currentDuplicateCandidate',
  'currentEventCandidate',
  // --- human labels (leave EMPTY) ---
  'human_relevance', // RELEVANT | IRRELEVANT | UNCERTAIN
  'human_event_type', // POSSIBLE_SIGHTING | CONTROL_REMOVAL | POLICY | RESEARCH | GENERAL_INFORMATION | OTHER | UNCERTAIN
  'human_species_evidence', // EXPLICIT_BLACKCHIN | AMBIGUOUS_TILAPIA | OTHER_SPECIES | NONE | UNCERTAIN
  'human_province_correct', // YES | NO | UNKNOWN
  'human_location_correct', // YES | NO | UNKNOWN
  'human_duplicate_group', // group id or empty
  'human_same_event_group', // group id or empty
  'human_note'
];

function csvEscape(value) {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

async function main() {
  const observations = await prisma.externalObservation.findMany({
    orderBy: { scrapedAt: 'asc' },
    include: { duplicateOf: { select: { id: true, title: true } } }
  });
  const candidates = await prisma.eventCandidate.findMany({
    include: { observations: { select: { observationId: true } } }
  });
  const eventByObservation = new Map();
  for (const candidate of candidates) {
    for (const member of candidate.observations) {
      eventByObservation.set(member.observationId, candidate.slug);
    }
  }

  const lines = [COLUMNS.map(csvEscape).join(',')];
  for (const observation of observations) {
    const evidence = observation.evidence ?? {};
    const excerpt = String(observation.description ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const row = [
      observation.id,
      observation.sourceName,
      observation.sourceUrl,
      observation.title,
      excerpt.slice(0, EXCERPT_CHARS),
      observation.publishedAt ? observation.publishedAt.toISOString() : '',
      observation.normalizedProvince ?? '',
      observation.normalizedDistrict ?? '',
      observation.normalizedWaterbody ?? '',
      observation.locationPrecision ?? '',
      observation.relevanceVerdict ?? '',
      evidence.speciesEvidence ?? '',
      observation.duplicateOf ? observation.duplicateOf.title : '',
      eventByObservation.get(observation.id) ?? '',
      // human columns — intentionally empty
      '', '', '', '', '', '', ''
    ];
    lines.push(row.map(csvEscape).join(','));
  }

  mkdirSync(join(process.cwd(), '.data', 'intel'), { recursive: true });
  const output = join(process.cwd(), '.data', 'intel', 'human-review.csv');
  writeFileSync(output, `${lines.join('\n')}\n`, 'utf8');
  console.log(`wrote ${observations.length} review row(s) to ${output}`);
  console.log('human_* columns left empty for manual labeling (CSV UTF-8).');
}

main()
  .catch((error) => {
    console.error('export failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

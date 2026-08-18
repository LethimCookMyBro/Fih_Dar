// Automatic report reassessment trigger.
//
// Completes the operational loop: after an officer resolves a report into a
// field outcome and it lands in MONITORING / ACTION_TAKEN / VERIFIED /
// FIELD_CHECKED, a NEW relevant external signal about the same place may mean
// the situation has changed. This module matches freshly relevant
// observations against acted-on reports and flips them back to REASSESSMENT
// so an officer re-evaluates them — without fabricating any field-action row
// (the officer still records the outcome of the re-visit).
//
// Matching is deliberately conservative and explainable:
//   - the report must have a normalized province (never invented here)
//   - signal province must equal report province
//   - when BOTH have a district, they must agree (never relax to province)
//   - the signal must be genuinely newer than the report's last FIELD VISIT
//     (the latest ReportFieldAction.createdAt — never SightingReport.updatedAt,
//     which can be bumped by unrelated writes, e.g. an operational-decision
//     record, that are not a field visit)
//   - "newer" is judged from the signal's REAL event time (publishedAt) when
//     known, falling back to scrapedAt only when publishedAt is unavailable —
//     ingestion time alone is never sufficient proof of a new biological
//     signal (an old article can be scraped long after the fact)
//   - the same observation never re-triggers a report it already triggered
//     (idempotent across --all reprocessing)
//
// Only the report's status and reassessmentTrigger are written — evidence,
// field actions, and event grouping are untouched.

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// Statuses a report may have reached after an officer acted on it. REASSESSMENT
// itself is excluded: a report already awaiting re-evaluation is never matched
// again until an officer acts on it once more.
export const REASSESSMENT_TRIGGER_STATUSES = ['MONITORING', 'ACTION_TAKEN', 'VERIFIED', 'FIELD_CHECKED'];

/**
 * Pure matcher over fixed inputs — no DB, no network. Returns the list of
 * { report, signal, matchedProvince, matchedDistrict } pairs whose acted-on
 * report should be reopened. Reports and signals are treated as plain data so
 * the logic is fully exercised by self-test.mjs.
 */
export function matchReportsForReassessment({ reports, signals }) {
  if (!reports || reports.length === 0 || !signals || signals.length === 0) return [];
  const seen = new Set();
  const matches = [];
  for (const signal of signals) {
    const { observation, location } = signal;
    for (const report of reports) {
      if (seen.has(report.id)) continue;
      if (!report.province) continue;
      if (report.province !== location.province) continue;
      if (report.district && location.district && report.district !== location.district) continue;
      if (report.reassessmentTrigger?.observationId === observation.id) continue;
      // Real event time first — an ingestion timestamp alone never proves the
      // underlying sighting is new (an old article can be scraped late).
      const eventTime = observation.publishedAt ?? observation.scrapedAt;
      const eventTimeMs = new Date(eventTime).getTime();
      // The last FIELD VISIT, never SightingReport.updatedAt — that column is
      // bumped by any write to the row (e.g. an operational decision), none
      // of which constitute "we already looked at this in the field".
      const lastActionAt = new Date(report.lastFieldActionAt ?? report.createdAt).getTime();
      if (!(eventTimeMs > lastActionAt)) continue;
      seen.add(report.id);
      matches.push({
        report,
        signal,
        matchedProvince: location.province,
        matchedDistrict: report.district ?? null
      });
    }
  }
  return matches;
}

/**
 * DB runner — reads acted-on reports, applies the pure matcher against this
 * run's RELEVANT rows, and writes status REASSESSMENT + reassessmentTrigger.
 * Failures propagate (consistent with event persistence). Returns the number
 * of reports reopened.
 */
export async function runReassessmentMatches({ prisma, relevant, logger = console }) {
  if (!relevant || relevant.length === 0) return 0;
  const reports = await prisma.sightingReport.findMany({
    where: { status: { in: REASSESSMENT_TRIGGER_STATUSES } },
    select: {
      id: true,
      province: true,
      district: true,
      status: true,
      createdAt: true,
      reassessmentTrigger: true,
      fieldActions: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } }
    }
  });
  if (reports.length === 0) return 0;
  const reportsWithLastAction = reports.map((report) => ({
    ...report,
    lastFieldActionAt: report.fieldActions[0]?.createdAt ?? null
  }));
  const signals = relevant.map((row) => ({ observation: row.observation, location: row.location }));
  const matches = matchReportsForReassessment({ reports: reportsWithLastAction, signals });
  for (const { report, signal } of matches) {
    await prisma.sightingReport.update({
      where: { id: report.id },
      data: {
        status: 'REASSESSMENT',
        reassessmentTrigger: {
          observationId: signal.observation.id,
          matchedAt: new Date().toISOString(),
          matchedProvince: report.province,
          matchedDistrict: report.district ?? null
        }
      }
    });
  }
  return matches.length;
}
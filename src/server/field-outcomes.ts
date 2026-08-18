// Pure mapping from a recorded field outcome to the resulting report status.
// Kept free of prisma/server-only so the deterministic self-test can import it.
import { FieldOutcome, ReportStatus } from '@prisma/client';

/**
 * A field action's outcome decides the report's next status. The mapping is
 * deliberately small and truthful — no bureaucratic workflow engine:
 *
 * - FOUND              → FIELD_CONFIRMED (field visit confirmed the sighting — distinct from desk VERIFIED)
 * - NOT_FOUND          → FIELD_CHECKED   (visited, nothing found)
 * - MISIDENTIFIED      → REJECTED        (species misidentified / not confirmed)
 * - CONTROLLED         → ACTION_TAKEN    (control action carried out)
 * - FOLLOW_UP_REQUIRED → MONITORING      (needs a follow-up visit)
 * - ACCESS_DENIED      → FIELD_CHECKED   (tried, could not enter the area)
 */
export const FIELD_OUTCOME_STATUS_MAP: Record<FieldOutcome, ReportStatus> = {
  FOUND: ReportStatus.FIELD_CONFIRMED,
  NOT_FOUND: ReportStatus.FIELD_CHECKED,
  MISIDENTIFIED: ReportStatus.REJECTED,
  CONTROLLED: ReportStatus.ACTION_TAKEN,
  FOLLOW_UP_REQUIRED: ReportStatus.MONITORING,
  ACCESS_DENIED: ReportStatus.FIELD_CHECKED
};

export function statusForOutcome(outcome: FieldOutcome): ReportStatus {
  return FIELD_OUTCOME_STATUS_MAP[outcome];
}

/**
 * Statuses a verified/acted report may hold. These stay visible on the public
 * map — acting on a report must never make it disappear.
 */
export const PUBLIC_REPORT_STATUSES: ReportStatus[] = [
  ReportStatus.VERIFIED,
  ReportStatus.FIELD_CONFIRMED,
  ReportStatus.FIELD_CHECKED,
  ReportStatus.ACTION_TAKEN,
  ReportStatus.MONITORING,
  ReportStatus.REASSESSMENT
];

export function isPubliclyVisibleStatus(status: ReportStatus): boolean {
  return PUBLIC_REPORT_STATUSES.includes(status);
}

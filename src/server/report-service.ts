import 'server-only';

import { randomBytes } from 'node:crypto';

import { prisma } from '@/lib/prisma';
import { Prisma, FieldOutcome, ReportStatus, OperationalDecisionType } from '@prisma/client';

import type { CurrentClerkUser } from './auth';
import { requireOfficer } from './authorization';
import { AppError, BadRequestError, NotFoundError } from './errors';
import {
  statusForOutcome,
  isPubliclyVisibleStatus,
  PUBLIC_REPORT_STATUSES
} from './field-outcomes';
import { getOrCreateCurrentProfile } from './profile-service';
import { deleteReportImage, storeReportImage } from './storage';
import { EEC_PILOT_PROVINCES } from './report-validation';
import type { ValidatedReportMetadata } from './report-validation';

const EEC_PROVINCES: readonly string[] = EEC_PILOT_PROVINCES;
const OPS_DEFAULT_PAGE_SIZE = 30;
const OPS_MAX_PAGE_SIZE = 50;

const MAX_PUBLIC_REFERENCE_ATTEMPTS = 5;

const safeReportSelect = {
  id: true,
  publicReference: true,
  latitude: true,
  longitude: true,
  province: true,
  district: true,
  observedAt: true,
  quantityRange: true,
  status: true,
  locationPrecision: true,
  photoLocationRelation: true,
  imageMetadata: true,
  imageProvenance: true,
  isSeedData: true,
  imagePath: true,
  createdAt: true,
  updatedAt: true
} as const;

export type SafeReport = {
  id: string;
  publicReference: string;
  latitude: number;
  longitude: number;
  province: string;
  district: string | null;
  observedAt: Date;
  quantityRange: string;
  status: ReportStatus;
  locationPrecision: string;
  photoLocationRelation: string;
  imageMetadata: unknown | null;
  imageProvenance: string;
  isSeedData: boolean;
  imagePath: string;
  createdAt: Date;
  updatedAt: Date;
};

function roundCoordinate(value: number): number {
  return Number(value.toFixed(3));
}

/**
 * Data intake is nationwide; the EEC pilot (Chachoengsao/Chonburi/Rayong) is a
 * separate, narrower field-operation scope. This flag is display-only — it
 * never hides or excludes a report, it only tells the officer whether the
 * report falls inside the pilot's current dispatch scope.
 */
function isEecPilot(province: string): boolean {
  return EEC_PROVINCES.includes(province);
}

export function safeReport(report: SafeReport, includeImage = false, publicCoordinates = true) {
  return {
    id: report.id,
    publicReference: report.publicReference,
    latitude: publicCoordinates ? roundCoordinate(report.latitude) : report.latitude,
    longitude: publicCoordinates ? roundCoordinate(report.longitude) : report.longitude,
    province: report.province,
    district: report.district,
    observedAt: report.observedAt,
    quantityRange: report.quantityRange,
    status: report.status,
    // Reporter-declared precision — never inferred from the coordinates.
    locationPrecision: report.locationPrecision,
    // Three-state photo-location relationship (SAME/DIFFERENT/UNKNOWN).
    // Historical records are UNKNOWN — they never declared this relationship.
    photoLocationRelation: report.photoLocationRelation,
    // EXIF metadata as supporting evidence only — never ground truth.
    imageMetadata: report.imageMetadata,
    // Image provenance — how the image entered the system.
    imageProvenance: report.imageProvenance,
    // System-validation provenance — the UI renders a restrained marker on
    // seed records so they are never mistaken for real citizen reports.
    isSeedData: report.isSeedData,
    // Nationwide intake vs. the current EEC field-operation pilot scope — see
    // isEecPilot(). Never used to suppress a report, only to label it.
    isEecPilot: isEecPilot(report.province),
    createdAt: report.createdAt,
    // imageUrl only when a real image exists — seed records carry none and an
    // imageUrl would point at a route that 404s, leaving broken-image icons.
    ...(includeImage && report.imagePath ? { imageUrl: `/api/reports/${report.id}/image` } : {})
  };
}

function publicReference(): string {
  const year = new Date().getUTCFullYear();
  return `FD-${year}-${randomBytes(4).toString('hex').toUpperCase()}`;
}

function isPublicReferenceConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002')
    return false;
  const target = error.meta?.target;
  return (
    target === 'publicReference' || (Array.isArray(target) && target.includes('publicReference'))
  );
}

export async function createReport(
  context: CurrentClerkUser,
  metadata: ValidatedReportMetadata,
  image: { data: Uint8Array; contentType: string }
) {
  const stored = await storeReportImage(image);
  try {
    const profile = await getOrCreateCurrentProfile(context);
    for (let attempt = 0; attempt < MAX_PUBLIC_REFERENCE_ATTEMPTS; attempt += 1) {
      try {
        return await prisma.sightingReport.create({
          data: {
            publicReference: publicReference(),
            reporter: { connect: { id: profile.id } },
            latitude: metadata.latitude,
            longitude: metadata.longitude,
            province: metadata.province,
            district: metadata.district,
            subdistrict: metadata.subdistrict,
            locationDescription: metadata.locationDescription,
            // The coordinates above are the observation point the reporter
            // chose on the map — never overwritten by device or photo location.
            locationPrecision: metadata.locationPrecision,
            photoLocationRelation: metadata.photoLocationRelation,
            // Store extracted EXIF metadata as supporting evidence only
            imageMetadata: stored.metadata as unknown as Prisma.InputJsonValue,
            // Store detected provenance
            imageProvenance: stored.provenance,
            observedAt: metadata.observedAt,
            quantityRange: metadata.quantityRange,
            note: metadata.note,
            imagePath: stored.relativePath,
            status: ReportStatus.PENDING
          },
          select: { id: true, publicReference: true, status: true }
        });
      } catch (error) {
        if (!isPublicReferenceConflict(error)) throw error;
        if (attempt === MAX_PUBLIC_REFERENCE_ATTEMPTS - 1) {
          throw new AppError(
            'PUBLIC_REFERENCE_UNAVAILABLE',
            503,
            'A public reference could not be allocated'
          );
        }
      }
    }

    throw new AppError(
      'PUBLIC_REFERENCE_UNAVAILABLE',
      503,
      'A public reference could not be allocated'
    );
  } catch (error) {
    await deleteReportImage(stored.relativePath).catch(() => undefined);
    throw error;
  }
}

/**
 * Public map layer. Post-review states (including acted-on ones) stay visible:
 * acting on a report must never make it disappear from the map.
 */
export async function listPublicReports() {
  const reports = await prisma.sightingReport.findMany({
    where: { status: { in: PUBLIC_REPORT_STATUSES } },
    orderBy: { observedAt: 'desc' },
    take: 1000,
    select: safeReportSelect
  });
  return reports.map((report) => ({
    ...safeReport(report),
    // Legacy boolean for backward compatibility (DIFFERENT -> true, SAME/UNKNOWN -> false)
    photoTakenElsewhere: report.photoLocationRelation === 'DIFFERENT'
  }));
}

export async function listCurrentUserReports(context: CurrentClerkUser) {
  const profile = await getOrCreateCurrentProfile(context);
  const [reports, total, counts] = await Promise.all([
    prisma.sightingReport.findMany({
      where: { reporterId: profile.id },
      orderBy: { createdAt: 'desc' },
      take: 1000,
      select: {
        ...safeReportSelect,
        photoTakenElsewhere: true, // legacy field for backward compat
        fieldActions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            outcome: true,
            notes: true,
            createdAt: true,
            officer: { select: { displayName: true } }
          }
        }
      }
    }),
    prisma.sightingReport.count({ where: { reporterId: profile.id } }),
    prisma.sightingReport.groupBy({
      by: ['status'],
      where: { reporterId: profile.id },
      _count: { _all: true }
    })
  ]);

  const countByStatus = Object.fromEntries(counts.map((item) => [item.status, item._count._all]));
  return {
    reports: reports.map((report) => ({
      ...safeReport(report, true, false),
      // Map three-state to legacy boolean for backward compatibility
      photoTakenElsewhere: report.photoLocationRelation === 'DIFFERENT',
      latestFieldAction: report.fieldActions[0] ?? null
    })),
    counts: {
      total,
      PENDING: countByStatus.PENDING ?? 0,
      VERIFIED: countByStatus.VERIFIED ?? 0,
      REJECTED: countByStatus.REJECTED ?? 0,
      FIELD_CHECKED: countByStatus.FIELD_CHECKED ?? 0,
      FIELD_CONFIRMED: countByStatus.FIELD_CONFIRMED ?? 0,
      ACTION_TAKEN: countByStatus.ACTION_TAKEN ?? 0,
      MONITORING: countByStatus.MONITORING ?? 0,
      REASSESSMENT: countByStatus.REASSESSMENT ?? 0
    }
  };
}

export async function getReportForViewer(id: string, clerkUserId: string | null) {
  const report = await prisma.sightingReport.findUnique({
    where: { id },
    select: {
      ...safeReportSelect,
      photoTakenElsewhere: true, // legacy field for backward compat
      imagePath: true,
      reporter: { select: { clerkUserId: true } }
    }
  });
  if (!report) return null;

  const isPublic = isPubliclyVisibleStatus(report.status);
  const isOwner = clerkUserId !== null && report.reporter.clerkUserId === clerkUserId;
  if (!isPublic && !isOwner) return null;
  return {
    ...safeReport(report, true, isPublic),
    photoTakenElsewhere: report.photoLocationRelation === 'DIFFERENT'
  };
}

export async function getReportImageAccess(id: string, clerkUserId: string | null) {
  const report = await prisma.sightingReport.findUnique({
    where: { id },
    select: { status: true, imagePath: true, reporter: { select: { clerkUserId: true } } }
  });
  if (!report) return null;
  if (!isPubliclyVisibleStatus(report.status) && report.reporter.clerkUserId !== clerkUserId)
    return null;
  return report;
}

// --- Field operations (officer-only) -----------------------------------------

export type FieldActionSummary = {
  id: string;
  outcome: FieldOutcome;
  notes: string | null;
  createdAt: Date;
  officerName: string;
};

const fieldActionSummarySelect = {
  id: true,
  outcome: true,
  notes: true,
  createdAt: true,
  officer: { select: { displayName: true } }
} as const;

function toFieldActionSummary(action: {
  id: string;
  outcome: FieldOutcome;
  notes: string | null;
  createdAt: Date;
  officer: { displayName: string };
}): FieldActionSummary {
  return {
    id: action.id,
    outcome: action.outcome,
    notes: action.notes,
    createdAt: action.createdAt,
    officerName: action.officer.displayName
  };
}

export type DecisionSummary = {
  id: string;
  decision: OperationalDecisionType;
  reason: string | null;
  previousDecision: OperationalDecisionType | null;
  createdAt: Date;
  officerName: string;
};

const decisionSummarySelect = {
  id: true,
  decision: true,
  reason: true,
  previousDecision: true,
  createdAt: true,
  officer: { select: { displayName: true } }
} as const;

function toDecisionSummary(row: {
  id: string;
  decision: OperationalDecisionType;
  reason: string | null;
  previousDecision: OperationalDecisionType | null;
  createdAt: Date;
  officer: { displayName: string };
}): DecisionSummary {
  return {
    id: row.id,
    decision: row.decision,
    reason: row.reason,
    previousDecision: row.previousDecision,
    createdAt: row.createdAt,
    officerName: row.officer.displayName
  };
}

export type OpsListOptions = {
  cursor?: string;
  limit?: number;
  status?: ReportStatus;
  /** 'EEC' restricts to the current field-operation pilot provinces; 'ALL' is nationwide intake. */
  scope?: 'EEC' | 'ALL';
};

/**
 * Officer recommendation queue: paginated, newest first, with the latest
 * field action + operational decision attached so an officer can see what
 * has and hasn't been done without opening every report. Status counts cover
 * every status within the current scope (ignoring the current status filter,
 * but respecting the EEC/ALL scope filter) so filter chips stay accurate;
 * evidence detail (full history) loads separately on demand via
 * getOperationalReportHistory.
 */
export async function listOperationalReports(
  context: CurrentClerkUser,
  options: OpsListOptions = {}
) {
  requireOfficer(context.userId);
  const limit = Math.min(Math.max(options.limit ?? OPS_DEFAULT_PAGE_SIZE, 1), OPS_MAX_PAGE_SIZE);
  const scopeWhere: Prisma.SightingReportWhereInput =
    options.scope === 'EEC' ? { province: { in: [...EEC_PROVINCES] } } : {};
  const where: Prisma.SightingReportWhereInput = {
    ...scopeWhere,
    ...(options.status ? { status: options.status } : {})
  };

  const [rows, counts] = await Promise.all([
    prisma.sightingReport.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
      select: {
        ...safeReportSelect,
        photoTakenElsewhere: true, // legacy field for backward compat
        note: true,
        operationalDecision: true,
        reporter: { select: { displayName: true } },
        fieldActions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: fieldActionSummarySelect
        }
      }
    }),
    prisma.sightingReport.groupBy({ by: ['status'], where: scopeWhere, _count: { _all: true } })
  ]);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const countByStatus = Object.fromEntries(counts.map((item) => [item.status, item._count._all]));

  return {
    reports: page.map((report) => ({
      ...safeReport(report, true, false),
      photoTakenElsewhere: report.photoLocationRelation === 'DIFFERENT',
      note: report.note,
      operationalDecision: report.operationalDecision,
      reporterName: report.reporter.displayName,
      latestFieldAction: report.fieldActions[0]
        ? toFieldActionSummary(report.fieldActions[0])
        : null
    })),
    nextCursor: hasMore ? page[page.length - 1].id : null,
    counts: {
      total: counts.reduce((sum, item) => sum + item._count._all, 0),
      PENDING: countByStatus.PENDING ?? 0,
      VERIFIED: countByStatus.VERIFIED ?? 0,
      REJECTED: countByStatus.REJECTED ?? 0,
      FIELD_CHECKED: countByStatus.FIELD_CHECKED ?? 0,
      FIELD_CONFIRMED: countByStatus.FIELD_CONFIRMED ?? 0,
      ACTION_TAKEN: countByStatus.ACTION_TAKEN ?? 0,
      MONITORING: countByStatus.MONITORING ?? 0,
      REASSESSMENT: countByStatus.REASSESSMENT ?? 0
    }
  };
}

export async function getOperationalReportHistory(id: string, context: CurrentClerkUser) {
  requireOfficer(context.userId);
  const report = await prisma.sightingReport.findUnique({
    where: { id },
    select: {
      ...safeReportSelect,
      operationalDecision: true,
      reporter: { select: { displayName: true } },
      fieldActions: { orderBy: { createdAt: 'asc' }, select: fieldActionSummarySelect },
      decisions: { orderBy: { createdAt: 'asc' }, select: decisionSummarySelect }
    }
  });
  if (!report) throw new NotFoundError();
  return {
    ...safeReport(report, true, false),
    reporterName: report.reporter.displayName,
    fieldActions: report.fieldActions.map(toFieldActionSummary),
    decisions: report.decisions.map(toDecisionSummary)
  };
}

/**
 * Record one field visit result. The report's status is derived from the
 * outcome (see field-outcomes.ts) — the action row is the immutable history.
 * Blocked once a report has been REJECTED (species misidentified): that is a
 * closed determination, not a status a new field visit should silently
 * overwrite — reopenForReassessment exists for exactly this case.
 */
export async function recordFieldAction(
  context: CurrentClerkUser,
  reportId: string,
  input: { outcome: FieldOutcome; notes: string | null }
) {
  requireOfficer(context.userId);
  const officerProfile = await getOrCreateCurrentProfile(context);
  const nextStatus = statusForOutcome(input.outcome);

  const [report] = await prisma.$transaction([
    prisma.sightingReport.findUniqueOrThrow({
      where: { id: reportId },
      select: { id: true, status: true }
    })
  ]);

  if (report.status === ReportStatus.REJECTED) {
    throw new BadRequestError('รายงานนี้ถูกปฏิเสธแล้ว (ระบุชนิดผิด) — ต้องเปิดประเมินซ้ำก่อนบันทึกผลการลงพื้นที่ใหม่');
  }

  const action = await prisma.reportFieldAction.create({
    data: {
      report: { connect: { id: report.id } },
      officer: { connect: { id: officerProfile.id } },
      outcome: input.outcome,
      notes: input.notes
    },
    select: fieldActionSummarySelect
  });

  await prisma.sightingReport.update({
    where: { id: report.id },
    data: {
      status: nextStatus,
      // A field-confirmed report counts as verified (only ever moves forward).
      verifiedAt: nextStatus === ReportStatus.VERIFIED ? new Date() : undefined
    }
  });

  return { fieldAction: toFieldActionSummary(action), status: nextStatus };
}

// A manual reopen only makes sense once some officer determination already
// exists — a still-PENDING report has nothing to "reassess" (it just needs a
// normal first field action), and an already-REASSESSMENT report is already
// awaiting review. Deliberately broader than the automatic pipeline's
// REASSESSMENT_ELIGIBLE_STATUSES: this is a human officer providing a reason,
// not a heuristic, so it may also reopen a REJECTED (misidentified) report.
const MANUAL_REOPEN_BLOCKED_STATUSES: ReportStatus[] = [
  ReportStatus.PENDING,
  ReportStatus.REASSESSMENT
];

/**
 * Re-open an acted-on report because new credible evidence arrived after the
 * previous operation — the old operation must not permanently suppress new
 * signals. Officers decide, never a threshold heuristic. This is a workflow
 * transition, NOT a field visit — it must never fabricate a ReportFieldAction
 * row (see docs/intelligence.md §17 for the automatic counterpart's identical
 * no-fabrication rule).
 */
export async function reopenForReassessment(
  context: CurrentClerkUser,
  reportId: string,
  notes: string | null
) {
  requireOfficer(context.userId);
  const officerProfile = await getOrCreateCurrentProfile(context);

  const report = await prisma.sightingReport.findUniqueOrThrow({
    where: { id: reportId },
    select: { id: true, status: true }
  });

  if (MANUAL_REOPEN_BLOCKED_STATUSES.includes(report.status)) {
    throw new BadRequestError('รายงานนี้ยังไม่เคยมีการดำเนินการ หรืออยู่ระหว่างรอประเมินซ้ำอยู่แล้ว');
  }

  await prisma.sightingReport.update({
    where: { id: report.id },
    data: {
      status: ReportStatus.REASSESSMENT,
      reassessmentTrigger: {
        source: 'MANUAL',
        officerProfileId: officerProfile.id,
        matchedAt: new Date().toISOString(),
        reason: notes ?? 'พบสัญญาณใหม่หลังการดำเนินการครั้งล่าสุด — ต้องประเมินซ้ำ'
      }
    }
  });

  return { status: ReportStatus.REASSESSMENT };
}

/**
 * Record a PRE-FIELD operational decision (DISPATCH/MONITOR/DEFER). Distinct
 * from recordFieldAction: this never touches ReportStatus or fabricates a
 * ReportFieldAction — it only appends to the ReportDecision audit trail and
 * updates the denormalized "current decision" cache on the report.
 */
export async function recordOperationalDecision(
  context: CurrentClerkUser,
  reportId: string,
  input: { decision: OperationalDecisionType; reason: string | null }
) {
  requireOfficer(context.userId);
  const officerProfile = await getOrCreateCurrentProfile(context);

  const report = await prisma.sightingReport.findUniqueOrThrow({
    where: { id: reportId },
    select: { id: true, operationalDecision: true }
  });

  const [decisionRow] = await prisma.$transaction([
    prisma.reportDecision.create({
      data: {
        report: { connect: { id: report.id } },
        officer: { connect: { id: officerProfile.id } },
        decision: input.decision,
        reason: input.reason,
        previousDecision: report.operationalDecision
      },
      select: decisionSummarySelect
    }),
    prisma.sightingReport.update({
      where: { id: report.id },
      data: { operationalDecision: input.decision }
    })
  ]);

  return { decision: toDecisionSummary(decisionRow) };
}

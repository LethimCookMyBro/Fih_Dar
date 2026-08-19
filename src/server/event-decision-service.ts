import 'server-only';

import { prisma } from '@/lib/prisma';
import { OperationalDecisionType } from '@prisma/client';

import type { CurrentClerkUser } from './auth';
import { requireOfficer } from './authorization';
import { NotFoundError } from './errors';
import { getOrCreateCurrentProfile } from './profile-service';
import type { DecisionSummary } from '@/features/reports/api/types';

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
    createdAt: row.createdAt.toISOString(),
    officerName: row.officer.displayName
  };
}

/**
 * Record a PRE-FIELD operational decision (DISPATCH/MONITOR/DEFER) on an
 * AI-derived EventCandidate — the exact same semantic layer as
 * recordOperationalDecision() in report-service.ts, applied to intelligence
 * events instead of citizen reports. Never fabricates a SightingReport link:
 * this only appends to the EventDecision audit trail and updates the
 * denormalized "current decision" cache on the event itself. The intelligence
 * pipeline (scripts/intel/process.mjs) never calls this — only an authorized
 * officer HTTP mutation can.
 */
export async function recordEventDecision(
  context: CurrentClerkUser,
  eventSlug: string,
  input: { decision: OperationalDecisionType; reason: string | null }
) {
  requireOfficer(context.userId);
  const officerProfile = await getOrCreateCurrentProfile(context);

  const event = await prisma.eventCandidate.findUnique({
    where: { slug: eventSlug },
    select: { id: true, operationalDecision: true }
  });
  if (!event) throw new NotFoundError();

  const [decisionRow] = await prisma.$transaction([
    prisma.eventDecision.create({
      data: {
        eventCandidate: { connect: { id: event.id } },
        officer: { connect: { id: officerProfile.id } },
        decision: input.decision,
        reason: input.reason,
        previousDecision: event.operationalDecision
      },
      select: decisionSummarySelect
    }),
    prisma.eventCandidate.update({
      where: { id: event.id },
      data: { operationalDecision: input.decision }
    })
  ]);

  return { decision: toDecisionSummary(decisionRow) };
}

/**
 * Append-only decision history for one EventCandidate, newest first — same
 * shape as the citizen-report decision timeline so the /ops UI can render
 * both with one component.
 */
export async function getEventDecisionHistory(
  context: CurrentClerkUser,
  eventSlug: string
): Promise<{ decisions: DecisionSummary[] }> {
  requireOfficer(context.userId);

  const event = await prisma.eventCandidate.findUnique({
    where: { slug: eventSlug },
    select: {
      decisions: { orderBy: { createdAt: 'desc' }, select: decisionSummarySelect }
    }
  });
  if (!event) throw new NotFoundError();

  return { decisions: event.decisions.map(toDecisionSummary) };
}

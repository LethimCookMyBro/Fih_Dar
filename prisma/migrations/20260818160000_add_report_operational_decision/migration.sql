-- Pre-field operational decision layer (DISPATCH/MONITOR/DEFER), kept
-- deliberately separate from FieldOutcome (which records a POST-visit
-- result). ReportDecision is an append-only audit trail; SightingReport's
-- operationalDecision column is only a denormalized "current value" cache.

CREATE TYPE "OperationalDecisionType" AS ENUM ('DISPATCH', 'MONITOR', 'DEFER');

ALTER TABLE "SightingReport" ADD COLUMN "operationalDecision" "OperationalDecisionType";

CREATE TABLE "ReportDecision" (
    "id" UUID NOT NULL,
    "reportId" UUID NOT NULL,
    "officerProfileId" UUID NOT NULL,
    "decision" "OperationalDecisionType" NOT NULL,
    "reason" TEXT,
    "previousDecision" "OperationalDecisionType",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportDecision_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReportDecision_reportId_idx" ON "ReportDecision"("reportId");
CREATE INDEX "ReportDecision_officerProfileId_idx" ON "ReportDecision"("officerProfileId");

ALTER TABLE "ReportDecision" ADD CONSTRAINT "ReportDecision_reportId_fkey"
    FOREIGN KEY ("reportId") REFERENCES "SightingReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReportDecision" ADD CONSTRAINT "ReportDecision_officerProfileId_fkey"
    FOREIGN KEY ("officerProfileId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

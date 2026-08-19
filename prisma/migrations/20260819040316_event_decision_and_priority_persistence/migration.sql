-- AlterTable
ALTER TABLE "EventCandidate" ADD COLUMN     "independentSourceCount" INTEGER,
ADD COLUMN     "operationalDecision" "OperationalDecisionType",
ADD COLUMN     "priorityBreakdown" JSONB,
ADD COLUMN     "priorityComputedAt" TIMESTAMP(3),
ADD COLUMN     "priorityConfidence" JSONB,
ADD COLUMN     "priorityScore" INTEGER,
ADD COLUMN     "priorityVersion" TEXT;

-- AlterTable
ALTER TABLE "SightingReport" ALTER COLUMN "locationPrecision" SET DEFAULT 'UNKNOWN';

-- CreateTable
CREATE TABLE "EventDecision" (
    "id" UUID NOT NULL,
    "eventCandidateId" UUID NOT NULL,
    "officerProfileId" UUID NOT NULL,
    "decision" "OperationalDecisionType" NOT NULL,
    "reason" TEXT,
    "previousDecision" "OperationalDecisionType",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventDecision_eventCandidateId_idx" ON "EventDecision"("eventCandidateId");

-- CreateIndex
CREATE INDEX "EventDecision_officerProfileId_idx" ON "EventDecision"("officerProfileId");

-- CreateIndex
CREATE INDEX "EventCandidate_priorityScore_idx" ON "EventCandidate"("priorityScore");

-- AddForeignKey
ALTER TABLE "EventDecision" ADD CONSTRAINT "EventDecision_eventCandidateId_fkey" FOREIGN KEY ("eventCandidateId") REFERENCES "EventCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventDecision" ADD CONSTRAINT "EventDecision_officerProfileId_fkey" FOREIGN KEY ("officerProfileId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

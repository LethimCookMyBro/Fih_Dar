-- CreateEnum
CREATE TYPE "FieldOutcome" AS ENUM ('FOUND', 'NOT_FOUND', 'MISIDENTIFIED', 'CONTROLLED', 'FOLLOW_UP_REQUIRED', 'ACCESS_DENIED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ReportStatus" ADD VALUE 'FIELD_CHECKED';
ALTER TYPE "ReportStatus" ADD VALUE 'ACTION_TAKEN';
ALTER TYPE "ReportStatus" ADD VALUE 'MONITORING';
ALTER TYPE "ReportStatus" ADD VALUE 'REASSESSMENT';

-- AlterTable
ALTER TABLE "SightingReport" ADD COLUMN     "locationPrecision" "LocationPrecision" NOT NULL DEFAULT 'EXACT',
ADD COLUMN     "photoTakenElsewhere" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ReportFieldAction" (
    "id" UUID NOT NULL,
    "reportId" UUID NOT NULL,
    "officerProfileId" UUID NOT NULL,
    "outcome" "FieldOutcome" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportFieldAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReportFieldAction_reportId_idx" ON "ReportFieldAction"("reportId");

-- CreateIndex
CREATE INDEX "ReportFieldAction_officerProfileId_idx" ON "ReportFieldAction"("officerProfileId");

-- AddForeignKey
ALTER TABLE "ReportFieldAction" ADD CONSTRAINT "ReportFieldAction_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "SightingReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportFieldAction" ADD CONSTRAINT "ReportFieldAction_officerProfileId_fkey" FOREIGN KEY ("officerProfileId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

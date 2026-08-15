-- AlterTable
ALTER TABLE "SightingReport" ADD COLUMN "isSeedData" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SightingReport" ADD COLUMN "seedBatchId" TEXT;

-- CreateIndex
CREATE INDEX "SightingReport_isSeedData_seedBatchId_idx" ON "SightingReport"("isSeedData", "seedBatchId");

-- CreateTable
CREATE TABLE "ExternalObservation" (
    "id" UUID NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourceExternalId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "province" TEXT,
    "district" TEXT,
    "subdistrict" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "publishedAt" TIMESTAMP(3),
    "scrapedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "rawMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalObservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExternalObservation_sourceName_sourceExternalId_key" ON "ExternalObservation"("sourceName", "sourceExternalId");

-- CreateIndex
CREATE INDEX "ExternalObservation_sourceName_idx" ON "ExternalObservation"("sourceName");

-- CreateIndex
CREATE INDEX "ExternalObservation_status_idx" ON "ExternalObservation"("status");

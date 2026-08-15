-- Intelligence layer for ExternalObservation enrichment.
-- Additive only: raw source text and existing columns are untouched.

CREATE TYPE "ObservationProcessingStatus" AS ENUM ('RAW', 'PROCESSED', 'FAILED');
CREATE TYPE "LocationPrecision" AS ENUM ('EXACT', 'WATERBODY', 'SUBDISTRICT', 'DISTRICT', 'PROVINCE', 'UNKNOWN');
CREATE TYPE "RelevanceVerdict" AS ENUM ('RELEVANT', 'IRRELEVANT', 'UNCERTAIN');

ALTER TABLE "ExternalObservation" ADD COLUMN "processingStatus" "ObservationProcessingStatus" NOT NULL DEFAULT 'RAW';
ALTER TABLE "ExternalObservation" ADD COLUMN "processedAt" TIMESTAMP(3);
ALTER TABLE "ExternalObservation" ADD COLUMN "processingError" TEXT;
ALTER TABLE "ExternalObservation" ADD COLUMN "locationPrecision" "LocationPrecision" NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE "ExternalObservation" ADD COLUMN "normalizedProvince" TEXT;
ALTER TABLE "ExternalObservation" ADD COLUMN "normalizedDistrict" TEXT;
ALTER TABLE "ExternalObservation" ADD COLUMN "normalizedSubdistrict" TEXT;
ALTER TABLE "ExternalObservation" ADD COLUMN "normalizedWaterbody" TEXT;
ALTER TABLE "ExternalObservation" ADD COLUMN "relevanceVerdict" "RelevanceVerdict";
ALTER TABLE "ExternalObservation" ADD COLUMN "relevanceKind" TEXT;
ALTER TABLE "ExternalObservation" ADD COLUMN "evidence" JSONB;
ALTER TABLE "ExternalObservation" ADD COLUMN "duplicateOfId" UUID;
ALTER TABLE "ExternalObservation" ADD COLUMN "derivedNearestWaterway" TEXT;
ALTER TABLE "ExternalObservation" ADD COLUMN "derivedDistanceMeters" DOUBLE PRECISION;
ALTER TABLE "ExternalObservation" ADD COLUMN "derivedWaterwaySource" TEXT;

ALTER TABLE "ExternalObservation"
  ADD CONSTRAINT "ExternalObservation_duplicateOfId_fkey"
  FOREIGN KEY ("duplicateOfId") REFERENCES "ExternalObservation"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ExternalObservation_processingStatus_idx" ON "ExternalObservation"("processingStatus");
CREATE INDEX "ExternalObservation_locationPrecision_idx" ON "ExternalObservation"("locationPrecision");
CREATE INDEX "ExternalObservation_relevanceVerdict_idx" ON "ExternalObservation"("relevanceVerdict");
CREATE INDEX "ExternalObservation_duplicateOfId_idx" ON "ExternalObservation"("duplicateOfId");
CREATE INDEX "ExternalObservation_normalizedProvince_idx" ON "ExternalObservation"("normalizedProvince");

CREATE TABLE "EventCandidate" (
  "id" UUID NOT NULL,
  "slug" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'EXPERIMENTAL',
  "kind" TEXT,
  "province" TEXT,
  "eventDate" TIMESTAMP(3),
  "locationPrecision" "LocationPrecision",
  "evidence" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EventCandidate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EventCandidateObservation" (
  "candidateId" UUID NOT NULL,
  "observationId" UUID NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'supporting',
  "addedBy" TEXT NOT NULL DEFAULT 'intel-worker',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventCandidateObservation_pkey" PRIMARY KEY ("candidateId", "observationId")
);

ALTER TABLE "EventCandidateObservation"
  ADD CONSTRAINT "EventCandidateObservation_candidateId_fkey"
  FOREIGN KEY ("candidateId") REFERENCES "EventCandidate"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventCandidateObservation"
  ADD CONSTRAINT "EventCandidateObservation_observationId_fkey"
  FOREIGN KEY ("observationId") REFERENCES "ExternalObservation"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "EventCandidate_slug_key" ON "EventCandidate"("slug");
CREATE INDEX "EventCandidateObservation_observationId_idx" ON "EventCandidateObservation"("observationId");

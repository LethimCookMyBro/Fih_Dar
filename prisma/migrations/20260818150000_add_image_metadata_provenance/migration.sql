-- Add image metadata (EXIF) and provenance tracking to SightingReport

-- Enum for image provenance
CREATE TYPE "ImageProvenance" AS ENUM ('CAPTURED_IN_FIHDAR', 'ORIGINAL_UPLOAD', 'DERIVED_OR_SCREENSHOT', 'FORWARDED_OR_EXTERNAL', 'UNKNOWN');

-- Add columns to SightingReport
ALTER TABLE "SightingReport" ADD COLUMN "imageMetadata" JSONB;
ALTER TABLE "SightingReport" ADD COLUMN "imageProvenance" "ImageProvenance" NOT NULL DEFAULT 'UNKNOWN';

-- Historical records get UNKNOWN provenance (truthful: we don't know)
-- New uploads via the FihDar app get CAPTURED_IN_FIHDAR
-- Other uploads get ORIGINAL_UPLOAD or UNKNOWN based on detection
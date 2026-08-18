-- Corrective migration: historical reports must not default to EXACT precision
-- The previous migration (20260818085250) added locationPrecision with DEFAULT 'EXACT'
-- which incorrectly assigned EXACT to all pre-existing reports that never declared precision.
-- This migration sets those historical records to UNKNOWN (truthful: precision was never declared).

-- 1. Create a three-state enum for photo-location relationship
CREATE TYPE "PhotoLocationRelation" AS ENUM ('SAME', 'DIFFERENT', 'UNKNOWN');

-- 2. Add new column for three-state photo-location relationship
ALTER TABLE "SightingReport" ADD COLUMN "photoLocationRelation" "PhotoLocationRelation" NOT NULL DEFAULT 'UNKNOWN';

-- 3. Migrate existing boolean photoTakenElsewhere to three-state:
--    - false (photo taken at observation point) -> SAME
--    - true (photo taken elsewhere) -> DIFFERENT
--    BUT: historical records never captured this fact, so they become UNKNOWN
--    We use createdAt to distinguish: reports created BEFORE the field-ops migration
--    (2026-08-18 08:52:50 UTC approx) never had this choice.
UPDATE "SightingReport"
SET "photoLocationRelation" = 'UNKNOWN'
WHERE "createdAt" < '2026-08-18 08:52:50.000+00';

-- For reports created after the migration, map the boolean faithfully:
-- explicit cast required — a bare CASE over string literals resolves to
-- `text`, and Postgres does not implicitly coerce `text` to an enum column
-- (only a single untyped literal, e.g. SET col = 'UNKNOWN' above, gets that).
UPDATE "SightingReport"
SET "photoLocationRelation" = (CASE
  WHEN "photoTakenElsewhere" = true THEN 'DIFFERENT'
  ELSE 'SAME'
END)::"PhotoLocationRelation"
WHERE "createdAt" >= '2026-08-18 08:52:50.000+00';

-- 4. Correct historical locationPrecision: all records created before the field-ops
--    migration never declared precision — they must be UNKNOWN, not EXACT.
UPDATE "SightingReport"
SET "locationPrecision" = 'UNKNOWN'
WHERE "createdAt" < '2026-08-18 08:52:50.000+00';

-- 5. For reports created after the migration, keep their explicitly chosen precision
--    (the form requires explicit selection, so these are truthful).
--    No action needed — they already have the correct value.

-- 6. Drop the old boolean column (after verifying migration works)
--    We keep it for now as a safety net; can be dropped in a future migration.
-- ALTER TABLE "SightingReport" DROP COLUMN "photoTakenElsewhere";
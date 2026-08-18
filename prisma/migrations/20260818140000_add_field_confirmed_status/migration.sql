-- Add FIELD_CONFIRMED status to ReportStatus enum
-- This separates field confirmation from desk verification (VERIFIED).
-- FOUND field outcome now maps to FIELD_CONFIRMED, not VERIFIED.

ALTER TYPE "ReportStatus" ADD VALUE 'FIELD_CONFIRMED';

-- No data migration needed: existing reports with VERIFIED status from FOUND outcomes
-- are historical and cannot be distinguished from desk-verified ones.
-- Going forward, new FOUND outcomes will correctly create FIELD_CONFIRMED status.
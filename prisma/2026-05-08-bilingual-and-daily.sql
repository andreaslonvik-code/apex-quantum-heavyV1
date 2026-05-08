-- APEX QUANTUM + — bilingual content + daily report cadence
-- Run this ONCE in: Supabase Dashboard → SQL Editor → New query
-- Idempotent: safe to run multiple times.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Bilingual columns on plus_scans (scan summary)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE plus_scans
  ADD COLUMN IF NOT EXISTS scan_summary_en TEXT;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Bilingual columns on plus_signals
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE plus_signals
  ADD COLUMN IF NOT EXISTS reasoning_en       TEXT,
  ADD COLUMN IF NOT EXISTS catalysts_en       JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS risks_en           JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS peer_comparison_en TEXT,
  ADD COLUMN IF NOT EXISTS insider_signal_en  TEXT;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Daily reports — rename week_starts_on → report_date, add bilingual cols
-- ─────────────────────────────────────────────────────────────────────────────

-- Rename the column. Wrapped in DO block so a re-run is a no-op.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plus_reports' AND column_name = 'week_starts_on'
  ) THEN
    ALTER TABLE plus_reports RENAME COLUMN week_starts_on TO report_date;
  END IF;
END $$;

ALTER TABLE plus_reports
  ADD COLUMN IF NOT EXISTS title_en TEXT,
  ADD COLUMN IF NOT EXISTS body_en  TEXT;

-- After this migration:
--  - Existing rows keep their Norwegian content; *_en columns are NULL.
--  - New scans/reports populate both NO and EN. Display falls back to
--    NO when EN is NULL (graceful degradation for historical rows).

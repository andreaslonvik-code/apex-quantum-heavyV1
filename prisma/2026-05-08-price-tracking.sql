-- APEX QUANTUM + — capture price at signal-publication time so we can
-- compute change-since-signal and historical hit-rate.
-- Run in: Supabase Dashboard → SQL Editor → New query
-- Idempotent: safe to run multiple times.

ALTER TABLE plus_signals
  ADD COLUMN IF NOT EXISTS price_at_signal NUMERIC(14, 4),
  ADD COLUMN IF NOT EXISTS price_currency  TEXT;

-- Existing rows: price_at_signal stays NULL. Track-record only counts
-- signals where price_at_signal IS NOT NULL — old rows are excluded
-- gracefully without errors.
CREATE INDEX IF NOT EXISTS plus_signals_priced_idx
  ON plus_signals (created_at DESC)
  WHERE price_at_signal IS NOT NULL;

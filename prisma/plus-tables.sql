-- APEX QUANTUM + — Supabase tables for Plus product.
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- Idempotent: safe to run multiple times.

-- ─────────────────────────────────────────────────────────────────────────────
-- plus_scans — one row per signal-generation run (daily cron)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plus_scans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status          TEXT NOT NULL CHECK (status IN ('running','success','failed')),
  scan_summary    TEXT,
  scan_summary_en TEXT,
  signal_count    INTEGER NOT NULL DEFAULT 0,
  duration_ms     INTEGER,
  error_message   TEXT,
  prompt_tokens   INTEGER,
  completion_tokens INTEGER,
  num_sources_used  INTEGER
);

CREATE INDEX IF NOT EXISTS plus_scans_generated_at_idx ON plus_scans (generated_at DESC);
CREATE INDEX IF NOT EXISTS plus_scans_status_idx ON plus_scans (status);

-- ─────────────────────────────────────────────────────────────────────────────
-- plus_signals — individual signals tied to a scan
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plus_signals (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id            UUID NOT NULL REFERENCES plus_scans(id) ON DELETE CASCADE,
  ticker             TEXT NOT NULL,
  region             TEXT NOT NULL CHECK (region IN ('NO','EU','US','TW','KR','JP','HK','IN')),
  action             TEXT NOT NULL CHECK (action IN ('BUY','SELL','HOLD','WATCH')),
  confidence         INTEGER NOT NULL CHECK (confidence BETWEEN 0 AND 100),
  time_horizon       TEXT NOT NULL CHECK (time_horizon IN ('short','medium','long')),
  reasoning          TEXT NOT NULL,
  reasoning_en       TEXT,
  catalysts          JSONB NOT NULL DEFAULT '[]'::jsonb,
  catalysts_en       JSONB DEFAULT '[]'::jsonb,
  risks              JSONB NOT NULL DEFAULT '[]'::jsonb,
  risks_en           JSONB DEFAULT '[]'::jsonb,
  peer_comparison    TEXT,
  peer_comparison_en TEXT,
  insider_signal     TEXT,
  insider_signal_en  TEXT,
  price_at_signal    NUMERIC(14, 4),
  price_currency     TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS plus_signals_scan_id_idx ON plus_signals (scan_id);
CREATE INDEX IF NOT EXISTS plus_signals_ticker_idx ON plus_signals (ticker);
CREATE INDEX IF NOT EXISTS plus_signals_action_idx ON plus_signals (action);
CREATE INDEX IF NOT EXISTS plus_signals_created_at_idx ON plus_signals (created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- plus_reports — daily morning market briefs (one row per calendar day).
-- The `report_date` column previously held a week-start date; semantics
-- changed to a daily cadence published before 08:00 norsk tid.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plus_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date     DATE NOT NULL,
  title           TEXT NOT NULL,
  title_en        TEXT,
  body            TEXT NOT NULL,
  body_en         TEXT,
  published_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  prompt_tokens   INTEGER,
  completion_tokens INTEGER,
  UNIQUE (report_date)
);

CREATE INDEX IF NOT EXISTS plus_reports_published_at_idx ON plus_reports (published_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- plus_journal_entries — per-user investment journal
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plus_journal_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id   TEXT NOT NULL,
  ticker          TEXT,
  action          TEXT CHECK (action IN ('BUY','SELL','HOLD','WATCH','NOTE')),
  thesis          TEXT,
  outcome         TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS plus_journal_entries_user_idx ON plus_journal_entries (clerk_user_id, created_at DESC);

DROP TRIGGER IF EXISTS plus_journal_entries_updated_at ON plus_journal_entries;
CREATE TRIGGER plus_journal_entries_updated_at
  BEFORE UPDATE ON plus_journal_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Server-side access only (cron + auth-gated routes).
ALTER TABLE plus_scans DISABLE ROW LEVEL SECURITY;
ALTER TABLE plus_signals DISABLE ROW LEVEL SECURITY;
ALTER TABLE plus_reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE plus_journal_entries DISABLE ROW LEVEL SECURITY;

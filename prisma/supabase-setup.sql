-- APEX QUANTUM — Supabase table setup (Alpaca multi-user)
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- Idempotent: safe to run multiple times.

-- Drop legacy tables from earlier engine versions (no longer used).
DROP TABLE IF EXISTS saxo_tokens CASCADE;
DROP TABLE IF EXISTS position_lots CASCADE;
DROP TABLE IF EXISTS signal_multipliers CASCADE;
DROP TABLE IF EXISTS news_intelligence CASCADE;
DROP TABLE IF EXISTS ai_portfolio_selections CASCADE;
DROP TABLE IF EXISTS earnings_calendar CASCADE;

-- Per-user Alpaca Trading credentials + capital allocation.
-- One row per Clerk user. Keys are stored AES-256-GCM encrypted.
-- Decryption happens only server-side using ENCRYPTION_KEY env var.
CREATE TABLE IF NOT EXISTS alpaca_accounts (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clerk_user_id         TEXT UNIQUE NOT NULL,
  -- Encrypted as "ivHex:tagHex:cipherHex" via lib/crypto.ts
  api_key_enc           TEXT NOT NULL,
  api_secret_enc        TEXT NOT NULL,
  -- 'paper' = Alpaca Paper Trading, 'live' = real-money Alpaca Live
  environment           TEXT NOT NULL DEFAULT 'paper' CHECK (environment IN ('paper', 'live')),
  account_id            TEXT,
  account_status        TEXT,
  -- Starting equity captured at first connect. Used as the baseline for P/L.
  start_balance         NUMERIC(18,2) DEFAULT 0,
  -- Capital allocation across asset buckets. Sum must equal 100 (validated in API).
  alloc_stocks_pct      NUMERIC(5,2) NOT NULL DEFAULT 33,
  alloc_crypto_pct      NUMERIC(5,2) NOT NULL DEFAULT 33,
  alloc_commodities_pct NUMERIC(5,2) NOT NULL DEFAULT 34,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Backfill columns on pre-existing tables.
ALTER TABLE alpaca_accounts
  ADD COLUMN IF NOT EXISTS alloc_stocks_pct      NUMERIC(5,2) NOT NULL DEFAULT 33,
  ADD COLUMN IF NOT EXISTS alloc_crypto_pct      NUMERIC(5,2) NOT NULL DEFAULT 33,
  ADD COLUMN IF NOT EXISTS alloc_commodities_pct NUMERIC(5,2) NOT NULL DEFAULT 34;

CREATE INDEX IF NOT EXISTS alpaca_accounts_clerk_user_id_idx ON alpaca_accounts (clerk_user_id);
CREATE INDEX IF NOT EXISTS alpaca_accounts_environment_idx ON alpaca_accounts (environment);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS alpaca_accounts_updated_at ON alpaca_accounts;
CREATE TRIGGER alpaca_accounts_updated_at
  BEFORE UPDATE ON alpaca_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Server-side access only. Cron uses SUPABASE_SERVICE_ROLE_KEY (bypasses RLS).
ALTER TABLE alpaca_accounts DISABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- Grok decisions audit log
--
-- One row per Grok call. Stored so the engine can:
--   1) Throttle Grok calls — only call when last decision is older than the
--      configured cadence (default 15 min).
--   2) Re-execute Grok's last decisions on between-call ticks if needed.
--   3) Display thesis + per-ticker reasoning on the dashboard.
--   4) Audit + post-mortem when a trade goes bad.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS grok_decisions (
  id              BIGSERIAL PRIMARY KEY,
  clerk_user_id   TEXT NOT NULL,
  blueprint_id    TEXT NOT NULL CHECK (blueprint_id IN ('stocks','crypto','commodities')),
  decided_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  thesis          TEXT,
  decisions       JSONB NOT NULL DEFAULT '[]'::jsonb,
  /** Per-decision execution outcome — { ticker, action, status, notional?, error? }. */
  trade_outcomes  JSONB NOT NULL DEFAULT '[]'::jsonb,
  prompt_tokens   INTEGER,
  output_tokens   INTEGER,
  raw_response    JSONB,
  failed          BOOLEAN NOT NULL DEFAULT false,
  error_message   TEXT
);

-- Backfill on existing tables.
ALTER TABLE grok_decisions
  ADD COLUMN IF NOT EXISTS trade_outcomes JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Catalysts (added 2026-06-01) — structured external events Grok cited as
-- drivers for the scan. Powers the public /innsyn timeline (event-first
-- view). Empty array is a valid "no notable catalyst" value, so old rows +
-- routine ticks render cleanly without a backfill.
ALTER TABLE grok_decisions
  ADD COLUMN IF NOT EXISTS catalysts JSONB NOT NULL DEFAULT '[]'::jsonb;

-- num_sources_used (added 2026-06-02, H10 fix) — used by /innsyn instead
-- of selecting + parsing the entire raw_response blob (~50-150KB per row).
-- Lets us stop persisting raw_response, which reduces DB growth ~10MB/day
-- per leader and shrinks /innsyn's read transfer from ~10MB to ~50KB.
ALTER TABLE grok_decisions
  ADD COLUMN IF NOT EXISTS num_sources_used INTEGER;

CREATE INDEX IF NOT EXISTS grok_decisions_user_blueprint_idx
  ON grok_decisions (clerk_user_id, blueprint_id, decided_at DESC);

ALTER TABLE grok_decisions DISABLE ROW LEVEL SECURITY;

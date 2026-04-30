-- APEX QUANTUM — Supabase table setup (Alpaca multi-user)
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- Idempotent: safe to run multiple times.

-- Drop the legacy Saxo table (no longer used).
-- Comment out this line if you need to keep historical Saxo data temporarily.
DROP TABLE IF EXISTS saxo_tokens CASCADE;

-- Per-user Alpaca Trading credentials.
-- One row per Clerk user. Keys are stored AES-256-GCM encrypted.
-- Decryption happens only server-side using ENCRYPTION_KEY env var.
CREATE TABLE IF NOT EXISTS alpaca_accounts (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clerk_user_id     TEXT UNIQUE NOT NULL,
  -- Encrypted as "ivHex:tagHex:cipherHex" via lib/crypto.ts
  api_key_enc       TEXT NOT NULL,
  api_secret_enc    TEXT NOT NULL,
  -- 'paper' = Alpaca Paper Trading, 'live' = real-money Alpaca Live
  environment       TEXT NOT NULL DEFAULT 'paper' CHECK (environment IN ('paper', 'live')),
  account_id        TEXT,
  account_status    TEXT,
  -- Starting equity captured at first connect. Used as the baseline for P/L.
  start_balance     NUMERIC(18,2) DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

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

-- Server-side access only. Cron + inngest use SUPABASE_SERVICE_ROLE_KEY (bypasses RLS).
ALTER TABLE alpaca_accounts DISABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- Self-learning layer
--
-- position_lots: FIFO accounting layer for trade attribution. Each successful
-- BUY creates a new open lot. Each SELL FIFO-closes the oldest open lots for
-- that user+ticker and writes back realised P&L per closed lot. This lets the
-- learning loop compute hit rate / average return per ENTRY signal type.
--
-- signal_multipliers: learned confidence per BUY signal type. The trading
-- engine reads this every scan and scales BUY sizing by `multiplier`. The
-- /api/cron/learn nightly cron updates the rows from realised performance
-- over the last 60 days, with bounded steps so multipliers can't whipsaw.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS position_lots (
  id                   BIGSERIAL PRIMARY KEY,
  clerk_user_id        TEXT NOT NULL,
  ticker               TEXT NOT NULL,
  qty_remaining        NUMERIC(18,6) NOT NULL,
  qty_initial          NUMERIC(18,6) NOT NULL,
  entry_price          NUMERIC(18,6) NOT NULL,
  entry_signal_type    TEXT NOT NULL,
  entry_signal_reason  TEXT,
  entry_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  exit_price           NUMERIC(18,6),
  exit_signal_type     TEXT,
  exit_at              TIMESTAMPTZ,
  realized_pnl         NUMERIC(18,2) DEFAULT 0,
  status               TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed'))
);

-- FIFO close lookup needs (user, ticker, status, entry_at) sorted ascending.
CREATE INDEX IF NOT EXISTS position_lots_open_idx
  ON position_lots (clerk_user_id, ticker, entry_at)
  WHERE status = 'open';

-- Learning aggregation reads closed lots by entry signal type and exit time.
CREATE INDEX IF NOT EXISTS position_lots_closed_signal_idx
  ON position_lots (entry_signal_type, exit_at)
  WHERE status = 'closed';

ALTER TABLE position_lots DISABLE ROW LEVEL SECURITY;


CREATE TABLE IF NOT EXISTS signal_multipliers (
  signal_type   TEXT PRIMARY KEY,
  multiplier    NUMERIC(4,2) NOT NULL DEFAULT 1.00 CHECK (multiplier >= 0.50 AND multiplier <= 1.50),
  hit_rate      NUMERIC(4,2),       -- 0..1
  avg_pnl_pct   NUMERIC(6,2),       -- e.g. 1.23 = +1.23 %
  sample_size   INTEGER NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed with neutral multipliers so the trading engine finds a row on first
-- deploy. Only learnable BUY signals — risk-management signals (EXIT,
-- STOPLOSS, OVERWEIGHT, REBALANCE) always run at full strength.
INSERT INTO signal_multipliers (signal_type, multiplier) VALUES
  ('DIP', 1.00),
  ('RSI_LOW', 1.00),
  ('UNDERWEIGHT', 1.00)
ON CONFLICT (signal_type) DO NOTHING;

ALTER TABLE signal_multipliers DISABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- News intelligence
--
-- Hourly Grok-4-Heavy scan of macro + per-ticker news + X/social sentiment.
-- The trading engine reads the latest row at the start of each scan and uses
-- it to bias BUY signal scoring (sector multipliers, ticker boosts/blocks)
-- and to scale global BUY size in risk-off / crash-warning regimes.
--
-- Persisted (not just in-memory) so we keep an audit trail of which news
-- influenced which trades. Old rows accumulate — clean up via TTL job later.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS news_intelligence (
  id              BIGSERIAL PRIMARY KEY,
  scanned_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  summary         TEXT,
  /** 'normal' | 'risk-on' | 'risk-off' | 'crash-warning' */
  risk_mode       TEXT NOT NULL DEFAULT 'normal',
  /** Map<sectorKey, number ∈ [-1, 1]> — multiplier on BUY scores per sector. */
  sector_bias     JSONB NOT NULL DEFAULT '{}'::jsonb,
  /** Array<{ ticker, direction, weight, source, reason }> — material events. */
  ticker_events   JSONB NOT NULL DEFAULT '[]'::jsonb,
  /** 0..1 — how confident Grok is in the read. <0.4 → ignored by trading. */
  confidence      NUMERIC(4,2) NOT NULL DEFAULT 0,
  /** Raw Grok response for audit. Keep so we can debug bad calls later. */
  raw_response    JSONB,
  /** True if the cron timed out / Grok returned malformed JSON / API error. */
  failed          BOOLEAN NOT NULL DEFAULT false,
  error_message   TEXT
);

-- Trading engine reads "the latest non-failed scan within last 4 hours".
CREATE INDEX IF NOT EXISTS news_intelligence_scanned_at_idx
  ON news_intelligence (scanned_at DESC)
  WHERE failed = false;

ALTER TABLE news_intelligence DISABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- AI portfolio selections
--
-- Hourly Grok-4-Heavy elite-portfolio decision. Replaces (with math fallback)
-- the pure 30-day Sharpe optimizer for the elite-8 selection. Each row is a
-- snapshot of one decision: picks + per-pick reasoning + overall thesis +
-- model identity. Audit + future learning grist (we can backtest "AI picks"
-- vs "Sharpe picks" once we have months of data).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_portfolio_selections (
  id            BIGSERIAL PRIMARY KEY,
  selected_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  /** Array<{ ticker, reasoning }> — Grok's elite picks for this window. */
  picks         JSONB NOT NULL DEFAULT '[]'::jsonb,
  /** Grok's overall thesis paragraph (≤ 800 chars). */
  thesis        TEXT,
  /** 'normal' | 'risk-on' | 'risk-off' | 'crash-warning' — Grok's read. */
  risk_read     TEXT NOT NULL DEFAULT 'normal',
  confidence    NUMERIC(4,2) NOT NULL DEFAULT 0,
  /** Source label: 'grok-4-heavy' on AI success, 'sharpe-fallback' on failure. */
  source        TEXT NOT NULL DEFAULT 'grok-4-heavy',
  raw_response  JSONB,
  failed        BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS ai_portfolio_selections_selected_at_idx
  ON ai_portfolio_selections (selected_at DESC);

ALTER TABLE ai_portfolio_selections DISABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- Earnings calendar
--
-- Per-ticker next earnings date pulled from Yahoo Finance, cached so we
-- don't hit Yahoo every single trading scan. Trading engine reads this to
-- block BUYs on tickers reporting in the next 24h (binary risk we can't
-- manage with stops since pre-market gaps bypass STOPLOSS).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS earnings_calendar (
  ticker             TEXT PRIMARY KEY,
  next_earnings_at   TIMESTAMPTZ,
  fetched_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source             TEXT NOT NULL DEFAULT 'yahoo'
);

CREATE INDEX IF NOT EXISTS earnings_calendar_next_idx
  ON earnings_calendar (next_earnings_at)
  WHERE next_earnings_at IS NOT NULL;

ALTER TABLE earnings_calendar DISABLE ROW LEVEL SECURITY;

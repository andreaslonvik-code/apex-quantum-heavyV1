-- APEX QUANTUM — Supabase table setup
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- Idempotent: safe to run multiple times.

-- Per-user Saxo Bank credentials + starting capital
CREATE TABLE IF NOT EXISTS saxo_tokens (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clerk_user_id   TEXT UNIQUE NOT NULL,
  access_token    TEXT NOT NULL,
  refresh_token   TEXT,
  account_key     TEXT NOT NULL,
  client_key      TEXT NOT NULL,
  account_id      TEXT NOT NULL,
  -- 'sim' for paper trading, 'live' for real money. Per-user, NOT a global env var.
  environment     TEXT DEFAULT 'sim' CHECK (environment IN ('sim', 'live')),
  -- Startkapital settes én gang ved første oppkobling og endres aldri.
  -- Avkastning = current_balance - start_balance
  start_balance   NUMERIC DEFAULT 1000000,
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS saxo_tokens_clerk_user_id_idx ON saxo_tokens (clerk_user_id);
-- Used by cron to find tokens needing refresh
CREATE INDEX IF NOT EXISTS saxo_tokens_expires_at_idx ON saxo_tokens (expires_at);
-- Used by cron to scope iteration to live or sim users
CREATE INDEX IF NOT EXISTS saxo_tokens_environment_idx ON saxo_tokens (environment);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS saxo_tokens_updated_at ON saxo_tokens;
CREATE TRIGGER saxo_tokens_updated_at
  BEFORE UPDATE ON saxo_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Tabellen skal kun nås fra server-side (Route Handlers, cron, inngest).
-- Cron + inngest bruker SUPABASE_SERVICE_ROLE_KEY (bypasser RLS).
-- Browser har aldri direkte tilgang.
ALTER TABLE saxo_tokens DISABLE ROW LEVEL SECURITY;

-- Backwards-compatible additions for older schemas
ALTER TABLE saxo_tokens ADD COLUMN IF NOT EXISTS start_balance NUMERIC DEFAULT 1000000;
ALTER TABLE saxo_tokens ADD COLUMN IF NOT EXISTS refresh_token TEXT;
ALTER TABLE saxo_tokens ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

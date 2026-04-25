-- APEX QUANTUM — Supabase table setup
-- Kjør denne i: Supabase Dashboard → SQL Editor → New query

-- Per-user Saxo Bank credentials + starting capital
CREATE TABLE IF NOT EXISTS saxo_tokens (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clerk_user_id   TEXT UNIQUE NOT NULL,
  access_token    TEXT NOT NULL,
  refresh_token   TEXT,
  account_key     TEXT NOT NULL,
  client_key      TEXT NOT NULL,
  account_id      TEXT NOT NULL,
  environment     TEXT DEFAULT 'sim',
  -- Startkapital settes én gang ved første oppkobling og endres aldri.
  -- Avkastning = current_balance - start_balance
  start_balance   NUMERIC DEFAULT 1000000,
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS saxo_tokens_clerk_user_id_idx ON saxo_tokens (clerk_user_id);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER saxo_tokens_updated_at
  BEFORE UPDATE ON saxo_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Tabellen nås kun fra server-side API-ruter, ikke fra browser
ALTER TABLE saxo_tokens DISABLE ROW LEVEL SECURITY;

-- Hvis tabellen allerede finnes: legg til start_balance-kolonnen
ALTER TABLE saxo_tokens ADD COLUMN IF NOT EXISTS start_balance NUMERIC DEFAULT 1000000;

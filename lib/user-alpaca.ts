/**
 * Per-user Alpaca credential helpers, backed by Supabase (table: alpaca_accounts).
 *
 * Keys are encrypted at rest with AES-256-GCM (lib/crypto.ts). Decryption
 * happens here in server context. Never expose decrypted keys to the client.
 */
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { encrypt, decrypt } from './crypto';
import type { AlpacaEnv } from './alpaca';

export interface UserAlpacaCreds {
  apiKey: string;        // decrypted
  apiSecret: string;     // decrypted
  environment: AlpacaEnv;
  accountId: string | null;
  accountStatus: string | null;
  startBalance: number;
}

interface AlpacaRow {
  clerk_user_id: string;
  api_key_enc: string;
  api_secret_enc: string;
  environment: string;
  account_id: string | null;
  account_status: string | null;
  start_balance: number | string | null;
}

function rowToCreds(row: AlpacaRow): UserAlpacaCreds {
  return {
    apiKey: decrypt(row.api_key_enc),
    apiSecret: decrypt(row.api_secret_enc),
    environment: (row.environment as AlpacaEnv) ?? 'paper',
    accountId: row.account_id,
    accountStatus: row.account_status,
    startBalance: Number(row.start_balance) || 0,
  };
}

/** Fetch decrypted Alpaca creds for a Clerk user. Returns null if none found. */
export async function getUserAlpacaCreds(clerkUserId: string): Promise<UserAlpacaCreds | null> {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { data, error } = await supabase
      .from('alpaca_accounts')
      .select('clerk_user_id, api_key_enc, api_secret_enc, environment, account_id, account_status, start_balance')
      .eq('clerk_user_id', clerkUserId)
      .single();

    if (error || !data) return null;
    return rowToCreds(data as AlpacaRow);
  } catch {
    return null;
  }
}

/**
 * Server-only: list every connected user with decrypted creds. Used by cron + inngest
 * to iterate trade execution per individual customer account.
 */
export async function getAllConnectedUsers(): Promise<
  Array<UserAlpacaCreds & { clerkUserId: string }>
> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('alpaca_accounts')
    .select('clerk_user_id, api_key_enc, api_secret_enc, environment, account_id, account_status, start_balance');

  if (error || !data) return [];

  return (data as AlpacaRow[]).map((row) => ({
    clerkUserId: row.clerk_user_id,
    ...rowToCreds(row),
  }));
}

/**
 * Upsert Alpaca credentials for a user.
 * `startBalance` is set ONCE on first insert and never overwritten on subsequent
 * connects (so P/L baselines stay stable when a user rotates their API keys).
 */
export async function saveUserAlpacaCreds(
  clerkUserId: string,
  input: {
    apiKey: string;
    apiSecret: string;
    environment: AlpacaEnv;
    accountId?: string | null;
    accountStatus?: string | null;
    currentEquity?: number;
  }
) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: existing } = await supabase
    .from('alpaca_accounts')
    .select('start_balance')
    .eq('clerk_user_id', clerkUserId)
    .single();

  const startBalance = existing?.start_balance
    ? Number(existing.start_balance)
    : input.currentEquity ?? 0;

  const { error } = await supabase.from('alpaca_accounts').upsert(
    {
      clerk_user_id: clerkUserId,
      api_key_enc: encrypt(input.apiKey),
      api_secret_enc: encrypt(input.apiSecret),
      environment: input.environment,
      account_id: input.accountId ?? null,
      account_status: input.accountStatus ?? null,
      start_balance: startBalance,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'clerk_user_id' }
  );

  if (error) {
    console.error('[user-alpaca] saveUserAlpacaCreds error:', error.message);
    throw error;
  }
}

/** Remove credentials for a user (called on disconnect). */
export async function deleteUserAlpacaCreds(clerkUserId: string) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    await supabase.from('alpaca_accounts').delete().eq('clerk_user_id', clerkUserId);
  } catch {
    // Row may not exist — silent
  }
}

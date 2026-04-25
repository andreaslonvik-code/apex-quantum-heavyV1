/**
 * Per-user Saxo credential helpers — backed by Supabase.
 * Table: saxo_tokens (one row per Clerk userId)
 *
 * startBalance: set ONCE at first connection, never overwritten.
 * All profit calculations use this as the baseline.
 */
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

export interface SaxoCreds {
  accessToken: string;
  refreshToken?: string | null;
  accountKey: string;
  clientKey: string;
  accountId: string;
  environment: 'sim' | 'live';
  startBalance: number; // saldo ved første oppkobling — aldri endret
  expiresAt?: Date | null;
}

interface SaxoRow {
  clerk_user_id: string;
  access_token: string;
  refresh_token: string | null;
  account_key: string;
  client_key: string;
  account_id: string;
  environment: string | null;
  start_balance: number | string | null;
  expires_at: string | null;
}

function rowToCreds(row: SaxoRow): SaxoCreds {
  return {
    accessToken: row.access_token,
    refreshToken: row.refresh_token,
    accountKey: row.account_key,
    clientKey: row.client_key,
    accountId: row.account_id,
    environment: (row.environment as 'sim' | 'live') ?? 'sim',
    startBalance: Number(row.start_balance) || 1000000,
    expiresAt: row.expires_at ? new Date(row.expires_at) : null,
  };
}

/** Fetch stored credentials for a Clerk user (request-scoped). Returns null if none found. */
export async function getUserSaxoCreds(clerkUserId: string): Promise<SaxoCreds | null> {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { data, error } = await supabase
      .from('saxo_tokens')
      .select('clerk_user_id, access_token, refresh_token, account_key, client_key, account_id, environment, start_balance, expires_at')
      .eq('clerk_user_id', clerkUserId)
      .single();

    if (error || !data) return null;
    return rowToCreds(data as SaxoRow);
  } catch {
    return null;
  }
}

/**
 * Server-only: list every connected user. Used by cron + inngest to
 * iterate trade execution per individual customer account.
 */
export async function getAllConnectedUsers(): Promise<Array<SaxoCreds & { clerkUserId: string }>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('saxo_tokens')
    .select('clerk_user_id, access_token, refresh_token, account_key, client_key, account_id, environment, start_balance, expires_at');

  if (error || !data) return [];

  return (data as SaxoRow[]).map((row) => ({
    clerkUserId: row.clerk_user_id,
    ...rowToCreds(row),
  }));
}

/**
 * Upsert Saxo credentials for a user.
 * startBalance is only written on INSERT (first connect) — never overwritten.
 */
export async function saveUserSaxoCreds(
  clerkUserId: string,
  creds: Omit<SaxoCreds, 'startBalance' | 'environment'> & {
    environment?: 'sim' | 'live';
    currentBalance?: number; // brukes kun ved første oppkobling
  }
) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: existing } = await supabase
    .from('saxo_tokens')
    .select('start_balance')
    .eq('clerk_user_id', clerkUserId)
    .single();

  const startBalance = existing?.start_balance
    ? Number(existing.start_balance)
    : (creds.currentBalance ?? 1000000);

  const { error } = await supabase.from('saxo_tokens').upsert(
    {
      clerk_user_id: clerkUserId,
      access_token: creds.accessToken,
      refresh_token: creds.refreshToken ?? null,
      account_key: creds.accountKey,
      client_key: creds.clientKey,
      account_id: creds.accountId,
      environment: creds.environment ?? 'sim',
      start_balance: startBalance,
      expires_at: creds.expiresAt?.toISOString() ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'clerk_user_id' }
  );

  if (error) {
    console.error('[user-saxo] saveUserSaxoCreds error:', error.message);
    throw error;
  }
}

/**
 * Update tokens after a refresh. Uses admin client (cron context).
 * Does NOT touch start_balance.
 */
export async function updateUserTokens(
  clerkUserId: string,
  tokens: { accessToken: string; refreshToken?: string | null; expiresAt: Date }
) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('saxo_tokens')
    .update({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken ?? null,
      expires_at: tokens.expiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('clerk_user_id', clerkUserId);

  if (error) {
    console.error('[user-saxo] updateUserTokens error:', error.message);
    throw error;
  }
}

/** Remove Saxo credentials for a user (called on disconnect). */
export async function deleteUserSaxoCreds(clerkUserId: string) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    await supabase.from('saxo_tokens').delete().eq('clerk_user_id', clerkUserId);
  } catch {
    // Row may not exist — silent
  }
}

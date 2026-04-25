/**
 * Per-user Saxo credential helpers — backed by Supabase.
 * Table: saxo_tokens (one row per Clerk userId)
 *
 * startBalance: set ONCE at first connection, never overwritten.
 * All profit calculations use this as the baseline.
 */
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';

export interface SaxoCreds {
  accessToken: string;
  accountKey: string;
  clientKey: string;
  accountId: string;
  environment: string;
  startBalance: number; // saldo ved første oppkobling — aldri endret
}

/** Fetch stored credentials for a Clerk user. Returns null if none found. */
export async function getUserSaxoCreds(clerkUserId: string): Promise<SaxoCreds | null> {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { data, error } = await supabase
      .from('saxo_tokens')
      .select('access_token, account_key, client_key, account_id, environment, start_balance')
      .eq('clerk_user_id', clerkUserId)
      .single();

    if (error || !data) return null;

    return {
      accessToken: data.access_token,
      accountKey: data.account_key,
      clientKey: data.client_key,
      accountId: data.account_id,
      environment: data.environment ?? 'sim',
      startBalance: Number(data.start_balance) || 1000000,
    };
  } catch {
    return null;
  }
}

/**
 * Upsert Saxo credentials for a user.
 * startBalance is only written on INSERT (first connect) — never overwritten.
 */
export async function saveUserSaxoCreds(
  clerkUserId: string,
  creds: Omit<SaxoCreds, 'startBalance'> & {
    refreshToken?: string;
    expiresAt?: Date;
    currentBalance?: number; // brukes kun ved første oppkobling
  }
) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // Sjekk om brukeren allerede har en startBalanse lagret
  const { data: existing } = await supabase
    .from('saxo_tokens')
    .select('start_balance')
    .eq('clerk_user_id', clerkUserId)
    .single();

  // Behold eksisterende startBalance — eller sett den fra nåværende saldo ved første gang
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

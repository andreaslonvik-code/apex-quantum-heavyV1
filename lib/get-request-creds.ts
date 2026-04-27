/**
 * Resolve Alpaca credentials for the current request, scoped to the Clerk user.
 * All trading API routes call this instead of reading creds directly.
 *
 * Alpaca uses static API keys (no OAuth refresh dance), so the only source
 * of truth is the database record per Clerk user.
 */
import { auth } from '@clerk/nextjs/server';
import { getUserAlpacaCreds } from './user-alpaca';
import type { AlpacaEnv } from './alpaca';

export interface RequestCreds {
  apiKey: string;
  apiSecret: string;
  environment: AlpacaEnv;
  accountId: string | null;
  startBalance: number;
}

/**
 * Returns the authenticated user's Alpaca creds, or null if not connected.
 * Caller is responsible for returning 401 to the client when this is null.
 */
export async function getRequestCreds(): Promise<RequestCreds | null> {
  try {
    const { userId } = await auth();
    if (!userId) return null;

    const creds = await getUserAlpacaCreds(userId);
    if (!creds) return null;

    return {
      apiKey: creds.apiKey,
      apiSecret: creds.apiSecret,
      environment: creds.environment,
      accountId: creds.accountId,
      startBalance: creds.startBalance,
    };
  } catch {
    return null;
  }
}

/**
 * Resolve Saxo credentials for the current request.
 * Priority: Clerk DB record → HttpOnly cookies (same-device fallback).
 * All trading API routes call this instead of reading cookies directly.
 */
import { auth } from '@clerk/nextjs/server';
import { cookies } from 'next/headers';
import { getUserSaxoCreds } from './user-saxo';

export interface RequestCreds {
  accessToken: string;
  accountKey: string;
  clientKey: string;
  accountId: string;
  environment: string;
  startBalance: number;
  source: 'db' | 'cookie';
}

export async function getRequestCreds(): Promise<RequestCreds | null> {
  // 1. Clerk-authenticated user → read from DB
  try {
    const { userId } = await auth();
    if (userId) {
      const creds = await getUserSaxoCreds(userId);
      if (creds) {
        return { ...creds, source: 'db' };
      }
    }
  } catch {
    // auth() may throw in edge cases — fall through to cookies
  }

  // 2. Cookie fallback (same device, unauthenticated or during OAuth handshake)
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('apex_saxo_token')?.value;
  const accountKey = cookieStore.get('apex_saxo_account_key')?.value;
  const clientKey = cookieStore.get('apex_saxo_client_key')?.value;

  if (!accessToken || !accountKey) return null;

  return {
    accessToken,
    accountKey,
    clientKey: clientKey || accountKey,
    accountId: accountKey,
    environment: process.env.SAXO_ENV || 'sim',
    startBalance: Number(process.env.START_BALANCE) || 1000000,
    source: 'cookie',
  };
}

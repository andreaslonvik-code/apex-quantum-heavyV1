import { NextResponse } from 'next/server';
import { getRequestCreds } from '@/lib/get-request-creds';
import { runScanForUser } from '@/lib/trading/engine';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Manual trigger for the user's own tick. Used from the dashboard for testing.
 *  Honours the leader-follower model: if LEADER_CLERK_USER_ID is set and this
 *  user is NOT the leader, this manual tick will mirror the leader's latest
 *  decision (same as cron) rather than spending a Grok call on the follower. */
export async function POST() {
  const c = await getRequestCreds();
  if (!c) {
    return NextResponse.json({ error: 'Not connected to Alpaca' }, { status: 401 });
  }
  const leaderId = process.env.LEADER_CLERK_USER_ID || undefined;
  const signalSource =
    leaderId && leaderId !== c.clerkUserId ? leaderId : undefined;
  const result = await runScanForUser(
    { apiKey: c.apiKey, apiSecret: c.apiSecret, env: c.environment },
    c.clerkUserId,
    signalSource,
  );
  return NextResponse.json(result);
}

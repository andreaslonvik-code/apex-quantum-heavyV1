import { NextResponse } from 'next/server';
import { getRequestCreds } from '@/lib/get-request-creds';
import { runScanForUser } from '@/lib/trading/engine';

export const dynamic = 'force-dynamic';

/** Manual trigger for the user's own tick. Used from the dashboard for testing. */
export async function POST() {
  const c = await getRequestCreds();
  if (!c) {
    return NextResponse.json({ error: 'Not connected to Alpaca' }, { status: 401 });
  }
  const result = await runScanForUser(
    { apiKey: c.apiKey, apiSecret: c.apiSecret, env: c.environment },
    c.clerkUserId,
  );
  return NextResponse.json(result);
}

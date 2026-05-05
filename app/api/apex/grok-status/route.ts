import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getLatestDecisionsForUser } from '@/lib/grok-decisions';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const latest = await getLatestDecisionsForUser(userId);
  return NextResponse.json({ latest });
}

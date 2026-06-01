import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { deleteUserAlpacaCreds } from '@/lib/user-alpaca';
import { checkSameOrigin } from '@/lib/csrf';

export async function POST(req: NextRequest) {
  // H1 CSRF — disconnect deletes API creds; require same-origin POST.
  const csrf = checkSameOrigin(req);
  if (!csrf.ok) {
    return NextResponse.json({ error: 'cross_origin_blocked' }, { status: 403 });
  }
  const { userId } = await auth();
  if (userId) {
    await deleteUserAlpacaCreds(userId);
  }
  return NextResponse.json({ success: true });
}

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { deleteUserAlpacaCreds } from '@/lib/user-alpaca';

export async function POST() {
  const { userId } = await auth();
  if (userId) {
    await deleteUserAlpacaCreds(userId);
  }
  return NextResponse.json({ success: true });
}

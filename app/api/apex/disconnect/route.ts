import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { cookies } from 'next/headers';
import { deleteUserSaxoCreds } from '@/lib/user-saxo';

export async function POST() {
  // Remove from database (user-scoped, persists across devices)
  const { userId } = await auth();
  if (userId) {
    await deleteUserSaxoCreds(userId);
  }

  // Always clear browser cookies
  const cookieStore = await cookies();
  cookieStore.delete('apex_saxo_token');
  cookieStore.delete('apex_saxo_account_key');
  cookieStore.delete('apex_saxo_client_key');
  cookieStore.delete('apex_saxo_connected');

  return NextResponse.json({ success: true });
}

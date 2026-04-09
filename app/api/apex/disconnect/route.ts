import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  const cookieStore = await cookies();
  
  // Clear all Apex Quantum cookies
  cookieStore.delete('apex_saxo_token');
  cookieStore.delete('apex_saxo_account_key');
  cookieStore.delete('apex_saxo_connected');
  
  return NextResponse.json({ success: true });
}

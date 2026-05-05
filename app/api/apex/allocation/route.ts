import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  DEFAULT_ALLOCATION,
  getUserAllocation,
  saveUserAllocation,
  type UserAllocation,
} from '@/lib/user-allocation';

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const allocation = await getUserAllocation(userId);
  return NextResponse.json({ allocation });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const stocks = Number(body?.stocks);
  const crypto = Number(body?.crypto);
  const commodities = Number(body?.commodities);

  const next: UserAllocation = {
    stocks: Number.isFinite(stocks) ? stocks : DEFAULT_ALLOCATION.stocks,
    crypto: Number.isFinite(crypto) ? crypto : DEFAULT_ALLOCATION.crypto,
    commodities: Number.isFinite(commodities) ? commodities : DEFAULT_ALLOCATION.commodities,
  };

  try {
    await saveUserAllocation(userId, next);
    return NextResponse.json({ ok: true, allocation: next });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Save failed' },
      { status: 400 },
    );
  }
}

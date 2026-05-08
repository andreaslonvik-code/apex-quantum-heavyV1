import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { hasPlusAccess } from '@/lib/access';
import { fetchQuotes } from '@/lib/yahoo-finance';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Batch live-prices endpoint. Tickers passed as `?tickers=NVDA,EQNR.OL,...`
 * Up to 50 per request. Returns a map keyed by ticker:
 * { NVDA: { price, currency, previousClose, changeFromPrevClose }, ... }
 */
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!(await hasPlusAccess())) {
    return NextResponse.json({ error: 'beta_only' }, { status: 403 });
  }

  const param = req.nextUrl.searchParams.get('tickers') ?? '';
  const tickers = param
    .split(',')
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 50);

  if (tickers.length === 0) {
    return NextResponse.json({ ok: true, prices: {} });
  }

  const quotes = await fetchQuotes(tickers);
  return NextResponse.json({ ok: true, prices: quotes }, {
    headers: {
      // Live prices change but not faster than ~30 sec — short browser cache
      // saves Yahoo round-trips when users toggle filters.
      'Cache-Control': 'private, max-age=30',
    },
  });
}

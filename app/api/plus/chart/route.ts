import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { hasPlusAccess } from '@/lib/access';
import { fetchChart } from '@/lib/yahoo-finance';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Daily-close chart points for one ticker. `?ticker=NVDA&range=1mo|3mo|6mo|1y`.
 * Returns: { ok: true, ticker, range, points: [{t, c}, ...] }
 */
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!(await hasPlusAccess())) {
    return NextResponse.json({ error: 'beta_only' }, { status: 403 });
  }

  const ticker = (req.nextUrl.searchParams.get('ticker') ?? '').trim().toUpperCase();
  if (!ticker) {
    return NextResponse.json({ error: 'missing_ticker' }, { status: 400 });
  }
  const rangeParam = req.nextUrl.searchParams.get('range') ?? '1mo';
  const range = (['1mo', '3mo', '6mo', '1y'] as const).includes(rangeParam as never)
    ? (rangeParam as '1mo' | '3mo' | '6mo' | '1y')
    : '1mo';

  const points = await fetchChart(ticker, range);
  return NextResponse.json(
    { ok: true, ticker, range, points },
    {
      headers: {
        // Daily closes don't change intraday — cache aggressively.
        'Cache-Control': 'private, max-age=300',
      },
    },
  );
}

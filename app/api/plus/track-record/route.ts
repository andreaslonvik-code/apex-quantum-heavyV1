import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { hasPlusAccess } from '@/lib/access';
import { listPricedSignalsSince } from '@/lib/plus-db';
import { fetchQuotes } from '@/lib/yahoo-finance';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Computes hit-rate over the last N days of signals that have a recorded
 * `price_at_signal`. WATCH actions are excluded (no directional thesis).
 *
 * "Closed" = signal older than 7 days. We treat closed signals as completed
 * outcomes; signals younger than 7 days are still "open" and shown as
 * unrealized changes.
 *
 * BUY: win when current >= signal price.
 * SELL: win when current < signal price.
 * HOLD: neutral — count as win when within ±3% of signal price.
 *
 * `?days=30|60|90` controls lookback.
 */
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!(await hasPlusAccess())) {
    return NextResponse.json({ error: 'beta_only' }, { status: 403 });
  }

  const daysParam = parseInt(req.nextUrl.searchParams.get('days') ?? '30', 10);
  const days = Number.isFinite(daysParam) ? Math.max(7, Math.min(180, daysParam)) : 30;

  try {
    const rows = await listPricedSignalsSince(days);
    if (rows.length === 0) {
      return NextResponse.json({
        ok: true,
        days,
        total: 0,
        closed: 0,
        open: 0,
        wins: 0,
        losses: 0,
        winRate: null,
        avgWinPct: null,
        avgLossPct: null,
      });
    }

    const tickers = Array.from(new Set(rows.map((r) => r.ticker)));
    const quotes = await fetchQuotes(tickers);

    const now = Date.now();
    const CLOSED_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

    let total = 0;
    let closed = 0;
    let open = 0;
    let wins = 0;
    let losses = 0;
    const winPcts: number[] = [];
    const lossPcts: number[] = [];

    for (const r of rows) {
      if (r.action === 'WATCH') continue; // no directional thesis
      const entry = r.price_at_signal;
      if (!entry || entry <= 0) continue;
      const q = quotes[r.ticker.toUpperCase()];
      if (!q) continue;
      const current = q.price;
      const pct = (current - entry) / entry;
      const ageMs = now - new Date(r.created_at).getTime();
      const isClosed = ageMs >= CLOSED_AFTER_MS;

      total += 1;
      if (isClosed) {
        closed += 1;
        let isWin = false;
        if (r.action === 'BUY') isWin = pct >= 0;
        else if (r.action === 'SELL') isWin = pct < 0;
        else if (r.action === 'HOLD') isWin = Math.abs(pct) < 0.03;

        if (isWin) {
          wins += 1;
          // For SELL signals, "win" means stock fell — store as positive perf.
          winPcts.push(r.action === 'SELL' ? -pct : pct);
        } else {
          losses += 1;
          lossPcts.push(r.action === 'SELL' ? -pct : pct);
        }
      } else {
        open += 1;
      }
    }

    const avg = (xs: number[]) => (xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length);

    return NextResponse.json({
      ok: true,
      days,
      total,
      closed,
      open,
      wins,
      losses,
      winRate: closed > 0 ? wins / closed : null,
      avgWinPct: avg(winPcts),
      avgLossPct: avg(lossPcts),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

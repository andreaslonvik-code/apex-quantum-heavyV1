// Public (unauth) marketing endpoint that powers the landing page's
// "Live cockpit" card. Iterates every connected Alpaca account, picks
// the user with the highest session return, and returns a compact
// snapshot — equity chart, P&L, Sharpe, recent agent activity, and
// the user's open positions for the ticker marquee.
//
// No identifiers are leaked: only aggregate financial metrics + public
// ticker symbols. Result is cached in-process for 30 s so the home page
// doesn't spawn a fanout per visitor.

import { NextResponse } from 'next/server';
import { getAllConnectedUsers } from '@/lib/user-alpaca';
import {
  getAccount,
  getOrders,
  getPositions,
  getPortfolioHistory,
  type AlpacaCreds,
  type AlpacaPortfolioHistory,
} from '@/lib/alpaca';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface PositionTick {
  ticker: string;
  pct: number;        // % since avg entry
  price: number;      // current price
  dir: 'up' | 'dn';
}

interface TopTraderPayload {
  ok: true;
  hasData: boolean;
  pnlValue: number;        // all-time P&L in account currency
  pnlPct: number;          // all-time % return
  currency: string;        // 'USD', 'NOK', etc
  sharpe: number | null;   // 30D rolling annualised, null if thin data
  actions: { buy: number; sell: number; scans: number; errors: number };
  windowMinutes: number;   // window the action counts cover
  chart: number[];         // equity series — all-time, daily bars
  positions: PositionTick[];
  asOf: string;
}

const CACHE_TTL_MS = 30_000;
let cache: { fetchedAt: number; payload: TopTraderPayload } | null = null;

const FAILED_STATUSES = new Set(['rejected', 'canceled', 'expired', 'suspended']);

function annualisedSharpe(equity: number[]): number | null {
  // Daily returns from a series of daily equities.
  const points = equity.filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0);
  if (points.length < 5) return null;
  const rets: number[] = [];
  for (let i = 1; i < points.length; i++) {
    const r = points[i] / points[i - 1] - 1;
    if (Number.isFinite(r)) rets.push(r);
  }
  if (rets.length < 4) return null;
  const mean = rets.reduce((s, x) => s + x, 0) / rets.length;
  const variance = rets.reduce((s, x) => s + (x - mean) ** 2, 0) / (rets.length - 1);
  const sd = Math.sqrt(variance);
  if (!Number.isFinite(sd) || sd === 0) return null;
  return (mean / sd) * Math.sqrt(252);
}

function downsampleChart(history: AlpacaPortfolioHistory | null): number[] {
  if (!history) return [];
  const series = history.equity.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (series.length === 0) return [];
  // Cap to ~140 points for clean rendering.
  if (series.length <= 140) return series;
  const step = Math.ceil(series.length / 140);
  const out: number[] = [];
  for (let i = 0; i < series.length; i += step) out.push(series[i]);
  return out;
}

interface Candidate {
  creds: AlpacaCreds;
  equity: number;
  cash: number;
  basis: number;
  currency: string;
  pnlValue: number;
  pnlPct: number;
}

async function snapshotUser(
  user: Awaited<ReturnType<typeof getAllConnectedUsers>>[number]
): Promise<Candidate | null> {
  const creds: AlpacaCreds = {
    apiKey: user.apiKey,
    apiSecret: user.apiSecret,
    env: user.environment,
  };
  const r = await getAccount(creds);
  if (!r.success) return null;
  const equity = parseFloat(r.data.equity) || parseFloat(r.data.portfolio_value) || 0;
  const cash = parseFloat(r.data.cash) || 0;
  const basis = user.startBalance && user.startBalance > 0 ? user.startBalance : equity;
  const pnlValue = equity - basis;
  const pnlPct = basis > 0 ? (pnlValue / basis) * 100 : 0;
  return {
    creds,
    equity,
    cash,
    basis,
    currency: r.data.currency || 'USD',
    pnlValue,
    pnlPct,
  };
}

async function buildPayload(): Promise<TopTraderPayload> {
  const users = await getAllConnectedUsers();
  if (users.length === 0) {
    return emptyPayload();
  }

  const candidates = (await Promise.all(users.map(snapshotUser))).filter(
    (c): c is Candidate => c !== null
  );
  if (candidates.length === 0) return emptyPayload();

  candidates.sort((a, b) => b.pnlPct - a.pnlPct);
  const winner = candidates[0];

  // Pull the winner's position + order + history details in parallel.
  // All-time history drives both the chart and the P&L number.
  // 30-day history kept separately for the rolling Sharpe figure since
  // an all-time Sharpe with thin early data is noisy.
  const [positionsRes, ordersRes, historyAllRes, historyMonthRes] = await Promise.all([
    getPositions(winner.creds),
    getOrders(winner.creds, { status: 'all', limit: 100 }),
    getPortfolioHistory(winner.creds, { period: 'all', timeframe: '1D' }),
    getPortfolioHistory(winner.creds, { period: '1M', timeframe: '1D' }),
  ]);

  // All-time P&L: prefer Alpaca's base_value from the all-time history so
  // the % return matches what the user sees on their dashboard. Fall back
  // to equity - startBalance if the series is missing.
  let pnlValue = winner.pnlValue;
  let pnlPct = winner.pnlPct;
  if (historyAllRes.success) {
    const eq = historyAllRes.data.equity.filter(
      (v): v is number => typeof v === 'number' && Number.isFinite(v)
    );
    const base = historyAllRes.data.base_value;
    if (eq.length >= 2 && base > 0) {
      const last = eq[eq.length - 1];
      pnlValue = last - base;
      pnlPct = (pnlValue / base) * 100;
    }
  }

  const chart = downsampleChart(historyAllRes.success ? historyAllRes.data : null);
  const sharpe = historyMonthRes.success ? annualisedSharpe(historyMonthRes.data.equity as number[]) : null;

  // Activity window: last hour by default (60-second windows are usually 0
  // for low-frequency runs which would feel broken on the marketing page).
  const WINDOW_MIN = 60;
  const windowStartMs = Date.now() - WINDOW_MIN * 60 * 1000;
  let buy = 0;
  let sell = 0;
  let errors = 0;
  let scans = 0;
  if (ordersRes.success) {
    for (const o of ordersRes.data) {
      const t = Date.parse(o.submitted_at);
      if (!Number.isFinite(t) || t < windowStartMs) continue;
      scans++;
      if (FAILED_STATUSES.has(o.status)) errors++;
      else if (o.side === 'sell') sell++;
      else if (o.side === 'buy') buy++;
    }
  }

  let positions: PositionTick[] = [];
  if (positionsRes.success) {
    positions = positionsRes.data
      .map((p) => {
        const pct = parseFloat(p.unrealized_plpc);
        const price = parseFloat(p.current_price);
        const mv = Math.abs(parseFloat(p.market_value) || 0);
        return {
          ticker: p.symbol.toUpperCase(),
          pct: Number.isFinite(pct) ? pct * 100 : 0,
          price: Number.isFinite(price) ? price : 0,
          dir: (Number.isFinite(pct) ? pct : 0) >= 0 ? ('up' as const) : ('dn' as const),
          _mv: mv,
        };
      })
      .sort((a, b) => b._mv - a._mv)
      .slice(0, 12)
      .map(({ ticker, pct, price, dir }) => ({ ticker, pct, price, dir }));
  }

  return {
    ok: true,
    hasData: true,
    pnlValue,
    pnlPct,
    currency: winner.currency,
    sharpe,
    actions: { buy, sell, scans, errors },
    windowMinutes: WINDOW_MIN,
    chart,
    positions,
    asOf: new Date().toISOString(),
  };
}

function emptyPayload(): TopTraderPayload {
  return {
    ok: true,
    hasData: false,
    pnlValue: 0,
    pnlPct: 0,
    currency: 'USD',
    sharpe: null,
    actions: { buy: 0, sell: 0, scans: 0, errors: 0 },
    windowMinutes: 60,
    chart: [],
    positions: [],
    asOf: new Date().toISOString(),
  };
}

export async function GET() {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json(cache.payload, {
      headers: { 'Cache-Control': 'public, max-age=15, stale-while-revalidate=60' },
    });
  }
  try {
    const payload = await buildPayload();
    cache = { fetchedAt: Date.now(), payload };
    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'public, max-age=15, stale-while-revalidate=60' },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}

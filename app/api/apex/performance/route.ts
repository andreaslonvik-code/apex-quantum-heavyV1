import { NextResponse } from 'next/server';
import { getRequestCreds } from '@/lib/get-request-creds';
import { getAccount, getPositions, getStockBars } from '@/lib/alpaca';

// Lightweight in-process cache per benchmark symbol — refreshes every 60 s.
// Keeps the dashboard's 3-second poll loop from hammering the data API. SPY
// powers the chart overlay + "vs S&P 500" delta; QQQ powers the NASDAQ card
// in the top BenchmarkBar.
const benchCache: Map<string, { fetchedAt: number; values: number[] }> = new Map();
const BENCH_TTL_MS = 60_000;

async function fetchBenchmark(
  creds: { apiKey: string; apiSecret: string; env: 'paper' | 'live' },
  symbol: string,
): Promise<number[]> {
  const cached = benchCache.get(symbol);
  if (cached && Date.now() - cached.fetchedAt < BENCH_TTL_MS) return cached.values;
  const r = await getStockBars(creds, symbol, { timeframe: '15Min', limit: 30 });
  if (!r.success) return cached?.values ?? [];
  const values = r.data.map((b) => b.c);
  benchCache.set(symbol, { fetchedAt: Date.now(), values });
  return values;
}

function pctChange(values: number[]): number | null {
  const start = values[0];
  const end = values[values.length - 1];
  if (!start || !end) return null;
  return (end / start - 1) * 100;
}

// In-memory performance history (resets on deploy). Keyed per user.
const performanceHistory: Map<
  string,
  Array<{
    timestamp: string;
    balance: number;
    portfolioValue: number;
    pnl: number;
    pnlPercent: number;
  }>
> = new Map();

export async function GET() {
  try {
    const userCreds = await getRequestCreds();
    if (!userCreds) {
      return NextResponse.json({ error: 'Not connected' }, { status: 401 });
    }

    const creds = {
      apiKey: userCreds.apiKey,
      apiSecret: userCreds.apiSecret,
      env: userCreds.environment,
    };

    const [accountRes, positionsRes] = await Promise.all([
      getAccount(creds),
      getPositions(creds),
    ]);

    if (!accountRes.success) {
      return NextResponse.json(
        { error: 'Failed to fetch account', details: accountRes.error },
        { status: accountRes.status || 500 }
      );
    }

    const account = accountRes.data;
    const totalValue = parseFloat(account.equity) || parseFloat(account.portfolio_value) || 0;
    const cashBalance = parseFloat(account.cash) || 0;

    let positionsValue = 0;
    if (positionsRes.success) {
      for (const p of positionsRes.data) {
        positionsValue += Math.abs(parseFloat(p.market_value) || 0);
      }
    }

    const initialValue = userCreds.startBalance || totalValue;
    const pnl = totalValue - initialValue;
    const pnlPercent = initialValue > 0 ? (pnl / initialValue) * 100 : 0;

    const userKey = userCreds.accountId || 'default';
    if (!performanceHistory.has(userKey)) performanceHistory.set(userKey, []);
    const history = performanceHistory.get(userKey)!;

    const now = new Date().toISOString();
    history.push({ timestamp: now, balance: cashBalance, portfolioValue: totalValue, pnl, pnlPercent });
    if (history.length > 1000) history.shift();

    const chartData = history.map((h) => ({
      time: new Date(h.timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      timestamp: h.timestamp,
      value: Math.round(h.portfolioValue),
      pnl: Math.round(h.pnl),
      pnlPercent: Number(h.pnlPercent.toFixed(2)),
    }));

    const firstValue = history[0]?.portfolioValue || initialValue;
    const sessionPnl = totalValue - firstValue;
    const sessionPnlPercent = firstValue > 0 ? (sessionPnl / firstValue) * 100 : 0;

    let peak = initialValue;
    let maxDrawdown = 0;
    for (const point of history) {
      if (point.portfolioValue > peak) peak = point.portfolioValue;
      const drawdown = peak > 0 ? ((peak - point.portfolioValue) / peak) * 100 : 0;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    // ── Benchmark fetch (SPY for chart overlay, QQQ for NASDAQ card) ──
    // Both pulled in parallel; per-symbol 60-second cache.
    const credsForBench = {
      apiKey: userCreds.apiKey,
      apiSecret: userCreds.apiSecret,
      env: userCreds.environment,
    };
    const [benchValues, qqqValues] = await Promise.all([
      fetchBenchmark(credsForBench, 'SPY'),
      fetchBenchmark(credsForBench, 'QQQ'),
    ]);
    const benchPct = pctChange(benchValues);
    const qqqPct = pctChange(qqqValues);
    const vsBenchPct = benchPct === null ? null : sessionPnlPercent - benchPct;

    return NextResponse.json({
      current: {
        balance: cashBalance,
        positionsValue,
        totalValue,
        pnl,
        pnlPercent,
        initialValue,
      },
      session: {
        startValue: firstValue,
        currentValue: totalValue,
        pnl: sessionPnl,
        pnlPercent: sessionPnlPercent,
        peak,
        maxDrawdown,
        dataPoints: history.length,
      },
      chartData,
      benchmark: {
        symbol: 'SPY',
        values: benchValues,
        pct: benchPct,
        vsBenchPct,
      },
      // Compact comparison for the BenchmarkBar at top of the dashboard.
      // Apex pct is sessionPnlPercent (intraday return), matching the
      // benchmark window so the comparison is apples-to-apples.
      benchmarkBar: {
        apexPct: sessionPnlPercent,
        spyPct: benchPct,
        qqqPct: qqqPct,
      },
      timestamp: now,
      sync: {
        cash: cashBalance,
        equity: totalValue,
        positionsValue,
        currency: account.currency,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: 'Failed to fetch performance data', details: String(e) },
      { status: 500 }
    );
  }
}

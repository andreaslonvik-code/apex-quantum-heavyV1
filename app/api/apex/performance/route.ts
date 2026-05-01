import { NextRequest, NextResponse } from 'next/server';
import { getRequestCreds } from '@/lib/get-request-creds';
import {
  getAccount,
  getPositions,
  getPortfolioHistory,
  getStockBars,
  type AlpacaCreds,
  type AlpacaPortfolioHistory,
  type AlpacaResult,
} from '@/lib/alpaca';

type Tf = '1H' | '24H' | '7D' | '30D' | 'MTD' | 'YTD' | 'ALL';

type BenchTf = '1Min' | '5Min' | '15Min' | '1Hour' | '1Day';

interface TfCfg {
  period: string;
  timeframe: string;
  benchTf: BenchTf;
  benchLimit: number;
  sliceLast?: number;
  sliceMode?: 'MTD' | 'YTD';
  tickFormat: 'time' | 'date' | 'month';
}

// Maps each UI timeframe → Alpaca portfolio_history params + matching SPY bar
// fetch + a tick-formatting hint. `sliceLast` clips a sub-day window from a
// 1D series; `sliceMode` clips from month/year start in ET.
const TF_MAP: Record<Tf, TfCfg> = {
  '1H':  { period: '1D',  timeframe: '5Min',  benchTf: '5Min',  benchLimit: 13,   sliceLast: 12,   tickFormat: 'time'  },
  '24H': { period: '1D',  timeframe: '5Min',  benchTf: '5Min',  benchLimit: 80,                    tickFormat: 'time'  },
  '7D':  { period: '1W',  timeframe: '15Min', benchTf: '15Min', benchLimit: 130,                   tickFormat: 'date'  },
  '30D': { period: '1M',  timeframe: '1H',    benchTf: '1Hour', benchLimit: 200,                   tickFormat: 'date'  },
  'MTD': { period: '1M',  timeframe: '1H',    benchTf: '1Hour', benchLimit: 200,  sliceMode: 'MTD', tickFormat: 'date'  },
  'YTD': { period: '1A',  timeframe: '1D',    benchTf: '1Day',  benchLimit: 260,  sliceMode: 'YTD', tickFormat: 'month' },
  'ALL': { period: 'all', timeframe: '1D',    benchTf: '1Day',  benchLimit: 1000,                   tickFormat: 'month' },
};

// Per (symbol, timeframe, limit) cache — refreshes every 60 s. Keeps the
// dashboard's 3 s poll loop from re-hitting Alpaca for benchmark bars.
const benchCache: Map<string, { fetchedAt: number; values: number[] }> = new Map();
const BENCH_TTL_MS = 60_000;

async function fetchBenchmark(
  creds: AlpacaCreds,
  symbol: string,
  timeframe: BenchTf,
  limit: number,
): Promise<number[]> {
  const key = `${symbol}:${timeframe}:${limit}`;
  const cached = benchCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < BENCH_TTL_MS) return cached.values;
  const r = await getStockBars(creds, symbol, { timeframe, limit });
  if (!r.success) return cached?.values ?? [];
  const values = r.data.map((b) => b.c);
  benchCache.set(key, { fetchedAt: Date.now(), values });
  return values;
}

function pctChange(values: number[]): number | null {
  const start = values[0];
  const end = values[values.length - 1];
  if (!start || !end) return null;
  return (end / start - 1) * 100;
}

function buildTicks(timestamps: number[], format: 'time' | 'date' | 'month'): string[] {
  if (timestamps.length < 2) return [];
  const N = 8;
  const out: string[] = [];
  for (let i = 0; i < N; i++) {
    const idx = Math.round((i / (N - 1)) * (timestamps.length - 1));
    const d = new Date(timestamps[idx] * 1000);
    if (format === 'time') {
      out.push(d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York' }));
    } else if (format === 'date') {
      out.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' }));
    } else {
      out.push(d.toLocaleDateString('en-US', { month: 'short', timeZone: 'America/New_York' }));
    }
  }
  return out;
}

function buildEquitySeries(history: AlpacaPortfolioHistory, cfg: TfCfg) {
  const ts: number[] = [];
  const eq: number[] = [];
  for (let i = 0; i < history.timestamp.length; i++) {
    const v = history.equity[i];
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
      ts.push(history.timestamp[i]);
      eq.push(v);
    }
  }
  if (cfg.sliceMode) {
    const now = new Date();
    const startSec = cfg.sliceMode === 'MTD'
      ? Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) / 1000)
      : Math.floor(Date.UTC(now.getUTCFullYear(), 0, 1) / 1000);
    const startIdx = ts.findIndex((t) => t >= startSec);
    if (startIdx > 0) {
      ts.splice(0, startIdx);
      eq.splice(0, startIdx);
    }
  }
  if (cfg.sliceLast && eq.length > cfg.sliceLast) {
    const drop = eq.length - cfg.sliceLast;
    ts.splice(0, drop);
    eq.splice(0, drop);
  }
  return { ts, eq };
}

export async function GET(req: NextRequest) {
  try {
    const userCreds = await getRequestCreds();
    if (!userCreds) {
      return NextResponse.json({ error: 'Not connected' }, { status: 401 });
    }

    const url = new URL(req.url);
    const tfParam = (url.searchParams.get('tf') || '24H').toUpperCase();
    const tf: Tf = (Object.prototype.hasOwnProperty.call(TF_MAP, tfParam) ? tfParam : '24H') as Tf;
    const cfg = TF_MAP[tf];

    const creds: AlpacaCreds = {
      apiKey: userCreds.apiKey,
      apiSecret: userCreds.apiSecret,
      env: userCreds.environment,
    };

    const isIntradayTf = cfg.period === '1D';
    const useExtendedHours = ['1Min', '5Min', '15Min'].includes(cfg.timeframe);
    const reuseHistoryForDayBar = isIntradayTf && cfg.timeframe === '5Min';
    const reuseSpyChartForDayBar = isIntradayTf && cfg.benchTf === '5Min' && cfg.benchLimit >= 78;

    const [accountRes, positionsRes, historyRes, dayHistoryFetched, spyChartValues, spyDayFetched, qqqValues] = await Promise.all([
      getAccount(creds),
      getPositions(creds),
      getPortfolioHistory(creds, { period: cfg.period, timeframe: cfg.timeframe, extended_hours: useExtendedHours }),
      reuseHistoryForDayBar
        ? Promise.resolve<AlpacaResult<AlpacaPortfolioHistory> | null>(null)
        : getPortfolioHistory(creds, { period: '1D', timeframe: '5Min', extended_hours: true }),
      fetchBenchmark(creds, 'SPY', cfg.benchTf, cfg.benchLimit),
      reuseSpyChartForDayBar
        ? Promise.resolve<number[] | null>(null)
        : fetchBenchmark(creds, 'SPY', '5Min', 80),
      fetchBenchmark(creds, 'QQQ', '5Min', 80),
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

    // ── Windowed equity series ──────────────────────────────────────────
    let ts: number[] = [];
    let eq: number[] = [];
    if (historyRes.success) {
      ({ ts, eq } = buildEquitySeries(historyRes.data, cfg));
    }
    const nowSec = Math.floor(Date.now() / 1000);
    if (eq.length === 0) {
      ts = [nowSec];
      eq = [totalValue];
    } else if (Math.abs(eq[eq.length - 1] - totalValue) > 0.5) {
      // Append a live tip — Alpaca's portfolio history lags the live equity by
      // a tick, so the user's chart never reaches the headline number without it.
      ts.push(nowSec);
      eq.push(totalValue);
    }

    const windowStart = eq[0];
    const windowPnl = totalValue - windowStart;
    const windowPnlPct = windowStart > 0 ? (windowPnl / windowStart) * 100 : 0;

    let peak = eq[0];
    let maxDrawdown = 0;
    for (const v of eq) {
      if (v > peak) peak = v;
      const dd = peak > 0 ? ((peak - v) / peak) * 100 : 0;
      if (dd > maxDrawdown) maxDrawdown = dd;
    }

    const inceptionPnl = totalValue - initialValue;
    const inceptionPnlPct = initialValue > 0 ? (inceptionPnl / initialValue) * 100 : 0;

    const chartData = eq.map((v, i) => ({ timestamp: ts[i], value: Math.round(v * 100) / 100 }));
    const xTicks = buildTicks(ts, cfg.tickFormat);

    // ── Benchmark overlay (matched to tf) ───────────────────────────────
    const benchPctWindow = pctChange(spyChartValues);
    const vsBenchPct = benchPctWindow === null ? null : windowPnlPct - benchPctWindow;

    // ── BenchmarkBar (always intraday, regardless of tf) ────────────────
    const dayHistoryRes = dayHistoryFetched ?? historyRes;
    let apexDayPct: number | null = null;
    if (dayHistoryRes?.success) {
      const dayEq: number[] = [];
      for (const v of dayHistoryRes.data.equity) {
        if (typeof v === 'number' && Number.isFinite(v) && v > 0) dayEq.push(v);
      }
      apexDayPct = dayEq.length >= 2 ? (dayEq[dayEq.length - 1] / dayEq[0] - 1) * 100 : null;
    }
    const spyDayValues = spyDayFetched ?? spyChartValues;
    const spyDayPct = pctChange(spyDayValues);
    const qqqDayPct = pctChange(qqqValues);

    return NextResponse.json({
      tf,
      current: {
        balance: cashBalance,
        positionsValue,
        totalValue,
        pnl: windowPnl,
        pnlPercent: windowPnlPct,
        initialValue,
        sinceInceptionPnl: inceptionPnl,
        sinceInceptionPnlPct: inceptionPnlPct,
      },
      session: {
        startValue: windowStart,
        currentValue: totalValue,
        pnl: windowPnl,
        pnlPercent: windowPnlPct,
        peak,
        maxDrawdown,
        dataPoints: eq.length,
      },
      chartData,
      xTicks,
      benchmark: {
        symbol: 'SPY',
        values: spyChartValues,
        pct: benchPctWindow,
        vsBenchPct,
      },
      benchmarkBar: {
        apexPct: apexDayPct,
        spyPct: spyDayPct,
        qqqPct: qqqDayPct,
      },
      timestamp: new Date().toISOString(),
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

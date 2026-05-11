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
  // 7D uses 1H bars (not 15Min) because paper Alpaca's portfolio_history at
  // 15Min granularity can include transient inflated samples during/after
  // large rebalances — equity briefly counts both spent cash and the new
  // position's market_value before paper-settle. 1H smooths past that and
  // matches Alpaca's own dashboard granularity for the same window.
  '7D':  { period: '1W',  timeframe: '1H',    benchTf: '1Hour', benchLimit: 168,                   tickFormat: 'date'  },
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
  const series = await fetchBenchmarkSeries(creds, symbol, timeframe, limit);
  return series.values;
}

interface BenchSeries {
  timestamps: number[]; // unix sec, same length as values
  values: number[];
}
const benchSeriesCache: Map<string, { fetchedAt: number; data: BenchSeries }> = new Map();

async function fetchBenchmarkSeries(
  creds: AlpacaCreds,
  symbol: string,
  timeframe: BenchTf,
  limit: number,
): Promise<BenchSeries> {
  const key = `${symbol}:${timeframe}:${limit}:series`;
  const cached = benchSeriesCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < BENCH_TTL_MS) return cached.data;
  const r = await getStockBars(creds, symbol, { timeframe, limit });
  if (!r.success) {
    return cached?.data ?? { timestamps: [], values: [] };
  }
  const data: BenchSeries = {
    timestamps: r.data.map((b) =>
      typeof b.t === 'string' ? Math.floor(new Date(b.t).getTime() / 1000) : 0,
    ),
    values: r.data.map((b) => b.c),
  };
  benchSeriesCache.set(key, { fetchedAt: Date.now(), data });
  // Also cache raw values for `fetchBenchmark` callers.
  benchCache.set(`${symbol}:${timeframe}:${limit}`, {
    fetchedAt: Date.now(),
    values: data.values,
  });
  return data;
}

/**
 * Re-sample a benchmark series so each output point aligns to a corresponding
 * equity timestamp. Without this the chart visually stretches a 6.5 h regular-
 * hours bench bar series across a 16 h pre/regular/after-hours equity window,
 * which makes the bench line look totally wrong relative to where price
 * actually was at each equity point.
 */
function alignBenchToEquity(
  bench: BenchSeries,
  equityTs: number[],
): number[] {
  if (bench.timestamps.length < 2 || equityTs.length === 0) return [];
  const out: number[] = [];
  let j = 0;
  for (const t of equityTs) {
    while (j < bench.timestamps.length - 1 && bench.timestamps[j + 1] <= t) j += 1;
    // Use the most-recent bench bar at or before this equity timestamp.
    out.push(bench.values[j]);
  }
  return out;
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

    const [accountRes, positionsRes, historyRes, dayHistoryFetched, spyChartSeries, qqqChartSeries, spyDayFetched, qqqDaySeries] = await Promise.all([
      getAccount(creds),
      getPositions(creds),
      getPortfolioHistory(creds, { period: cfg.period, timeframe: cfg.timeframe, extended_hours: useExtendedHours }),
      reuseHistoryForDayBar
        ? Promise.resolve<AlpacaResult<AlpacaPortfolioHistory> | null>(null)
        : getPortfolioHistory(creds, { period: '1D', timeframe: '5Min', extended_hours: true }),
      fetchBenchmarkSeries(creds, 'SPY', cfg.benchTf, cfg.benchLimit),
      fetchBenchmarkSeries(creds, 'QQQ', cfg.benchTf, cfg.benchLimit),
      reuseSpyChartForDayBar
        ? Promise.resolve<BenchSeries | null>(null)
        : fetchBenchmarkSeries(creds, 'SPY', '5Min', 80),
      fetchBenchmarkSeries(creds, 'QQQ', '5Min', 80),
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

    // Drop phantom-inflated samples. Paper Alpaca's portfolio_history can
    // briefly report equity ≈ 2× the real value during large rebalances
    // (double-counting spent cash + new position's market_value before
    // settlement). Without this filter, peak/drawdown read garbage and the
    // chart shows a spike Alpaca's own UI never displays. 2.5× current
    // totalValue is generous enough to preserve any real intraday swing.
    if (totalValue > 0 && eq.length > 0) {
      const cutoff = totalValue * 2.5;
      for (let i = eq.length - 1; i >= 0; i--) {
        if (eq[i] > cutoff) {
          eq.splice(i, 1);
          ts.splice(i, 1);
        }
      }
      if (eq.length === 0) {
        ts = [nowSec];
        eq = [totalValue];
      }
    }

    // Pick a clean baseline for the windowed P&L:
    //   1) For 24H, prefer Alpaca's `last_equity` (previous trading-day close),
    //      since `portfolio_history` can include anomalous leading samples from
    //      account funding time → bogus +500 % returns.
    //   2) Sanity-trim: if the chosen baseline is more than 5× away from the
    //      current value, the data is almost certainly stale; fall back to
    //      current value so we display ~0 % rather than a wild number.
    let windowStart = eq[0];
    const lastEquity =
      parseFloat((account as { last_equity?: string }).last_equity ?? '0') || 0;
    if (tf === '24H' && lastEquity > 0) {
      windowStart = lastEquity;
    }
    if (
      !Number.isFinite(windowStart) ||
      windowStart <= 0 ||
      (totalValue > 0 && (totalValue / windowStart > 5 || windowStart / totalValue > 5))
    ) {
      windowStart = totalValue;
    }
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

    // ── Benchmarks aligned to equity timestamps (fixes the visual stretch
    //    bug where 6.5 h SPY bars were spread across 16 h equity series). ──
    const spyAligned = alignBenchToEquity(spyChartSeries, ts);
    const qqqAligned = alignBenchToEquity(qqqChartSeries, ts);
    const benchPctWindow = pctChange(spyChartSeries.values);
    const qqqPctWindow = pctChange(qqqChartSeries.values);
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
    const spyDayValues = (spyDayFetched ?? spyChartSeries).values;
    const spyDayPct = pctChange(spyDayValues);
    const qqqDayPct = pctChange(qqqDaySeries.values);

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
        // Equity-timestamp-aligned values so the chart can plot bench
        // accurately at each equity point. Prefer this over `values`.
        valuesAligned: spyAligned,
        // Raw bench bars (legacy / debugging).
        values: spyChartSeries.values,
        pct: benchPctWindow,
        vsBenchPct,
      },
      benchmarkNasdaq: {
        symbol: 'QQQ',
        valuesAligned: qqqAligned,
        values: qqqChartSeries.values,
        pct: qqqPctWindow,
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

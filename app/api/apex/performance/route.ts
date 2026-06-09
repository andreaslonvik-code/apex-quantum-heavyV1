import { NextRequest, NextResponse } from 'next/server';
import { getRequestCreds } from '@/lib/get-request-creds';
import { fetchChart } from '@/lib/yahoo-finance';
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
  // 30D/MTD use DAILY portfolio-history resolution. Alpaca rejects intraday
  // timeframes (1H and below) over a 1-month period and returns an empty
  // series — which collapsed the chart to a flat +0 % headline plus a fake
  // placeholder curve. Daily is the correct granularity for a 1-month window
  // anyway (≈22 points), and matches what YTD/ALL already do successfully.
  '30D': { period: '1M',  timeframe: '1D',    benchTf: '1Hour', benchLimit: 200,                   tickFormat: 'date'  },
  'MTD': { period: '1M',  timeframe: '1D',    benchTf: '1Hour', benchLimit: 200,  sliceMode: 'MTD', tickFormat: 'date'  },
  'YTD': { period: '1A',  timeframe: '1D',    benchTf: '1Day',  benchLimit: 260,  sliceMode: 'YTD', tickFormat: 'month' },
  'ALL': { period: 'all', timeframe: '1D',    benchTf: '1Day',  benchLimit: 1000,                   tickFormat: 'month' },
};

// Per (symbol, timeframe, limit) cache — refreshes every 5 min. Keeps the
// dashboard's 3 s poll loop from re-hitting Alpaca for benchmark bars.
// 5 min is the right granularity: the smallest bench timeframe we use is
// 5Min bars, so any sub-bar-period TTL fetches the same bar repeatedly
// for no information gain.
const benchCache: Map<string, { fetchedAt: number; values: number[] }> = new Map();
const BENCH_TTL_MS = 300_000;

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

// Real index series for the "Indeks" chart mode. SPY/QQQ above are tradable
// ETF proxies; ^GSPC (S&P 500) and ^IXIC (NASDAQ Composite) are the actual
// index levels — what an investor expects to see. Fetched from Yahoo at a
// granularity matching each UI timeframe (intraday for short windows).
const YAHOO_TF: Record<Tf, { range: string; interval: string }> = {
  '1H':  { range: '1d',  interval: '5m'  },
  '24H': { range: '1d',  interval: '5m'  },
  '7D':  { range: '5d',  interval: '15m' },
  '30D': { range: '1mo', interval: '1d'  },
  'MTD': { range: '1mo', interval: '1d'  },
  'YTD': { range: 'ytd', interval: '1d'  },
  // ALL: daily granularity over 5 years. Weekly was too coarse — recent
  // account histories (days/weeks) collapsed to 1-2 weekly bars and the
  // index lines rendered near-flat. Daily covers any realistic account
  // span with proper variation.
  'ALL': { range: '5y',  interval: '1d'  },
};
const yahooIndexCache: Map<string, { fetchedAt: number; data: BenchSeries }> = new Map();

async function fetchIndexSeries(symbol: string, tf: Tf): Promise<BenchSeries> {
  const { range, interval } = YAHOO_TF[tf];
  const key = `${symbol}:${range}:${interval}`;
  const cached = yahooIndexCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < BENCH_TTL_MS) return cached.data;
  const points = await fetchChart(symbol, range, interval);
  if (points.length === 0) {
    // Yahoo hiccup — serve stale cache if we have it, else empty (chart
    // simply omits the line rather than showing wrong data).
    return cached?.data ?? { timestamps: [], values: [] };
  }
  const data: BenchSeries = {
    timestamps: points.map((p) => p.t),
    values: points.map((p) => p.c),
  };
  yahooIndexCache.set(key, { fetchedAt: Date.now(), data });
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
  // Pick label granularity from the actual span, not just the requested
  // timeframe. A young account viewed on ALL/YTD may span only weeks, in
  // which case `month` would print "May" eight times.
  const spanDays = (timestamps[timestamps.length - 1] - timestamps[0]) / 86400;
  let effective = format;
  if (format === 'month' && spanDays < 60) effective = 'date';
  if (format === 'date' && spanDays < 2) effective = 'time';
  const includeYear = effective === 'month' && spanDays > 365;

  const raw: string[] = [];
  for (let i = 0; i < N; i++) {
    const idx = Math.round((i / (N - 1)) * (timestamps.length - 1));
    const d = new Date(timestamps[idx] * 1000);
    if (effective === 'time') {
      raw.push(d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York' }));
    } else if (effective === 'date') {
      raw.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' }));
    } else {
      raw.push(d.toLocaleDateString('en-US', includeYear
        ? { month: 'short', year: '2-digit', timeZone: 'America/New_York' }
        : { month: 'short', timeZone: 'America/New_York' }));
    }
  }
  // Dedupe adjacent duplicates (e.g. two ticks landing on the same day
  // through rounding) — render as blanks so the axis stays evenly spaced
  // but doesn't repeat the same label.
  return raw.map((label, i) => (i > 0 && label === raw[i - 1] ? '' : label));
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

    const [accountRes, positionsRes, historyRes, dayHistoryFetched, spyChartSeries, qqqChartSeries, spyDayFetched, qqqDaySeries, sp500Series, nasdaqSeries] = await Promise.all([
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
      fetchIndexSeries('^GSPC', tf),
      fetchIndexSeries('^IXIC', tf),
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
    // Defensive self-heal: if the configured (period, timeframe) combo comes
    // back empty — e.g. an intraday timeframe Alpaca rejects for this period,
    // or a sparse young account — retry once at daily resolution before we
    // fall back to the flat single-point placeholder below. Daily history is
    // available for any account span, so this guarantees a real curve renders.
    if (eq.length === 0 && cfg.timeframe !== '1D') {
      const retry = await getPortfolioHistory(creds, { period: cfg.period, timeframe: '1D' });
      if (retry.success) {
        ({ ts, eq } = buildEquitySeries(retry.data, cfg));
      }
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
    // Real index levels (^GSPC, ^IXIC) for the index-comparison chart mode.
    // Yahoo's spot indices don't trade pre-/post-market, so on 1H/24H tabs
    // during extended hours the index series either comes back empty or
    // entirely covers the prior trading session (no overlap with the equity
    // window). Both cases align to a flat or empty line, so we fall back to
    // SPY/QQQ — same % return story, just via the ETF proxy that does trade
    // extended hours.
    const overlaps = (bench: BenchSeries): boolean =>
      bench.timestamps.length >= 2 &&
      ts.length > 0 &&
      bench.timestamps[bench.timestamps.length - 1] >= ts[0];
    const sp500Aligned = overlaps(sp500Series)
      ? alignBenchToEquity(sp500Series, ts)
      : spyAligned;
    const nasdaqAligned = overlaps(nasdaqSeries)
      ? alignBenchToEquity(nasdaqSeries, ts)
      : qqqAligned;
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
      // Real index levels — drives the "Indeks" chart mode. Actual S&P 500
      // and NASDAQ Composite values, not ETF proxies.
      indexSp500: {
        symbol: '^GSPC',
        valuesAligned: sp500Aligned,
        pct: pctChange(sp500Series.values),
      },
      indexNasdaq: {
        symbol: '^IXIC',
        valuesAligned: nasdaqAligned,
        pct: pctChange(nasdaqSeries.values),
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

/**
 * Tiny Yahoo Finance client — quote + chart endpoints.
 *
 * Yahoo's `query1.finance.yahoo.com` endpoints are unofficial and unkeyed.
 * They handle global symbols (`.OL`, `.DE`, `.HK`, `.T`, `.TW`, `.KS`, etc.)
 * which matches our existing watchlist format exactly. Rate-limit is generous
 * (~2000 req/hour from one IP) — well within our usage.
 *
 * Yahoo aggressively blocks requests without a browser User-Agent header, so
 * we always set one. If endpoints start 4xx-ing in production, the fallback
 * is to hot-swap to Finnhub or Twelve Data — kept this module small so the
 * swap is one file.
 */

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const FETCH_TIMEOUT_MS = 8000;

async function yahooFetch(url: string): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}`);
    return res.json();
  } finally {
    clearTimeout(t);
  }
}

export interface YahooQuote {
  ticker: string;
  price: number;
  currency: string;
  previousClose: number | null;
  /** Pct change since previous close, as decimal (0.012 = +1.2%). */
  changeFromPrevClose: number | null;
}

/**
 * Fetch live quotes for up to ~50 symbols in one call. Returns a map
 * keyed by uppercase ticker. Symbols that fail (delisted, typo) are
 * silently omitted — caller falls back to "no live data".
 */
export async function fetchQuotes(tickers: string[]): Promise<Record<string, YahooQuote>> {
  if (tickers.length === 0) return {};
  const symbols = tickers.map((t) => encodeURIComponent(t)).join(',');
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols}`;
  const out: Record<string, YahooQuote> = {};
  try {
    const raw = (await yahooFetch(url)) as {
      quoteResponse?: {
        result?: Array<{
          symbol?: string;
          regularMarketPrice?: number;
          regularMarketPreviousClose?: number;
          currency?: string;
        }>;
      };
    };
    const list = raw.quoteResponse?.result ?? [];
    for (const q of list) {
      if (!q.symbol || typeof q.regularMarketPrice !== 'number') continue;
      const prev = typeof q.regularMarketPreviousClose === 'number' ? q.regularMarketPreviousClose : null;
      out[q.symbol.toUpperCase()] = {
        ticker: q.symbol.toUpperCase(),
        price: q.regularMarketPrice,
        currency: q.currency ?? 'USD',
        previousClose: prev,
        changeFromPrevClose:
          prev && prev > 0 ? (q.regularMarketPrice - prev) / prev : null,
      };
    }
  } catch {
    // Best-effort — the UI gracefully omits price data when this fails.
  }
  return out;
}

export interface YahooChartPoint {
  t: number; // unix seconds
  c: number; // close
}

/**
 * Time series of closes for `ticker` over `range` at `interval` granularity.
 * `range`    — Yahoo strings: '1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', 'ytd', 'max'.
 * `interval` — Yahoo strings: '5m', '15m', '30m', '1h', '1d', '1wk'.
 * Intraday intervals (5m/15m/…) are only available for recent ranges.
 * Used for sparklines and for the real index series (^GSPC, ^IXIC) on the
 * dashboard's index-comparison chart.
 */
export async function fetchChart(
  ticker: string,
  range: string = '1mo',
  interval: string = '1d',
): Promise<YahooChartPoint[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    ticker,
  )}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}`;
  try {
    const raw = (await yahooFetch(url)) as {
      chart?: {
        result?: Array<{
          timestamp?: number[];
          indicators?: { quote?: Array<{ close?: Array<number | null> }> };
        }>;
      };
    };
    const r = raw.chart?.result?.[0];
    const ts = r?.timestamp ?? [];
    const closes = r?.indicators?.quote?.[0]?.close ?? [];
    const out: YahooChartPoint[] = [];
    for (let i = 0; i < ts.length; i += 1) {
      const c = closes[i];
      if (typeof c === 'number') out.push({ t: ts[i], c });
    }
    return out;
  } catch {
    return [];
  }
}

import type { AlpacaBar } from '@/lib/alpaca';

/** Wilder's RSI on close prices. Returns null if not enough bars. */
export function rsi(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const ch = closes[i] - closes[i - 1];
    if (ch >= 0) gain += ch;
    else loss -= ch;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  for (let i = period + 1; i < closes.length; i++) {
    const ch = closes[i] - closes[i - 1];
    const g = ch > 0 ? ch : 0;
    const l = ch < 0 ? -ch : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/** Simple moving average over the most recent N closes. */
export function sma(closes: number[], period: number): number | null {
  if (closes.length < period) return null;
  let s = 0;
  for (let i = closes.length - period; i < closes.length; i++) s += closes[i];
  return s / period;
}

/** MACD (12, 26, 9). Returns null if not enough bars. */
export function macd(closes: number[]): { macd: number; signal: number; hist: number } | null {
  const fastPeriod = 12;
  const slowPeriod = 26;
  const sigPeriod = 9;
  if (closes.length < slowPeriod + sigPeriod) return null;

  const fastK = 2 / (fastPeriod + 1);
  const slowK = 2 / (slowPeriod + 1);
  const sigK = 2 / (sigPeriod + 1);

  let fast = closes.slice(0, fastPeriod).reduce((a, b) => a + b, 0) / fastPeriod;
  for (let i = fastPeriod; i < slowPeriod; i++) fast = closes[i] * fastK + fast * (1 - fastK);
  let slow = closes.slice(0, slowPeriod).reduce((a, b) => a + b, 0) / slowPeriod;

  const macdLine: number[] = [];
  for (let i = slowPeriod; i < closes.length; i++) {
    fast = closes[i] * fastK + fast * (1 - fastK);
    slow = closes[i] * slowK + slow * (1 - slowK);
    macdLine.push(fast - slow);
  }
  if (macdLine.length < sigPeriod) return null;

  let sig = macdLine.slice(0, sigPeriod).reduce((a, b) => a + b, 0) / sigPeriod;
  for (let i = sigPeriod; i < macdLine.length; i++) sig = macdLine[i] * sigK + sig * (1 - sigK);

  const cur = macdLine[macdLine.length - 1];
  return { macd: cur, signal: sig, hist: cur - sig };
}

/**
 * Bullish RSI divergence: price has made a lower low while RSI has made a
 * higher low — classic "selling pressure exhausting" signal that often
 * precedes a bounce. Compares current bar to `lookback` bars back.
 *
 * Returns true when:
 *   - price[now] < price[lookback bars ago]
 *   - rsi[now]   > rsi[lookback bars ago]
 *
 * Caller passes the current RSI separately (already computed); we recompute
 * the past RSI from the truncated price series.
 */
export function bullishDivergence(
  closes: number[],
  currentRsi: number | null,
  // 4 bars on a 1Day timeframe = ~1 trading week. Long enough to be
  // meaningful, short enough to catch early reversal. Was 8 — too long;
  // missed the "early bounce" we want to catch.
  lookback = 4,
  rsiPeriod = 14,
): boolean {
  if (currentRsi == null) return false;
  if (closes.length < lookback + rsiPeriod + 1) return false;
  const pastSeries = closes.slice(0, closes.length - lookback);
  const pastRsi = rsi(pastSeries, rsiPeriod);
  if (pastRsi == null) return false;
  const currentPrice = closes[closes.length - 1];
  const pastPrice = closes[closes.length - 1 - lookback];
  return currentPrice < pastPrice && currentRsi > pastRsi;
}

/**
 * Volume accumulation: recent 3 bars' average volume is meaningfully higher
 * than the prior 20-bar baseline. Indicates smart-money accumulation
 * (institutions buying quietly during a price pullback).
 *
 * 1.15× catches early-stage accumulation. 1.3× was too high — by the time
 * volume crosses 1.3×, the bottom has usually already been put in and the
 * price is 2–3 % off the lows.
 */
export function volumeAccumulation(bars: AlpacaBar[], multiplier = 1.15): boolean {
  if (bars.length < 23) return false;
  const recent = bars.slice(-3);
  const baseline = bars.slice(-23, -3);
  const recentAvg = recent.reduce((s, b) => s + (b.v || 0), 0) / recent.length;
  const baselineAvg = baseline.reduce((s, b) => s + (b.v || 0), 0) / baseline.length;
  if (baselineAvg <= 0) return false;
  return recentAvg > baselineAvg * multiplier;
}

/**
 * RSI is rising over the last N bars (positive slope on last N RSI values).
 * Captures early-stage momentum confirmation — buyers stepping in *before*
 * RSI hits overbought, not just current oversold. Uses simple linear
 * regression slope on the last `lookback` RSI values; threshold of 0.5 RSI
 * units per bar filters out noise (random walk gives ~0–0.2).
 */
export function rsiRising(
  closes: number[],
  lookback = 5,
  rsiPeriod = 14,
  slopeThreshold = 0.5,
): boolean {
  if (closes.length < lookback + rsiPeriod + 1) return false;
  const rsiValues: number[] = [];
  for (let i = lookback - 1; i >= 0; i--) {
    const slice = closes.slice(0, closes.length - i);
    const v = rsi(slice, rsiPeriod);
    if (v == null) return false;
    rsiValues.push(v);
  }
  const n = rsiValues.length;
  const meanX = (n - 1) / 2;
  const meanY = rsiValues.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - meanX) * (rsiValues[i] - meanY);
    den += (i - meanX) ** 2;
  }
  const slope = den > 0 ? num / den : 0;
  return slope > slopeThreshold;
}

/**
 * Higher highs over a 2×halfWindow look-back. max(high) of the recent half
 * exceeds max(high) of the earlier half. Confirms upward price-structure.
 */
export function higherHighs(bars: AlpacaBar[], halfWindow = 10): boolean {
  if (bars.length < 2 * halfWindow) return false;
  const recent = bars.slice(-halfWindow);
  const earlier = bars.slice(-2 * halfWindow, -halfWindow);
  let recentMax = -Infinity;
  for (const b of recent) if (b.h > recentMax) recentMax = b.h;
  let earlierMax = -Infinity;
  for (const b of earlier) if (b.h > earlierMax) earlierMax = b.h;
  return recentMax > earlierMax;
}

/**
 * Higher lows: min(low) of recent half is above min(low) of earlier half.
 * Buyers absorbing pullbacks at progressively higher levels — the cleanest
 * "uptrend intact" signal in price action.
 */
export function higherLows(bars: AlpacaBar[], halfWindow = 10): boolean {
  if (bars.length < 2 * halfWindow) return false;
  const recent = bars.slice(-halfWindow);
  const earlier = bars.slice(-2 * halfWindow, -halfWindow);
  let recentMin = Infinity;
  for (const b of recent) if (b.l < recentMin) recentMin = b.l;
  let earlierMin = Infinity;
  for (const b of earlier) if (b.l < earlierMin) earlierMin = b.l;
  return recentMin > earlierMin;
}

/**
 * Rising channel = higher highs AND higher lows. The strongest single
 * "uptrend confirmed" signal available without full pivot-point fitting.
 * Used as the gate for trend-confirmed momentum entries (no dip required).
 */
export function risingChannel(bars: AlpacaBar[], halfWindow = 10): boolean {
  return higherHighs(bars, halfWindow) && higherLows(bars, halfWindow);
}

/**
 * Realized daily volatility — standard deviation of log returns over the
 * last N bars, annualized only if needed. Returns the *daily* sigma as a
 * decimal (e.g. 0.025 = 2.5 % daily). Used for volatility-targeted sizing.
 *
 * 20-bar window is the standard quant default — long enough to be stable,
 * short enough to react to regime shifts within ~1 month.
 */
export function realizedVolatility(closes: number[], period = 20): number | null {
  if (closes.length < period + 1) return null;
  const slice = closes.slice(-period - 1);
  const returns: number[] = [];
  for (let i = 1; i < slice.length; i++) {
    const prev = slice[i - 1];
    if (prev <= 0) return null;
    returns.push(Math.log(slice[i] / prev));
  }
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  let varSum = 0;
  for (const r of returns) varSum += (r - mean) ** 2;
  const variance = varSum / (returns.length - 1);
  return Math.sqrt(variance);
}

/** Wilder's ATR on bar OHLC. Returns null if not enough bars. */
export function atr(bars: AlpacaBar[], period = 14): number | null {
  if (bars.length < period + 1) return null;
  let trSum = 0;
  for (let i = 1; i <= period; i++) {
    const tr = Math.max(
      bars[i].h - bars[i].l,
      Math.abs(bars[i].h - bars[i - 1].c),
      Math.abs(bars[i].l - bars[i - 1].c),
    );
    trSum += tr;
  }
  let val = trSum / period;
  for (let i = period + 1; i < bars.length; i++) {
    const tr = Math.max(
      bars[i].h - bars[i].l,
      Math.abs(bars[i].h - bars[i - 1].c),
      Math.abs(bars[i].l - bars[i - 1].c),
    );
    val = (val * (period - 1) + tr) / period;
  }
  return val;
}

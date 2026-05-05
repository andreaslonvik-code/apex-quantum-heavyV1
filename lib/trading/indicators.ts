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

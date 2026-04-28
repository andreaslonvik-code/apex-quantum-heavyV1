// Apex Quantum v8 strategy primitives — ported from apex_quantum_v8.py.
// Pure functions over OHLCV bars. No I/O. Consumed by the autonomous route.

import { RISK, STRATEGY, V8_FILTERS } from './blueprint';
import type { AlpacaBar } from './alpaca';

// ────────────────────────────────────────────────────────────────────────────
// Indicators (Wilder-style simple-moving-average smoothing, matching the
// pandas .rolling().mean() semantics in the Python reference).
// ────────────────────────────────────────────────────────────────────────────

export function computeRSI(closes: number[], period = STRATEGY.RSI_PERIOD): number {
  if (closes.length < period + 1) return 50;
  let gain = 0;
  let loss = 0;
  // Initial average over the first `period` deltas.
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) gain += d;
    else loss -= d;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  // Wilder smoothing for the remainder.
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export function computeATR(bars: AlpacaBar[], period = STRATEGY.ATR_PERIOD): number {
  if (bars.length < period + 1) return 0;
  const trs: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const high = bars[i].h;
    const low = bars[i].l;
    const prevClose = bars[i - 1].c;
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    trs.push(tr);
  }
  const window = trs.slice(-period);
  return window.reduce((s, v) => s + v, 0) / window.length;
}

/** Lower Bollinger band on the last bar. */
export function computeBBLower(closes: number[], period = STRATEGY.BB_PERIOD, k = STRATEGY.BB_STDDEV): number {
  if (closes.length < period) return 0;
  const window = closes.slice(-period);
  const mean = window.reduce((s, v) => s + v, 0) / period;
  const variance = window.reduce((s, v) => s + (v - mean) ** 2, 0) / period;
  return mean - k * Math.sqrt(variance);
}

/** SMA over the last `period` closes. */
export function computeSMA(closes: number[], period: number): number {
  if (closes.length < period) return 0;
  const window = closes.slice(-period);
  return window.reduce((s, v) => s + v, 0) / period;
}

// ────────────────────────────────────────────────────────────────────────────
// Higher-level checks.
// ────────────────────────────────────────────────────────────────────────────

export function dailyTrendOk(dailyBars: AlpacaBar[]): { ok: boolean; ratio: number } {
  if (dailyBars.length < STRATEGY.DAILY_TREND_LOOKBACK) return { ok: false, ratio: 0 };
  const closes = dailyBars.map((b) => b.c);
  const sma = computeSMA(closes, STRATEGY.DAILY_TREND_LOOKBACK);
  const price = closes[closes.length - 1];
  if (sma <= 0) return { ok: false, ratio: 0 };
  const ratio = price / sma;
  return { ok: ratio >= STRATEGY.MIN_TREND_STRENGTH, ratio };
}

/** Overnight gap as percentage of previous close. */
export function gapPct(dailyBars: AlpacaBar[], todaysOpen: number): number {
  if (dailyBars.length < 1) return 0;
  const prevClose = dailyBars[dailyBars.length - 1].c;
  if (prevClose <= 0) return 0;
  return (todaysOpen / prevClose - 1) * 100;
}

/** Detect high-volatility market regime from SPY daily bars. */
export function detectMarketRegime(spyDaily: AlpacaBar[]): 'normal' | 'high_vol' {
  if (spyDaily.length < STRATEGY.ATR_PERIOD + 5) return 'normal';
  const atr = computeATR(spyDaily, STRATEGY.ATR_PERIOD);
  const price = spyDaily[spyDaily.length - 1].c;
  if (price <= 0) return 'normal';
  const atrPct = (atr / price) * 100;
  return atrPct > V8_FILTERS.HIGH_VOL_REGIME_PCT ? 'high_vol' : 'normal';
}

// ────────────────────────────────────────────────────────────────────────────
// Spread + position sizing.
// ────────────────────────────────────────────────────────────────────────────

export function spreadBps(bid: number, ask: number): number {
  if (bid <= 0 || ask <= 0) return Infinity;
  const mid = (bid + ask) / 2;
  return ((ask - bid) / mid) * 10_000;
}

/** v8 position sizing — risk-budget bounded by per-ticker cap and buying power. */
export function calcPositionSize(args: {
  equity: number;
  buyingPower: number;
  price: number;
  atr: number;
  currentPositionValue: number;
  regime: 'normal' | 'high_vol';
}): number {
  const { equity, buyingPower, price, atr, currentPositionValue, regime } = args;
  let dollarRisk = equity * RISK.RISK_PER_TRADE;
  if (regime === 'high_vol') dollarRisk *= V8_FILTERS.HIGH_VOL_SIZE_FACTOR;
  const perShareRisk = STRATEGY.ATR_STOP_MULT * atr;
  if (perShareRisk <= 0) return 0;
  const qtyByRisk = dollarRisk / perShareRisk;
  const valueByRisk = qtyByRisk * price;
  const capRoom = equity * RISK.MAX_SINGLE_POSITION - currentPositionValue;
  const finalValue = Math.min(valueByRisk, capRoom, buyingPower * 0.95);
  if (finalValue <= 1) return 0;
  return Math.floor(finalValue / price); // whole shares — Alpaca accepts fractional but we keep it conservative
}

// ────────────────────────────────────────────────────────────────────────────
// Entry signal.
// ────────────────────────────────────────────────────────────────────────────

export interface EntrySignal {
  price: number;
  atr: number;
  rsi: number;
  bbLower: number;
  volRatio: number;
  trendRatio: number;
  gap: number;
  stopPrice: number;
  targetPrice: number;
  score: number;
}

export function generateEntrySignal(intraday: AlpacaBar[], daily: AlpacaBar[]): EntrySignal | null {
  if (intraday.length < Math.max(STRATEGY.BB_PERIOD, STRATEGY.RSI_PERIOD, STRATEGY.ATR_PERIOD) + 5) return null;
  if (daily.length < STRATEGY.DAILY_TREND_LOOKBACK) return null;

  const trend = dailyTrendOk(daily);
  if (!trend.ok) return null;

  const todaysOpen = intraday[0].o;
  const gap = gapPct(daily, todaysOpen);
  if (Math.abs(gap) > V8_FILTERS.GAP_FILTER_PCT) return null;

  const closes = intraday.map((b) => b.c);
  const price = closes[closes.length - 1];
  const rsi = computeRSI(closes, STRATEGY.RSI_PERIOD);
  const bbLower = computeBBLower(closes, STRATEGY.BB_PERIOD, STRATEGY.BB_STDDEV);
  const atr = computeATR(intraday, STRATEGY.ATR_PERIOD);
  if (atr <= 0) return null;

  const volWindow = intraday.slice(-20);
  const avgVol = volWindow.reduce((s, b) => s + b.v, 0) / volWindow.length;
  const curVol = intraday[intraday.length - 1].v;
  const volRatio = avgVol > 0 ? curVol / avgVol : 0;

  const triggered =
    rsi < STRATEGY.RSI_OVERSOLD &&
    price < bbLower &&
    volRatio > STRATEGY.VOL_CAPITULATION_MULT;
  if (!triggered) return null;

  const stopPrice = +(price - STRATEGY.ATR_STOP_MULT * atr).toFixed(2);
  const targetPrice = +(price + STRATEGY.ATR_TARGET_MULT * atr).toFixed(2);
  const score = (STRATEGY.RSI_OVERSOLD - rsi) * trend.ratio;

  return { price, atr, rsi, bbLower, volRatio, trendRatio: trend.ratio, gap, stopPrice, targetPrice, score };
}

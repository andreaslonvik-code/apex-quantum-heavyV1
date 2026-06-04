/**
 * Exit-parameter backtest. Read-only; consumes .analysis-data/{orders,bars}.json.
 *
 * Ports the engine's exit logic (lib/trading/engine.ts) and indicators
 * (lib/trading/indicators.ts) exactly, then asks: for a given set of exit
 * params, when would each position have exited and at what P&L?
 *
 *  Test A — our ACTUAL positions (28 symbols entered May–Jun 2026), VWAP entry.
 *  Test B — regime-diverse: synthetic momentum entries across the full ~1y of
 *           daily bars, so stops are tested in BOTH up and down periods.
 *
 * Metrics per param set: total return, max drawdown, return/maxDD, win rate.
 */
import { readFileSync } from 'node:fs';

const orders = JSON.parse(readFileSync('.analysis-data/orders.json', 'utf8'));
const barsBySym = JSON.parse(readFileSync('.analysis-data/bars.json', 'utf8'));

// ── Indicators (ported verbatim from lib/trading/indicators.ts) ─────────
function rsi(closes, period = 14) {
  if (closes.length < period + 1) return null;
  let gain = 0, loss = 0;
  for (let i = 1; i <= period; i++) { const ch = closes[i] - closes[i - 1]; if (ch >= 0) gain += ch; else loss -= ch; }
  let avgGain = gain / period, avgLoss = loss / period;
  for (let i = period + 1; i < closes.length; i++) {
    const ch = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (ch > 0 ? ch : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (ch < 0 ? -ch : 0)) / period;
  }
  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}
function sma(closes, period) {
  if (closes.length < period) return null;
  let s = 0; for (let i = closes.length - period; i < closes.length; i++) s += closes[i];
  return s / period;
}
function atr(bars, period = 14) {
  if (bars.length < period + 1) return null;
  let trSum = 0;
  for (let i = 1; i <= period; i++) trSum += Math.max(bars[i].h - bars[i].l, Math.abs(bars[i].h - bars[i - 1].c), Math.abs(bars[i].l - bars[i - 1].c));
  let val = trSum / period;
  for (let i = period + 1; i < bars.length; i++) {
    const tr = Math.max(bars[i].h - bars[i].l, Math.abs(bars[i].h - bars[i - 1].c), Math.abs(bars[i].l - bars[i - 1].c));
    val = (val * (period - 1) + tr) / period;
  }
  return val;
}

const BASE = { atrStopMult: 1.5, profitTake: 1.0, fastDet: -5, trailKeep: 0.85 };

/**
 * Simulate the engine's mechanical exits on bars[entryIdx..] for a long entry.
 * entryIdx = bar index of entry day; entryPrice = actual fill price.
 * Returns { exitIdx, exitPrice, ret, reason, holdDays, open }.
 */
function simulateExit(bars, entryIdx, entryPrice, p) {
  let peakHigh = bars[entryIdx].h;
  for (let i = entryIdx + 1; i < bars.length; i++) {
    const b = bars[i];
    const slice = bars.slice(0, i + 1);
    const closes = slice.map((x) => x.c);
    const atrVal = atr(slice, 14);
    if (atrVal == null) continue;
    const sma50 = sma(closes, 50);
    const rsiNow = rsi(closes, 14);
    const close = b.c;
    const isLeader = rsiNow != null && rsiNow >= 55 && sma50 != null && close > sma50;
    const stopMult = isLeader ? p.atrStopMult * 0.8 : p.atrStopMult;
    const stopPrice = entryPrice - stopMult * atrVal;

    if (b.h > peakHigh) peakHigh = b.h;
    const peakPnl = (peakHigh - entryPrice) / entryPrice;
    const trailFloor = peakPnl >= 0.05 ? entryPrice * (1 + p.trailKeep * peakPnl) : null;
    const target = entryPrice * (1 + p.profitTake);
    const prevClose = bars[i - 1].c;
    const intradayPct = prevClose > 0 ? ((close - prevClose) / prevClose) * 100 : 0;
    const belowSma50 = sma50 != null && close < sma50;
    const pnlClose = (close - entryPrice) / entryPrice;
    const fastDet = intradayPct <= p.fastDet && belowSma50 && (pnlClose < 0 || peakPnl < 0.2);
    const hold = i - entryIdx;

    // Precedence matches engine: ATR stop > fast-det > profit-take > trailing.
    if (b.l <= stopPrice) {
      const px = b.o <= stopPrice ? b.o : stopPrice; // gap-down fills at open
      return { exitIdx: i, exitPrice: px, ret: (px - entryPrice) / entryPrice, reason: 'ATR_STOP', holdDays: hold, open: false };
    }
    if (fastDet) return { exitIdx: i, exitPrice: close, ret: pnlClose, reason: 'FAST_DET', holdDays: hold, open: false };
    if (b.h >= target) {
      const px = b.o >= target ? b.o : target;
      return { exitIdx: i, exitPrice: px, ret: (px - entryPrice) / entryPrice, reason: 'PROFIT_TAKE', holdDays: hold, open: false };
    }
    if (trailFloor != null && b.l <= trailFloor) {
      const px = b.o <= trailFloor ? b.o : trailFloor;
      return { exitIdx: i, exitPrice: px, ret: (px - entryPrice) / entryPrice, reason: 'TRAILING', holdDays: hold, open: false };
    }
  }
  const last = bars[bars.length - 1].c;
  return { exitIdx: bars.length - 1, exitPrice: last, ret: (last - entryPrice) / entryPrice, reason: 'OPEN_MTM', holdDays: bars.length - 1 - entryIdx, open: true };
}

function barIdxOnOrAfter(bars, isoDate) {
  for (let i = 0; i < bars.length; i++) if (bars[i].t.slice(0, 10) >= isoDate) return i;
  return -1;
}

// ── Reconstruct ACTUAL entries (VWAP buy, first-buy date) ───────────────
const fills = orders.filter((o) => o.filled_at && Number(o.filled_avg_price) > 0);
const posMap = {};
for (const o of fills) {
  if (o.side !== 'buy') continue;
  const q = Number(o.filled_qty) || Number(o.qty) || 0;
  const px = Number(o.filled_avg_price);
  if (!posMap[o.symbol]) posMap[o.symbol] = { qty: 0, cost: 0, firstBuy: o.filled_at };
  posMap[o.symbol].qty += q;
  posMap[o.symbol].cost += q * px;
  if (o.filled_at < posMap[o.symbol].firstBuy) posMap[o.symbol].firstBuy = o.filled_at;
}
const actualPositions = Object.entries(posMap).map(([sym, p]) => ({
  sym, qty: p.qty, vwap: p.cost / p.qty, notional: p.cost, entryDate: p.firstBuy.slice(0, 10),
})).filter((x) => barsBySym[x.sym]?.length > 60);

// ── Metrics helpers ─────────────────────────────────────────────────────
// Portfolio equity curve from per-position notionals over a shared timeline.
function portfolioMetrics(trades, bars0) {
  // Build a daily date axis from the union of all bars (use any symbol's dates).
  const dates = [...new Set(Object.values(barsBySym).flat().map((b) => b.t.slice(0, 10)))].sort();
  const dayVal = new Map(dates.map((d) => [d, 0]));
  let totalNotional = 0;
  for (const t of trades) {
    totalNotional += t.notional;
    const bars = barsBySym[t.sym];
    const startI = barIdxOnOrAfter(bars, t.entryDate);
    if (startI < 0) continue;
    const exitDate = bars[t.exit.exitIdx].t.slice(0, 10);
    for (const d of dates) {
      if (d < t.entryDate) continue;
      let v;
      if (d >= exitDate) { v = t.notional * (1 + t.exit.ret); } // realized, held as cash
      else {
        const bi = barIdxOnOrAfter(bars, d);
        const px = bi >= 0 ? bars[bi].c : t.vwap;
        v = t.qty * px;
      }
      dayVal.set(d, dayVal.get(d) + v);
    }
  }
  // Equity = sum of position values on days >= first entry. Compute max DD.
  const firstEntry = trades.reduce((m, t) => (t.entryDate < m ? t.entryDate : m), '9999');
  let peak = 0, maxDD = 0, finalEq = 0, startEq = 0;
  let started = false;
  for (const d of dates) {
    if (d < firstEntry) continue;
    const eq = dayVal.get(d);
    if (!started) { startEq = totalNotional; started = true; }
    if (eq > peak) peak = eq;
    if (peak > 0) maxDD = Math.max(maxDD, (peak - eq) / peak);
    finalEq = eq;
  }
  const totalRet = startEq > 0 ? (finalEq - startEq) / startEq : 0;
  return { totalRet, maxDD };
}

function summarize(trades) {
  const rets = trades.map((t) => t.exit.ret);
  const wins = rets.filter((r) => r > 0).length;
  const losers = rets.filter((r) => r < 0);
  const wavg = trades.reduce((s, t) => s + t.notional * t.exit.ret, 0) / trades.reduce((s, t) => s + t.notional, 0);
  const { totalRet, maxDD } = portfolioMetrics(trades);
  const reasons = {};
  for (const t of trades) reasons[t.exit.reason] = (reasons[t.exit.reason] || 0) + 1;
  return {
    n: trades.length, winRate: wins / trades.length,
    weightedRet: wavg, portRet: totalRet, maxDD,
    retOverDD: maxDD > 0.0001 ? totalRet / maxDD : Infinity,
    avgLoss: losers.length ? losers.reduce((a, b) => a + b, 0) / losers.length : 0,
    worst: Math.min(...rets), reasons,
  };
}

function runTestA(p) {
  const trades = actualPositions.map((pos) => {
    const bars = barsBySym[pos.sym];
    const ei = barIdxOnOrAfter(bars, pos.entryDate);
    return { ...pos, exit: simulateExit(bars, ei, pos.vwap, p) };
  });
  return summarize(trades);
}

// ── Test B: synthetic momentum entries across the full year ─────────────
function runTestB(p) {
  const trades = [];
  for (const [sym, bars] of Object.entries(barsBySym)) {
    if (bars.length < 210) continue;
    let i = 200; // warmup for SMA200
    while (i < bars.length - 1) {
      const slice = bars.slice(0, i + 1);
      const closes = slice.map((x) => x.c);
      const sma50 = sma(closes, 50), sma200 = sma(closes, 200), r = rsi(closes, 14);
      const close = bars[i].c;
      const trend = sma50 != null && sma200 != null && close > sma50 && sma50 > sma200;
      const momo = r != null && r >= 50 && r <= 70;
      if (trend && momo) {
        const entryIdx = i + 1; // enter next open
        const entryPrice = bars[entryIdx].o;
        const exit = simulateExit(bars, entryIdx, entryPrice, p);
        trades.push({ sym, qty: 1, vwap: entryPrice, notional: entryPrice, entryDate: bars[entryIdx].t.slice(0, 10), exit });
        i = exit.exitIdx + 1; // no overlapping trades per symbol
      } else i++;
    }
  }
  // Equal-weight per trade: report per-trade stats (portfolio MTM less meaningful here).
  const rets = trades.map((t) => t.exit.ret);
  const wins = rets.filter((r) => r > 0).length;
  const losers = rets.filter((r) => r < 0);
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const reasons = {};
  for (const t of trades) reasons[t.exit.reason] = (reasons[t.exit.reason] || 0) + 1;
  return {
    n: trades.length, winRate: wins / trades.length, meanRet: mean,
    avgLoss: losers.length ? losers.reduce((a, b) => a + b, 0) / losers.length : 0,
    worst: Math.min(...rets), reasons,
  };
}

// ── Parameter grid: baseline + one-at-a-time sweeps ─────────────────────
const SETS = [
  ['BASELINE (current)', BASE],
  ['ATR 1.2', { ...BASE, atrStopMult: 1.2 }],
  ['ATR 1.8', { ...BASE, atrStopMult: 1.8 }],
  ['ProfitTake +50%', { ...BASE, profitTake: 0.5 }],
  ['ProfitTake +75%', { ...BASE, profitTake: 0.75 }],
  ['FastDet -4%', { ...BASE, fastDet: -4 }],
  ['FastDet -6%', { ...BASE, fastDet: -6 }],
  ['TrailKeep 0.80', { ...BASE, trailKeep: 0.8 }],
  ['TrailKeep 0.90', { ...BASE, trailKeep: 0.9 }],
];

const pct = (x) => (x * 100).toFixed(1) + '%';
const num = (x) => (Number.isFinite(x) ? x.toFixed(2) : '∞');

console.log(`\n████ TEST A — våre faktiske posisjoner (${actualPositions.length} symboler, mai–jun 2026, oppgangsmåned) ████`);
console.log('Setting'.padEnd(20), 'WeightRet'.padStart(10), 'PortRet'.padStart(9), 'MaxDD'.padStart(8), 'Ret/DD'.padStart(8), 'WinRate'.padStart(8));
for (const [name, p] of SETS) {
  const s = runTestA(p);
  console.log(name.padEnd(20), pct(s.weightedRet).padStart(10), pct(s.portRet).padStart(9), pct(s.maxDD).padStart(8), num(s.retOverDD).padStart(8), pct(s.winRate).padStart(8));
}
{
  const s = runTestA(BASE);
  console.log('\n  Baseline exit-reasons:', JSON.stringify(s.reasons), ' worst trade:', pct(s.worst), ' avgLoss:', pct(s.avgLoss));
}

console.log(`\n████ TEST B — hele året, syntetiske momentum-innganger (opp OG ned regimer) ████`);
console.log('Setting'.padEnd(20), 'Trades'.padStart(7), 'MeanRet'.padStart(9), 'WinRate'.padStart(8), 'AvgLoss'.padStart(8), 'Worst'.padStart(8));
for (const [name, p] of SETS) {
  const s = runTestB(p);
  console.log(name.padEnd(20), String(s.n).padStart(7), pct(s.meanRet).padStart(9), pct(s.winRate).padStart(8), pct(s.avgLoss).padStart(8), pct(s.worst).padStart(8));
}
{
  const s = runTestB(BASE);
  console.log('\n  Baseline exit-reasons:', JSON.stringify(s.reasons));
}

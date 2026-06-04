/**
 * Tests the hypothesis: take profit at +17–30% and re-enter if it keeps
 * running, vs. the current "ride to +100%/trailing" approach.
 *
 * Read-only; consumes .analysis-data/bars.json. Full-year, regime-diverse
 * synthetic momentum entries (same engine as Test B). Models the FULL cycle:
 * take profit -> re-enter -> repeat, with transaction costs, so the
 * comparison to buy-and-hold is fair.
 */
import { readFileSync } from 'node:fs';
const barsBySym = JSON.parse(readFileSync('.analysis-data/bars.json', 'utf8'));

function rsi(c, p = 14) { if (c.length < p + 1) return null; let g = 0, l = 0; for (let i = 1; i <= p; i++) { const d = c[i] - c[i - 1]; if (d >= 0) g += d; else l -= d; } let ag = g / p, al = l / p; for (let i = p + 1; i < c.length; i++) { const d = c[i] - c[i - 1]; ag = (ag * (p - 1) + (d > 0 ? d : 0)) / p; al = (al * (p - 1) + (d < 0 ? -d : 0)) / p; } if (al === 0) return 100; return 100 - 100 / (1 + ag / al); }
function sma(c, p) { if (c.length < p) return null; let s = 0; for (let i = c.length - p; i < c.length; i++) s += c[i]; return s / p; }
function atr(b, p = 14) { if (b.length < p + 1) return null; let s = 0; for (let i = 1; i <= p; i++) s += Math.max(b[i].h - b[i].l, Math.abs(b[i].h - b[i - 1].c), Math.abs(b[i].l - b[i - 1].c)); let v = s / p; for (let i = p + 1; i < b.length; i++) { const tr = Math.max(b[i].h - b[i].l, Math.abs(b[i].h - b[i - 1].c), Math.abs(b[i].l - b[i - 1].c)); v = (v * (p - 1) + tr) / p; } return v; }

/**
 * Run one symbol over the full year. Returns { mult, legs, wins }.
 * params: { profitTake, reentry: 'none'|'continuation'|'pullback',
 *           atrStopMult, trailKeep, cost }
 */
function runSymbol(bars, p) {
  if (bars.length < 210) return null;
  let mult = 1, legs = 0, wins = 0;
  let state = 'flat'; // flat | long | rewatch
  let entryPrice = 0, peakHigh = 0, refPrice = 0;

  const indAt = (i) => {
    const slice = bars.slice(0, i + 1);
    const closes = slice.map((x) => x.c);
    return { atrVal: atr(slice, 14), sma50: sma(closes, 50), sma200: sma(closes, 200), r: rsi(closes, 14) };
  };

  for (let i = 200; i < bars.length - 1; i++) {
    const b = bars[i];
    const { atrVal, sma50, sma200, r } = indAt(i);
    if (atrVal == null) continue;
    const close = b.c;

    if (state === 'flat') {
      const trend = sma50 != null && sma200 != null && close > sma50 && sma50 > sma200;
      const momo = r != null && r >= 50 && r <= 70;
      if (trend && momo) {
        entryPrice = bars[i + 1].o; peakHigh = bars[i + 1].h; state = 'long';
        mult *= (1 - p.cost);
      }
      continue;
    }

    if (state === 'long') {
      if (b.h > peakHigh) peakHigh = b.h;
      const isLeader = r != null && r >= 55 && sma50 != null && close > sma50;
      const stopMult = isLeader ? p.atrStopMult * 0.8 : p.atrStopMult;
      const stopPrice = entryPrice - stopMult * atrVal;
      const peakPnl = (peakHigh - entryPrice) / entryPrice;
      const trailFloor = peakPnl >= 0.05 ? entryPrice * (1 + p.trailKeep * peakPnl) : null;
      const target = entryPrice * (1 + p.profitTake);

      let exitPx = null, took = false;
      if (b.l <= stopPrice) exitPx = b.o <= stopPrice ? b.o : stopPrice;          // ATR stop
      else if (b.h >= target) { exitPx = b.o >= target ? b.o : target; took = true; } // profit-take
      else if (trailFloor != null && b.l <= trailFloor) exitPx = b.o <= trailFloor ? b.o : trailFloor; // trailing

      if (exitPx != null) {
        const legRet = exitPx / entryPrice;
        mult *= legRet * (1 - p.cost);
        legs++; if (legRet > 1) wins++;
        if (took && p.reentry !== 'none') { state = 'rewatch'; refPrice = exitPx; }
        else state = 'flat';
      }
      continue;
    }

    if (state === 'rewatch') {
      // Abandon re-entry if trend breaks.
      if (sma50 != null && close < sma50) { state = 'flat'; continue; }
      if (p.reentry === 'continuation') {
        if (b.h > refPrice) { // kept rising -> buy back at the breakout level
          entryPrice = Math.max(b.o, refPrice); peakHigh = b.h; state = 'long'; mult *= (1 - p.cost);
        }
      } else if (p.reentry === 'pullback') {
        if (b.l <= refPrice * 0.97 && close > bars[i - 1].c) { // dipped >=3% then turned up
          entryPrice = close; peakHigh = b.h; state = 'long'; mult *= (1 - p.cost);
        }
      }
      continue;
    }
  }
  // Mark open leg to last close.
  if (state === 'long') { mult *= (bars[bars.length - 1].c / entryPrice) * (1 - p.cost); legs++; if (bars[bars.length - 1].c > entryPrice) wins++; }
  return { mult, legs, wins };
}

function run(label, p) {
  let prod = 1, n = 0, totLegs = 0, totWins = 0;
  const rets = [];
  for (const [sym, bars] of Object.entries(barsBySym)) {
    const r = runSymbol(bars, p);
    if (!r) continue;
    prod *= r.mult; n++; totLegs += r.legs; totWins += r.wins; rets.push(r.mult - 1);
  }
  const geoMean = Math.pow(prod, 1 / n) - 1; // avg per-symbol compounded return
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  return { label, geoMean, mean, avgLegs: totLegs / n, winRate: totWins / totLegs };
}

const BASE = { atrStopMult: 1.5, trailKeep: 0.85 };
const COSTS = [0.003, 0.0]; // 0.3% per trade, and zero (cost-free, optimistic)

for (const cost of COSTS) {
  console.log(`\n████ Transaksjonskostnad ${(cost * 100).toFixed(1)}% per handel ████`);
  console.log('Variant'.padEnd(34), 'AvkSnitt/aksje'.padStart(14), 'GeoMean'.padStart(9), 'Handler/aksje'.padStart(13), 'Treffrate'.padStart(10));
  const variants = [
    ['NÅVÆRENDE (PT100% + trailing)', { ...BASE, profitTake: 1.0, reentry: 'none', cost }],
    ['PT 17% + fortsettelse-gjenkjøp', { ...BASE, profitTake: 0.17, reentry: 'continuation', cost }],
    ['PT 20% + fortsettelse-gjenkjøp', { ...BASE, profitTake: 0.20, reentry: 'continuation', cost }],
    ['PT 25% + fortsettelse-gjenkjøp', { ...BASE, profitTake: 0.25, reentry: 'continuation', cost }],
    ['PT 30% + fortsettelse-gjenkjøp', { ...BASE, profitTake: 0.30, reentry: 'continuation', cost }],
    ['PT 20% + tilbakefall-gjenkjøp', { ...BASE, profitTake: 0.20, reentry: 'pullback', cost }],
    ['PT 25% + tilbakefall-gjenkjøp', { ...BASE, profitTake: 0.25, reentry: 'pullback', cost }],
    ['PT 20% UTEN gjenkjøp', { ...BASE, profitTake: 0.20, reentry: 'none', cost }],
  ];
  for (const [label, p] of variants) {
    const s = run(label, p);
    console.log(label.padEnd(34), ((s.mean * 100).toFixed(1) + '%').padStart(14), ((s.geoMean * 100).toFixed(1) + '%').padStart(9), s.avgLegs.toFixed(1).padStart(13), ((s.winRate * 100).toFixed(0) + '%').padStart(10));
  }
}

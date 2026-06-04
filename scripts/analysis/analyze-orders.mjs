/**
 * Local read-only analysis of .analysis-data/orders.json.
 * Answers: order-status breakdown, rejection reasons, slippage on fills,
 * current positions and when they were opened, and recent trading cadence.
 */
import { readFileSync } from 'node:fs';

const orders = JSON.parse(readFileSync('.analysis-data/orders.json', 'utf8'));
const D = (s) => (s ? new Date(s) : null);
const day = (s) => (s ? s.slice(0, 10) : null);

// ── 1. Status breakdown ───────────────────────────────────────────────
const byStatus = {};
for (const o of orders) byStatus[o.status] = (byStatus[o.status] || 0) + 1;

// ── 2. Order type / side breakdown ────────────────────────────────────
const byType = {};
for (const o of orders) {
  const k = `${o.order_type || o.type}/${o.side}`;
  byType[k] = (byType[k] || 0) + 1;
}

// ── 3. Rejections ─────────────────────────────────────────────────────
const rejected = orders.filter((o) => o.status === 'rejected');
const rejReasons = {};
for (const o of rejected) {
  const r = (o.reject_reason || o.failure_reason || 'unknown').slice(0, 60);
  rejReasons[r] = (rejReasons[r] || 0) + 1;
}

// ── 4. Fills + slippage ───────────────────────────────────────────────
const fills = orders.filter((o) => o.filled_at && Number(o.filled_avg_price) > 0);
let slipBuy = [], slipSell = [], latencies = [];
for (const o of fills) {
  const fp = Number(o.filled_avg_price);
  const lp = Number(o.limit_price) || 0;
  if (lp > 0) {
    // For a BUY, paying above limit = negative slippage; SELL below limit = negative.
    const slipPct = o.side === 'buy' ? ((fp - lp) / lp) * 100 : ((lp - fp) / lp) * 100;
    (o.side === 'buy' ? slipBuy : slipSell).push(slipPct);
  }
  const sub = D(o.submitted_at), fil = D(o.filled_at);
  if (sub && fil) latencies.push((fil - sub) / 1000);
}
const stat = (arr) => {
  if (!arr.length) return { n: 0 };
  const s = [...arr].sort((a, b) => a - b);
  const sum = s.reduce((a, b) => a + b, 0);
  return {
    n: s.length, mean: +(sum / s.length).toFixed(4),
    median: +s[Math.floor(s.length / 2)].toFixed(4),
    p10: +s[Math.floor(s.length * 0.1)].toFixed(4),
    p90: +s[Math.floor(s.length * 0.9)].toFixed(4),
    min: +s[0].toFixed(4), max: +s[s.length - 1].toFixed(4),
  };
};

// ── 5. Filled trades per day (real trading cadence) ───────────────────
const fillsByDay = {};
for (const o of fills) { const d = day(o.filled_at); fillsByDay[d] = (fillsByDay[d] || 0) + 1; }
const fillDays = Object.keys(fillsByDay).sort();

// ── 6. Net position reconstruction (current holdings + open dates) ────
// Sum signed filled qty per symbol; first BUY fill = approximate open date.
const pos = {};
for (const o of fills) {
  const q = Number(o.filled_qty) || Number(o.qty) || 0;
  const signed = o.side === 'buy' ? q : -q;
  if (!pos[o.symbol]) pos[o.symbol] = { net: 0, firstBuy: null, lastFill: null, buys: 0, sells: 0 };
  pos[o.symbol].net += signed;
  if (o.side === 'buy') { pos[o.symbol].buys++; if (!pos[o.symbol].firstBuy || o.filled_at < pos[o.symbol].firstBuy) pos[o.symbol].firstBuy = o.filled_at; }
  else pos[o.symbol].sells++;
  if (!pos[o.symbol].lastFill || o.filled_at > pos[o.symbol].lastFill) pos[o.symbol].lastFill = o.filled_at;
}
const held = Object.entries(pos).filter(([, p]) => p.net > 1e-6)
  .sort((a, b) => (a[1].firstBuy || '').localeCompare(b[1].firstBuy || ''));

// ── Output ────────────────────────────────────────────────────────────
console.log('═══ STATUS BREAKDOWN (15316 total) ═══');
for (const [k, v] of Object.entries(byStatus).sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(18)} ${v}`);

console.log('\n═══ ORDER TYPE / SIDE ═══');
for (const [k, v] of Object.entries(byType).sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(22)} ${v}`);

console.log('\n═══ REJECTION REASONS ═══', rejected.length, 'rejected');
for (const [k, v] of Object.entries(rejReasons).sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log(`  ${String(v).padStart(5)}  ${k}`);

console.log('\n═══ SLIPPAGE vs limit_price (%) ═══');
console.log('  BUY :', JSON.stringify(stat(slipBuy)));
console.log('  SELL:', JSON.stringify(stat(slipSell)));
console.log('  (negative mean = worse than limit; positive = price improvement)');

console.log('\n═══ FILL LATENCY (submit→fill, seconds) ═══');
console.log(' ', JSON.stringify(stat(latencies)));

console.log('\n═══ FILLED TRADES PER DAY ═══', fillDays.length, 'distinct days');
console.log('  first fill day:', fillDays[0], ' last fill day:', fillDays[fillDays.length - 1]);
console.log('  last 14 active days:');
for (const d of fillDays.slice(-14)) console.log(`    ${d}: ${fillsByDay[d]} fills`);

console.log('\n═══ CURRENT NET HOLDINGS (reconstructed) ═══', held.length, 'symbols net-long');
for (const [sym, p] of held) {
  console.log(`  ${sym.padEnd(6)} net=${p.net.toFixed(4).padStart(14)}  opened≈${day(p.firstBuy)}  lastFill=${day(p.lastFill)}  buys=${p.buys} sells=${p.sells}`);
}

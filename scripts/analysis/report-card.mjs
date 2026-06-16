/**
 * "Karakterkort" — local, read-only report card of REALIZED trading results.
 *
 * Reads .analysis-data/orders.json + bars.json (produced by
 * pull-alpaca-history.mjs) and reconstructs round-trips by FIFO-matching BUY
 * fills to SELL fills per symbol, then reports the realized outcome of each
 * closed trade: return %, holding period, win/loss, dollar P&L. Aggregates by
 * holding-period bucket, by symbol, and by entry month, plus the unrealized
 * mark on still-open positions.
 *
 * This is the measurement foundation for any later "self-learning": it turns
 * "what did the bot decide" into "what did those decisions actually earn".
 * It changes NOTHING and touches no live system — pure local analysis.
 *
 * Run:
 *   1) node --env-file=.env.local scripts/analysis/pull-alpaca-history.mjs   (paper account)
 *   2) node scripts/analysis/report-card.mjs
 *
 * CAVEATS (read before trusting the numbers):
 *   - Paper-account data only.
 *   - Max launched ~40 days ago, so the sample is small → results are
 *     DIRECTIONAL, not statistically robust. Treat as a first look.
 *   - Alpaca orders do NOT carry the engine's internal entry-path/reason, so
 *     this groups by symbol/holding-period/month, not by PATH A-H. Attributing
 *     outcomes to entry paths needs grok_decisions (a follow-up puller).
 */
import { readFileSync } from 'node:fs';

const DIR = '.analysis-data';
function load(name) {
  try {
    return JSON.parse(readFileSync(`${DIR}/${name}`, 'utf8'));
  } catch {
    console.error(`✗ Missing ${DIR}/${name} — run pull-alpaca-history.mjs first.`);
    process.exit(1);
  }
}

const orders = load('orders.json');
const barsBySymbol = load('bars.json');

const day = (s) => (s ? s.slice(0, 10) : null);
const month = (s) => (s ? s.slice(0, 7) : null);

// Flatten nested legs (puller uses nested:true) so bracket/OTO child fills count.
const flat = [];
for (const o of orders) {
  flat.push(o);
  if (Array.isArray(o.legs)) for (const leg of o.legs) flat.push(leg);
}

// Keep actual fills only, oldest first.
const fills = flat
  .filter((o) => o.filled_at && Number(o.filled_avg_price) > 0 && (Number(o.filled_qty) || 0) > 0)
  .sort((a, b) => a.filled_at.localeCompare(b.filled_at));

// ── FIFO round-trip reconstruction per symbol ─────────────────────────
// Open BUY lots queue per symbol; each SELL consumes oldest lots first,
// emitting a closed round-trip with realized return.
const openLots = new Map(); // symbol -> [{ qty, price, date }]
const trades = []; // closed round-trips

for (const o of fills) {
  const sym = o.symbol;
  const qty = Number(o.filled_qty);
  const price = Number(o.filled_avg_price);
  if (!openLots.has(sym)) openLots.set(sym, []);
  const lots = openLots.get(sym);

  if (o.side === 'buy') {
    lots.push({ qty, price, date: o.filled_at });
    continue;
  }
  // SELL: consume oldest buy lots
  let remaining = qty;
  while (remaining > 1e-9 && lots.length > 0) {
    const lot = lots[0];
    const matched = Math.min(remaining, lot.qty);
    const retPct = ((price - lot.price) / lot.price) * 100;
    const holdDays = (new Date(o.filled_at) - new Date(lot.date)) / 86_400_000;
    trades.push({
      symbol: sym,
      entryDate: lot.date,
      exitDate: o.filled_at,
      qty: matched,
      entryPrice: lot.price,
      exitPrice: price,
      retPct,
      pnl: matched * (price - lot.price),
      holdDays,
    });
    lot.qty -= matched;
    remaining -= matched;
    if (lot.qty <= 1e-9) lots.shift();
  }
  // remaining > 0 here = sell with no matching buy in window (pre-history
  // position); ignore — we can't compute its entry.
}

// ── Stats helpers ─────────────────────────────────────────────────────
const sum = (a) => a.reduce((x, y) => x + y, 0);
const pct = (n, d) => (d ? ((n / d) * 100).toFixed(1) : '0.0');
function summary(rets) {
  if (!rets.length) return { n: 0 };
  const s = [...rets].sort((a, b) => a - b);
  const wins = s.filter((r) => r > 0);
  const losses = s.filter((r) => r <= 0);
  return {
    n: s.length,
    winRate: +pct(wins.length, s.length),
    avgRet: +(sum(s) / s.length).toFixed(2),
    median: +s[Math.floor(s.length / 2)].toFixed(2),
    avgWin: wins.length ? +(sum(wins) / wins.length).toFixed(2) : 0,
    avgLoss: losses.length ? +(sum(losses) / losses.length).toFixed(2) : 0,
    best: +s[s.length - 1].toFixed(2),
    worst: +s[0].toFixed(2),
  };
}

// ── Output ────────────────────────────────────────────────────────────
console.log('═══ KARAKTERKORT — realiserte handler (paper) ═══');
console.log(`  ${fills.length} fills → ${trades.length} closed round-trips`);
if (!trades.length) {
  console.log('  (ingen lukkede handler ennå — kom tilbake når posisjoner er solgt)');
  process.exit(0);
}

const allRets = trades.map((t) => t.retPct);
const totalPnl = sum(trades.map((t) => t.pnl));
const o = summary(allRets);
console.log('\n═══ TOTALT ═══');
console.log(`  handler: ${o.n}   treffrate: ${o.winRate}%   snitt-avkastning/handel: ${o.avgRet}%`);
console.log(`  snitt-vinner: +${o.avgWin}%   snitt-taper: ${o.avgLoss}%   median: ${o.median}%`);
console.log(`  beste: +${o.best}%   verste: ${o.worst}%   realisert P&L: $${totalPnl.toFixed(0)}`);
const expectancy = o.avgRet;
console.log(`  forventning per handel (expectancy): ${expectancy}% ${expectancy > 0 ? '✓ positiv' : '✗ negativ'}`);

// By holding-period bucket
const buckets = [
  ['< 3 dager', (d) => d < 3],
  ['3–10 dager', (d) => d >= 3 && d < 10],
  ['10–30 dager', (d) => d >= 10 && d < 30],
  ['> 30 dager', (d) => d >= 30],
];
console.log('\n═══ ETTER HOLDETID ═══');
for (const [label, test] of buckets) {
  const r = summary(trades.filter((t) => test(t.holdDays)).map((t) => t.retPct));
  if (r.n) console.log(`  ${label.padEnd(13)} n=${String(r.n).padStart(3)}  treff=${String(r.winRate).padStart(5)}%  snitt=${String(r.avgRet).padStart(6)}%`);
}

// By symbol (most-traded / best / worst)
const bySym = new Map();
for (const t of trades) {
  if (!bySym.has(t.symbol)) bySym.set(t.symbol, []);
  bySym.get(t.symbol).push(t.retPct);
}
const symRows = [...bySym.entries()]
  .map(([sym, rets]) => ({ sym, ...summary(rets), pnl: sum(trades.filter((t) => t.symbol === sym).map((t) => t.pnl)) }))
  .sort((a, b) => b.pnl - a.pnl);
console.log('\n═══ ETTER TICKER (sortert på realisert $) ═══');
for (const r of symRows) {
  console.log(`  ${r.sym.padEnd(6)} n=${String(r.n).padStart(3)}  treff=${String(r.winRate).padStart(5)}%  snitt=${String(r.avgRet).padStart(7)}%  P&L=$${r.pnl.toFixed(0)}`);
}

// By entry month
const byMonth = new Map();
for (const t of trades) {
  const m = month(t.entryDate);
  if (!byMonth.has(m)) byMonth.set(m, []);
  byMonth.get(m).push(t.retPct);
}
console.log('\n═══ ETTER INNGANGS-MÅNED ═══');
for (const m of [...byMonth.keys()].sort()) {
  const r = summary(byMonth.get(m));
  console.log(`  ${m}  n=${String(r.n).padStart(3)}  treff=${String(r.winRate).padStart(5)}%  snitt=${String(r.avgRet).padStart(7)}%`);
}

// Open positions: unrealized mark vs last bar close
console.log('\n═══ ÅPNE POSISJONER (urealisert mot siste close) ═══');
let anyOpen = false;
for (const [sym, lots] of openLots) {
  const openQty = sum(lots.map((l) => l.qty));
  if (openQty <= 1e-6) continue;
  anyOpen = true;
  const bars = barsBySymbol[sym];
  const lastClose = bars?.length ? bars[bars.length - 1].c : null;
  const costBasis = sum(lots.map((l) => l.qty * l.price)) / openQty;
  const unreal = lastClose ? ((lastClose - costBasis) / costBasis) * 100 : null;
  const opened = day(lots[0]?.date);
  console.log(
    `  ${sym.padEnd(6)} qty=${openQty.toFixed(3).padStart(10)}  snittkost=$${costBasis.toFixed(2)}` +
      (unreal != null ? `  urealisert=${unreal.toFixed(1)}%  (close $${lastClose})` : '  (ingen bar-data)') +
      `  åpnet≈${opened}`,
  );
}
if (!anyOpen) console.log('  (ingen åpne posisjoner)');

console.log('\n— Merk: paper-data, ~40 dagers utvalg → retningsgivende, ikke fasit.');
console.log('— Inngangs-PATH (A–H) krever grok_decisions; ber om det som neste steg hvis ønskelig.');

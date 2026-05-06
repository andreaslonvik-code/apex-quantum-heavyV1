import {
  type AlpacaAccount,
  type AlpacaBar,
  type AlpacaClock,
  type AlpacaCreds,
  type AlpacaOrder,
  type AlpacaPosition,
  cancelOrder as alpacaCancelOrder,
  getAccount,
  getClock,
  getCryptoBars,
  getLatestCryptoPrice,
  getLatestPrice,
  getOrders,
  getPositions,
  getStockBars,
  placeOrder,
} from '@/lib/alpaca';
import { BLUEPRINT_LIST, type AssetClass, type Blueprint } from '@/lib/blueprints';
import { decide, type GrokDecision, type GrokDecisionPayload } from '@/lib/grok';
import { getLatestDecision, saveDecision } from '@/lib/grok-decisions';
import { getUserAllocation } from '@/lib/user-allocation';
import { atr, bullishDivergence, macd, rsi, sma, volumeAccumulation } from './indicators';

/**
 * Apex Quantum trading engine — Grok-driven.
 *
 * Cadence:
 *   - Cron tick fires every minute.
 *   - Grok is called at most once every GROK_CADENCE_MS (default 15 min) per
 *     user per blueprint. Between calls only mechanical safety runs.
 *   - Mechanical safety = ATR-stop + profit-take checks on held positions.
 *     These are bounded protection in case price moves between Grok calls.
 *
 * Decision execution:
 *   - Grok returns `{ thesis, decisions: [{ ticker, action, notional_usd, reason }] }`.
 *   - BUY → notional market order on Alpaca, position_intent: buy_to_open.
 *   - SELL → close full Alpaca position for that ticker.
 *   - HOLD → no order.
 */

export type TradeAction = 'BUY' | 'SELL';
export type TradeStatus = 'OK' | 'ERR' | 'SKIP';

export interface TradeResult {
  blueprintId: AssetClass;
  ticker: string;
  action: TradeAction;
  qty: number;
  notional: number;
  status: TradeStatus;
  reason: string;
  error?: string;
}

export interface BlueprintRunResult {
  blueprintId: AssetClass;
  bucketCapital: number;
  positionsHeld: number;
  trades: TradeResult[];
  killSwitchTriggered: boolean;
  grokCalled: boolean;
  thesis?: string;
  reason?: string;
}

export interface UserScanResult {
  clerkUserId: string;
  ranAt: string;
  equity: number;
  buyingPower: number;
  blueprints: BlueprintRunResult[];
  error?: string;
}

// 10 min cadence: enough for daily-bar strategy where indicators barely move
// intraday. Mechanical safety (ATR-stop, profit-take) still runs every minute
// independent of Grok, so risk management is unaffected. Going from 2 min to
// 10 min reduces Grok API spend ~5× ($50/day → $10/day).
const GROK_CADENCE_MS = 10 * 60 * 1000;
const INDICATOR_BAR_COUNT = 60; // bars to fetch for indicator summary
const MIN_NOTIONAL_USD = 1.0;

/**
 * Hard-disabled blueprints. These buckets will be ignored by the engine —
 * existing positions will be liquidated on the next tick (bucket capital
 * forced to 0 → deallocation logic fires) and no new orders placed.
 *
 * Currently disabled because the crypto + commodities trading was producing
 * stop-loss-driven losses in choppy markets. Re-enable by removing entries
 * here once we've validated each blueprint with backtests.
 */
const DISABLED_BLUEPRINTS: ReadonlySet<AssetClass> = new Set(['crypto', 'commodities']);
// With PDT/DTBP entry-checks relaxed (pdt_check + dtbp_check = "exit"),
// Alpaca accepts much larger fractional/notional orders. The chat-mirror
// procedure wants 35–40 % of bucket on the #1 pick; on a $94 k account
// that is ≈ $33 k, so the cap needs to clear that. $25 k stays under
// observed Alpaca paper hard limits while letting the chat procedure
// allocate weighted positions.
const MAX_PER_ORDER_NOTIONAL = 25_000;

function tradingSymbol(symbol: string): string {
  return symbol.replace('/', '');
}

/**
 * Build a stock/ETF order that works in BOTH regular hours and pre-/after-
 * market. Alpaca rules:
 *   - Regular hours (09:30–16:00 ET): market orders + notional fractional ok.
 *   - Extended hours (04:00–09:30 ET pre, 16:00–20:00 ET after): ONLY
 *     limit + day + extended_hours: true + WHOLE shares. Market orders and
 *     notional/fractional are rejected.
 *
 * `currentPrice` required so we can size whole-share qty + a tight limit
 * price when we drop into extended-hours mode.
 */
function buildStockOrder(args: {
  symbol: string;
  side: 'buy' | 'sell';
  qty?: number;
  notional?: number;
  currentPrice: number;
  marketIsOpen: boolean;
}): import('@/lib/alpaca').AlpacaOrderRequest | null {
  const { symbol, side, qty, notional, currentPrice, marketIsOpen } = args;
  const positionIntent = side === 'buy' ? 'buy_to_open' : 'sell_to_close';

  if (marketIsOpen) {
    if (notional !== undefined && notional > 0) {
      return {
        symbol,
        notional,
        side,
        type: 'market',
        time_in_force: 'day',
        position_intent: positionIntent,
      };
    }
    if (qty !== undefined && qty > 0) {
      return {
        symbol,
        qty,
        side,
        type: 'market',
        time_in_force: 'day',
        position_intent: positionIntent,
      };
    }
    return null;
  }

  // Extended hours: limit + whole shares + extended_hours flag.
  if (currentPrice <= 0) return null;
  const limitPrice =
    side === 'buy'
      ? Math.round(currentPrice * 1.005 * 100) / 100
      : Math.round(currentPrice * 0.995 * 100) / 100;
  let wholeQty = 0;
  if (qty !== undefined && qty > 0) {
    wholeQty = Math.floor(qty);
  } else if (notional !== undefined && notional > 0) {
    wholeQty = Math.floor(notional / currentPrice);
  }
  if (wholeQty <= 0) return null;
  return {
    symbol,
    qty: wholeQty,
    side,
    type: 'limit',
    limit_price: limitPrice,
    time_in_force: 'day',
    extended_hours: true,
    position_intent: positionIntent,
  };
}

function normalizePositionSymbol(symbol: string): string {
  if (symbol.includes('/')) return symbol;
  if (/^[A-Z]+USD$/.test(symbol) && symbol.length >= 6) {
    return `${symbol.slice(0, -3)}/USD`;
  }
  return symbol;
}

async function fetchBars(
  creds: AlpacaCreds,
  blueprint: Blueprint,
  ticker: string,
) {
  if (blueprint.id === 'crypto') {
    return getCryptoBars(creds, ticker, {
      timeframe: blueprint.params.timeframe,
      limit: INDICATOR_BAR_COUNT,
    });
  }
  return getStockBars(creds, ticker, {
    timeframe: blueprint.params.timeframe,
    limit: INDICATOR_BAR_COUNT,
  });
}

async function fetchLatest(
  creds: AlpacaCreds,
  blueprint: Blueprint,
  ticker: string,
  fallback: number,
): Promise<number> {
  if (blueprint.id === 'crypto') {
    const r = await getLatestCryptoPrice(creds, ticker);
    if (r.success) return r.data;
  } else {
    const r = await getLatestPrice(creds, ticker);
    if (r.success) return r.data;
  }
  return fallback;
}

interface IndicatorSnapshot {
  ticker: string;
  price: number;
  change_24h_pct: number | null;
  change_5d_pct: number | null;
  rsi_14: number | null;
  sma_50: number | null;
  sma_200: number | null;
  macd_hist: number | null;
  atr_14: number | null;
  /** Bullish RSI divergence vs ~8 bars ago — early reversal signal. */
  bullish_divergence: boolean;
  /** Recent 3-bar volume vs prior 20-bar baseline (smart-money accumulation). */
  volume_accumulation: boolean;
}

async function buildIndicatorSnapshots(
  creds: AlpacaCreds,
  blueprint: Blueprint,
): Promise<IndicatorSnapshot[]> {
  const snaps: IndicatorSnapshot[] = [];
  for (const ticker of blueprint.watchlist) {
    try {
      const r = await fetchBars(creds, blueprint, ticker);
      if (!r.success || r.data.length < 5) continue;
      const bars: AlpacaBar[] = r.data;
      const closes = bars.map((b) => b.c);
      const last = closes[closes.length - 1];
      const live = await fetchLatest(creds, blueprint, ticker, last);
      const p = live || last;
      const ago1 = closes[closes.length - 2] ?? p;
      const ago5 = closes[Math.max(0, closes.length - 6)] ?? p;
      const rsiVal = rsi(closes, 14);
      snaps.push({
        ticker,
        price: round(p, 6),
        change_24h_pct: ago1 ? round(((p - ago1) / ago1) * 100, 2) : null,
        change_5d_pct: ago5 ? round(((p - ago5) / ago5) * 100, 2) : null,
        rsi_14: nullableRound(rsiVal, 1),
        sma_50: nullableRound(sma(closes, 50), 4),
        sma_200: nullableRound(sma(closes, 200), 4),
        macd_hist: nullableRound(macd(closes)?.hist ?? null, 4),
        atr_14: nullableRound(atr(bars, blueprint.params.atrPeriod), 4),
        bullish_divergence: bullishDivergence(closes, rsiVal),
        volume_accumulation: volumeAccumulation(bars),
      });
    } catch {
      // skip ticker on fetch error
    }
  }
  return snaps;
}

function round(n: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

function nullableRound(n: number | null, decimals: number): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  return round(n, decimals);
}

/**
 * Anticipatory signal filter — only let through BUYs where statistics
 * favor a bounce/breakout rather than a momentum continuation.
 *
 * HARD requirements (both must hold):
 *   1. Price > SMA200 — uptrend confirmed (don't catch falling knives in
 *      established downtrends).
 *   2. RSI < 40 OR price within 3 % of SMA50 — at or near a pullback level
 *      (i.e. a real dip, not a momentum top).
 *
 * CONFIRMATION (at least one must hold):
 *   - Bullish RSI divergence (selling pressure exhausting)
 *   - Volume accumulation (smart-money buying quietly)
 *
 * Without confirmation, oversold can stay oversold for weeks. The
 * confirmation tilts the probabilities toward a near-term bounce.
 */
interface AnticipatorySignal {
  ok: boolean;
  reasons: string[];
}

function isAnticipatorySignal(snap: IndicatorSnapshot): AnticipatorySignal {
  const reasons: string[] = [];

  if (snap.sma_200 == null || snap.price < snap.sma_200) {
    return { ok: false, reasons: ['not_in_uptrend (price < SMA200)'] };
  }

  const isOversold = snap.rsi_14 != null && snap.rsi_14 < 40;
  const nearSupport =
    snap.sma_50 != null && snap.sma_50 > 0 && snap.price / snap.sma_50 < 1.03;
  if (!isOversold && !nearSupport) {
    return {
      ok: false,
      reasons: [
        `not_at_dip_level (RSI ${snap.rsi_14 ?? '?'}, price/SMA50 ${
          snap.sma_50 ? (snap.price / snap.sma_50).toFixed(3) : '?'
        })`,
      ],
    };
  }
  if (isOversold) reasons.push(`oversold_rsi_${snap.rsi_14?.toFixed(1)}`);
  if (nearSupport) reasons.push('near_sma50_support');

  if (!snap.bullish_divergence && !snap.volume_accumulation) {
    return {
      ok: false,
      reasons: ['no_bullish_confirmation', ...reasons],
    };
  }
  if (snap.bullish_divergence) reasons.push('bullish_rsi_divergence');
  if (snap.volume_accumulation) reasons.push('volume_accumulation');

  return { ok: true, reasons };
}

interface PositionSummary {
  ticker: string;
  qty: number;
  avg_entry: number;
  current_price: number;
  market_value: number;
  unrealized_pnl: number;
  unrealized_pnl_pct: number;
}

function summarizePositions(
  positions: AlpacaPosition[],
  watchlist: ReadonlySet<string>,
): PositionSummary[] {
  const out: PositionSummary[] = [];
  for (const p of positions) {
    const norm = normalizePositionSymbol(p.symbol);
    if (!watchlist.has(norm)) continue;
    out.push(positionToSummary(p, norm));
  }
  return out;
}

function summarizeAllPositions(positions: AlpacaPosition[]): PositionSummary[] {
  return positions.map((p) => positionToSummary(p, normalizePositionSymbol(p.symbol)));
}

function positionToSummary(p: AlpacaPosition, ticker: string): PositionSummary {
  return {
    ticker,
    qty: parseFloat(p.qty) || 0,
    avg_entry: parseFloat(p.avg_entry_price) || 0,
    current_price: parseFloat(p.current_price) || 0,
    market_value: parseFloat(p.market_value) || 0,
    unrealized_pnl: parseFloat(p.unrealized_pl) || 0,
    unrealized_pnl_pct: round((parseFloat(p.unrealized_plpc) || 0) * 100, 2),
  };
}

function accountToSnapshot(acct: AlpacaAccount, env: 'paper' | 'live'): AccountSnapshot {
  return {
    environment: env,
    status: acct.status,
    currency: acct.currency,
    cash: parseFloat(acct.cash) || 0,
    equity: parseFloat(acct.equity) || 0,
    buying_power: parseFloat(acct.buying_power) || 0,
    portfolio_value: parseFloat(acct.portfolio_value) || 0,
    pattern_day_trader: !!acct.pattern_day_trader,
    trading_blocked: !!acct.trading_blocked,
    account_blocked: !!acct.account_blocked,
  };
}

function clockToSummary(c: AlpacaClock): MarketClockSummary {
  return {
    is_open: !!c.is_open,
    next_open: c.next_open,
    next_close: c.next_close,
  };
}

function ordersToSummary(orders: AlpacaOrder[]): OrderSummary[] {
  return orders.slice(0, 20).map((o) => ({
    ticker: o.symbol,
    side: o.side,
    qty: parseFloat(o.qty) || 0,
    notional: 0,
    status: o.status,
    filled_avg_price: parseFloat(o.filled_avg_price ?? '0') || 0,
    submitted_at: o.submitted_at,
    filled_at: o.filled_at ?? null,
  }));
}

interface AccountSnapshot {
  environment: 'paper' | 'live';
  status: string;
  currency: string;
  cash: number;
  equity: number;
  buying_power: number;
  portfolio_value: number;
  pattern_day_trader: boolean;
  trading_blocked: boolean;
  account_blocked: boolean;
}

interface OrderSummary {
  ticker: string;
  side: string;
  qty: number;
  notional: number;
  status: string;
  filled_avg_price: number;
  submitted_at: string;
  filled_at: string | null;
}

interface MarketClockSummary {
  is_open: boolean;
  next_open: string;
  next_close: string;
}

function buildUserPrompt(args: {
  blueprint: Blueprint;
  bucketCapital: number;
  totalEquity: number;
  buyingPower: number;
  positions: PositionSummary[];
  candidates: IndicatorSnapshot[];
  inFlightTickers: string[];
  allocationPct: number;
  account: AccountSnapshot;
  recentOrders: OrderSummary[];
  marketClock: MarketClockSummary | null;
}): string {
  const {
    blueprint,
    bucketCapital,
    totalEquity,
    buyingPower,
    positions,
    candidates,
    inFlightTickers,
    allocationPct,
    account,
    recentOrders,
    marketClock,
  } = args;

  const isBucketEmpty = positions.length === 0 && inFlightTickers.length === 0;
  const targetSlots = Math.min(
    blueprint.params.maxPositions,
    Math.max(1, candidates.length),
  );
  const minNotionalPerSlot = bucketCapital > 0 ? Math.floor((bucketCapital / targetSlots) * 0.95) : 0;

  return [
    `# ALLOKER — KVALITET OVER KVANTITET`,
    ``,
    `Mål: stretch mot full deployment av bøtte-kapital — men ALDRI bryt blueprint-disiplinen.`,
    `Bedre å sitte 50 % i cash enn å gjøre dårlige kjøp på toppen av en momentum-bevegelse.`,
    ``,
    `Kjør prosedyren fra system-prompten din for porteføljevalg, og bruk Live Search aktivt for:`,
    `- Trump-poster på X / Truth Social (relevante for sektorer i watchlisten)`,
    `- Oljepris og geopolitiske nyheter (Hormuz, OPEC, Midtøsten)`,
    `- Top 13F-flytninger og earnings-sentiment for tickerne`,
    `- Markedsregime-signaler (S&P, NASDAQ, VIX, krypto-momentum)`,
    ``,
    `## Disiplinregler (HARDE — bryt aldri)`,
    `- ALDRI BUY på ticker med RSI > ${blueprint.params.rsiOverbought} (overkjøpt — vil reversere).`,
    `- ALDRI BUY ved klar negativ katalysator (Trump-tariff på sektoren, dårlig earnings, geopol-eskalering mot tickeren).`,
    `- ALDRI BUY for å "fylle bøtta" hvis ingen tickere møter blueprint-kvaliteten.`,
    ``,
    `## Antall picks å returnere`,
    `- ${blueprint.params.maxPositions} picks: når ${blueprint.params.maxPositions}+ tickere møter blueprint-kriteriene (perfekt eller nærmest).`,
    `- 1–${blueprint.params.maxPositions - 1} picks: når kun noen møter standarden.`,
    `- 0 picks: når ingen tickere passer akkurat nå. Cash er beste posisjon i regimet.`,
    ``,
    `Engine sizer hver pick automatisk som bøtte-kapital / ${blueprint.params.maxPositions} (consistent sizing).`,
    `notional_usd-feltet ignoreres — bare gi placeholder.`,
    ``,
    `Hvis bøtta allerede har posisjoner og ny ticker har > 10 poeng høyere asymmetric score enn laveste hold,`,
    `selg laveste og kjøp nye (REALLOKERING-regel).`,
    ``,
    `# Live trading-kontekst`,
    ``,
    `Asset class: ${blueprint.id}`,
    `Tidsstempel: ${new Date().toISOString()}`,
    `Bruker-allokering: ${allocationPct} % av total equity til denne bøtta`,
    `Total equity (USD): ${round(totalEquity, 2)}`,
    `Bøtte-kapital (USD): ${round(bucketCapital, 2)}`,
    `Buying power (USD): ${round(buyingPower, 2)}`,
    `Maks samtidige posisjoner i denne bøtta: ${blueprint.params.maxPositions}`,
    `Status: ${isBucketEmpty ? 'BØTTA ER TOM — MÅ DEPLOYE FULL KAPITAL NÅ' : `${positions.length} posisjon(er) holdes`}`,
    ``,
    `## Brukerens Alpaca-konto`,
    JSON.stringify(account, null, 2),
    ``,
    `## Markedstid (NYSE)`,
    marketClock
      ? JSON.stringify(marketClock, null, 2)
      : '(ukjent)',
    `Aksjer/ETF-er handles kun når NYSE er åpen.`,
    ``,
    `## Eksisterende aksje-posisjoner`,
    positions.length === 0 ? '(ingen)' : JSON.stringify(positions, null, 2),
    ``,
    `## Tickere med åpne (uutløste) ordre — IKKE legg inn nye ordre på disse`,
    inFlightTickers.length === 0 ? '(ingen)' : inFlightTickers.join(', '),
    ``,
    `## Siste aksje-ordre (filtered til watchlist)`,
    (() => {
      const watchSet = new Set<string>(blueprint.watchlist);
      const bucketOrders = recentOrders.filter((o) => {
        const sym = o.ticker;
        if (watchSet.has(sym)) return true;
        // Match Alpaca's no-slash crypto form even though we filter against
        // a stocks watchlist — defensive in case Grok needs to see history.
        const slashed = !sym.includes('/') && /^[A-Z]+USD$/.test(sym) && sym.length >= 6
          ? `${sym.slice(0, -3)}/USD`
          : sym;
        return watchSet.has(slashed);
      });
      return bucketOrders.length === 0 ? '(ingen)' : JSON.stringify(bucketOrders, null, 2);
    })(),
    ``,
    `## Watchlist-kandidater med live indikatorer`,
    JSON.stringify(candidates, null, 2),
    ``,
    `# Oppgave`,
    ``,
    `Følg blueprint-strategien fra system-prompten der den IKKE konflikter med kapital-deploy-mandatet.`,
    `Hvis bøtta er tom: rangér watchlisten etter beste tilgjengelige kombinasjon av momentum, regime-fit,`,
    `og blueprint-prioritering, og lever ${targetSlots} BUY-decisions som tilsammen bruker hele bøtte-kapitalen.`,
    `Hvis bøtta er delvis full: fyll resterende slots OG vurder om eksisterende posisjoner bør holdes/selges.`,
    ``,
    `Returner et JSON-objekt med formatet:`,
    `{`,
    `  "thesis": "kort sammendrag av valgene dine og hvorfor (maks 400 tegn)",`,
    `  "decisions": [`,
    `    { "ticker": "<symbol fra watchlisten>", "action": "BUY"|"SELL"|"HOLD", "notional_usd": 0, "reason": "kort begrunnelse (maks 200 tegn)" }`,
    `  ]`,
    `}`,
    ``,
    `Regler for output (HARDE KRAV):`,
    `- Kun watchlist-tickere er tillatt.`,
    `- Hvis bøtta er tom (ingen posisjoner): returner NØYAKTIG ${blueprint.params.maxPositions} BUY-decisions.`,
    `- Hvis bøtta har N posisjoner og N < ${blueprint.params.maxPositions}: returner ${blueprint.params.maxPositions} − N nye BUYs OG vurder om hver eksisterende posisjon bør HOLD eller SELL.`,
    `- Hvis bøtta er full (${blueprint.params.maxPositions} posisjoner): returner kun HOLD/SELL-decisions for eksisterende posisjoner.`,
    `- notional_usd: sett bare en placeholder (f.eks. 0 eller bucket_capital/maxPositions). Engine overstyrer den uansett.`,
    `- IGNORER blueprint-tekstens "1.5 % risk per trade"-regler — engine sizer ordrene.`,
    `- HOLD = posisjonen beholdes.`,
    `- SELL = lukk hele posisjonen.`,
    `- Ikke putt SELL på tickere som ikke er i posisjons-listen.`,
    `- Ikke putt BUY på tickere som er i in-flight-listen.`,
    `- Returner KUN gyldig JSON, ingen ekstra tekst.`,
  ].join('\n');
}

async function callGrokForBlueprint(
  blueprint: Blueprint,
  userPrompt: string,
): Promise<GrokDecisionPayload | null> {
  const r = await decide({
    systemPrompt: blueprint.strategy,
    userPrompt,
  });
  if (!r.success) {
    return null;
  }
  return r.payload;
}

interface ExecuteArgs {
  creds: AlpacaCreds;
  blueprint: Blueprint;
  bucketCapital: number;
  /** Account-wide cap. perPickNotional × num_buys cannot exceed this. */
  remainingBuyingPower: number;
  /** Whether NYSE regular hours are active. False during pre/after-market. */
  marketIsOpen: boolean;
  /** Indicator snapshots used to gate Grok BUYs through the anticipatory
   *  filter. If a ticker isn't in the snapshot map (e.g. failed to fetch
   *  bars) the BUY is rejected for safety. */
  snapshots: Map<string, IndicatorSnapshot>;
  payload: GrokDecisionPayload;
  positionsByTicker: Map<string, AlpacaPosition>;
  inFlightTickers: Set<string>;
}

interface ExecuteResult {
  trades: TradeResult[];
  /** Total successful BUY notional + SELL notional credit (negative). */
  netDeployed: number;
}

async function executeDecisions(args: ExecuteArgs): Promise<ExecuteResult> {
  const {
    creds,
    blueprint,
    bucketCapital,
    remainingBuyingPower,
    marketIsOpen,
    snapshots,
    payload,
    positionsByTicker,
    inFlightTickers,
  } = args;
  const isCrypto = blueprint.id === 'crypto';
  const watchlistSet = new Set<string>(blueprint.watchlist);
  const trades: TradeResult[] = [];
  let netDeployed = 0;
  const maxNotionalPerTicker = bucketCapital * (blueprint.params.maxPctPerPosition / 100);

  // Two-phase execution: SELLs first to free buying power, then BUYs.
  // Without this, a BUY queued right after a SELL hits Alpaca before the
  // freed cash is released → "insufficient buying power" rejection.
  const sellDecs: typeof payload.decisions = [];
  const buyDecs: typeof payload.decisions = [];
  for (const dec of payload.decisions) {
    const ticker = dec.ticker;
    if (!watchlistSet.has(ticker)) {
      trades.push(skipTrade(blueprint.id, ticker, dec.action, 'not_in_watchlist'));
      continue;
    }
    if (inFlightTickers.has(ticker)) {
      trades.push(skipTrade(blueprint.id, ticker, dec.action, 'in_flight'));
      continue;
    }
    if (dec.action === 'HOLD') continue;
    if (dec.action === 'SELL') sellDecs.push(dec);
    else if (dec.action === 'BUY') buyDecs.push(dec);
  }

  // ── FULL-DEPLOYMENT OVERRIDE ─────────────────────────────────────────
  // Ignore the per-pick notional Grok suggested. Engine sizes every BUY
  // so that the bucket reaches 100 % deployment after this scan.
  //
  // free_capital = bucket_capital − value of positions we're keeping
  // per_pick_target = free_capital / num_buys, capped at max-per-position
  const sellTickerSet = new Set(sellDecs.map((d) => d.ticker));
  let keptPositionValue = 0;
  for (const [ticker, pos] of positionsByTicker) {
    if (sellTickerSet.has(ticker)) continue; // closing this — capital frees up
    keptPositionValue += parseFloat(pos.market_value) || 0;
  }
  const freeBucketCapital = Math.max(0, bucketCapital - keptPositionValue);

  // Hard cap per-pick × N at the account-wide remaining buying power.
  // Without this, even a correctly-sized bucket can exceed Alpaca's
  // non-marginable buying power for fractional notional orders.
  const safeRemainingBP = Math.max(0, remainingBuyingPower) * 0.95;
  let perPickNotional = 0;
  if (buyDecs.length > 0 && freeBucketCapital >= MIN_NOTIONAL_USD) {
    perPickNotional = Math.min(
      freeBucketCapital / buyDecs.length,
      maxNotionalPerTicker,
      safeRemainingBP / buyDecs.length,
      MAX_PER_ORDER_NOTIONAL, // Alpaca paper rejects fractional notional > ~$10–15 k.
    );
  }

  // ── Phase 1: SELLs (parallel) ────────────────────────────────────────
  const sellResults = await Promise.all(
    sellDecs.map(async (dec) => {
      const ticker = dec.ticker;
      const held = positionsByTicker.get(ticker);
      if (!held) return skipTrade(blueprint.id, ticker, 'SELL', 'no_position');
      const qty = parseFloat(held.qty) || 0;
      if (qty <= 0) return skipTrade(blueprint.id, ticker, 'SELL', 'zero_qty');
      let orderReq: import('@/lib/alpaca').AlpacaOrderRequest | null;
      if (isCrypto) {
        orderReq = {
          symbol: tradingSymbol(ticker),
          qty,
          side: 'sell',
          type: 'market',
          time_in_force: 'gtc',
          position_intent: 'sell_to_close',
        };
      } else {
        const priceRes = await getLatestPrice(creds, tradingSymbol(ticker));
        const currentPrice = priceRes.success
          ? priceRes.data
          : parseFloat(held.current_price) || 0;
        orderReq = buildStockOrder({
          symbol: tradingSymbol(ticker),
          side: 'sell',
          qty,
          currentPrice,
          marketIsOpen,
        });
      }
      if (!orderReq) {
        return skipTrade(blueprint.id, ticker, 'SELL', 'no_price_for_extended_hours');
      }
      const r = await placeOrder(creds, orderReq);
      return {
        blueprintId: blueprint.id,
        ticker,
        action: 'SELL' as const,
        qty,
        notional: 0,
        status: r.success ? ('OK' as TradeStatus) : ('ERR' as TradeStatus),
        reason: dec.reason || 'GROK_SELL',
        error: r.success ? undefined : r.error,
      };
    }),
  );
  trades.push(...sellResults);

  // Wait for SELLs to settle and free buying power. 2.5s is empirical —
  // Alpaca paper releases cash from market sells within ~1s but we add
  // slack so the next BUY doesn't get a stale buying-power snapshot.
  if (sellDecs.some((d) => d) && buyDecs.length > 0) {
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }

  // ── Phase 2: BUYs (sequential, all at engine-forced size) ────────────
  // Engine ignores Grok's notional. Each BUY uses perPickNotional, but is
  // additionally capped per-ticker so cumulative position size never exceeds
  // maxPctPerPosition × bucket capital. This prevents the "ADA at 34 %" bug
  // where Grok recommends BUY on the same ticker across consecutive scans
  // and engine kept stacking on top of an already-full position.
  if (buyDecs.length > 0 && perPickNotional < MIN_NOTIONAL_USD) {
    for (const dec of buyDecs) {
      trades.push(skipTrade(blueprint.id, dec.ticker, 'BUY', 'no_free_capital'));
    }
    return { trades, netDeployed };
  }
  for (const dec of buyDecs) {
    const ticker = dec.ticker;

    // ── Anticipatory signal filter ───────────────────────────────────────
    // Hard reject any Grok BUY where the indicator state doesn't match the
    // dip-buy thesis (uptrend + oversold/near-support + bullish confirmation).
    // This is what stops the engine from buying momentum tops just because
    // Grok ranked them by 5-day return.
    const snap = snapshots.get(ticker);
    if (!snap) {
      trades.push(
        skipTrade(blueprint.id, ticker, 'BUY', 'no_snapshot_for_filter'),
      );
      continue;
    }
    const signal = isAnticipatorySignal(snap);
    if (!signal.ok) {
      trades.push(
        skipTrade(
          blueprint.id,
          ticker,
          'BUY',
          `no_anticipatory: ${signal.reasons.join(',')}`,
        ),
      );
      continue;
    }

    // Per-ticker concentration cap: don't let cumulative position exceed
    // maxPctPerPosition. Existing position value counts toward the cap.
    const existing = positionsByTicker.get(ticker);
    const existingValue = existing ? parseFloat(existing.market_value) || 0 : 0;
    const remainingTickerCap = Math.max(0, maxNotionalPerTicker - existingValue);
    const cappedByTicker = Math.min(perPickNotional, remainingTickerCap);
    const notional = round(cappedByTicker, 2);
    if (notional < MIN_NOTIONAL_USD) {
      trades.push(
        skipTrade(
          blueprint.id,
          ticker,
          'BUY',
          remainingTickerCap < MIN_NOTIONAL_USD ? 'concentration_cap_reached' : 'below_min_notional',
        ),
      );
      continue;
    }
    let orderReq: import('@/lib/alpaca').AlpacaOrderRequest | null;
    if (isCrypto) {
      orderReq = {
        symbol: tradingSymbol(ticker),
        notional,
        side: 'buy',
        type: 'market',
        time_in_force: 'gtc',
        position_intent: 'buy_to_open',
      };
    } else {
      // Stocks/commodities: fetch fresh price so extended-hours limit
      // orders can size whole-share qty + a tight limit price.
      const priceRes = await getLatestPrice(creds, tradingSymbol(ticker));
      const currentPrice = priceRes.success ? priceRes.data : 0;
      orderReq = buildStockOrder({
        symbol: tradingSymbol(ticker),
        side: 'buy',
        notional,
        currentPrice,
        marketIsOpen,
      });
    }
    if (!orderReq) {
      trades.push(skipTrade(blueprint.id, ticker, 'BUY', 'no_price_for_extended_hours'));
      continue;
    }
    const r = await placeOrder(creds, orderReq);
    trades.push({
      blueprintId: blueprint.id,
      ticker,
      action: 'BUY',
      qty: 0,
      notional,
      status: r.success ? 'OK' : 'ERR',
      reason: dec.reason || 'GROK_BUY',
      error: r.success ? undefined : r.error,
    });
    if (r.success) netDeployed += notional;
  }

  return { trades, netDeployed };
}

function skipTrade(
  blueprintId: AssetClass,
  ticker: string,
  action: TradeAction | 'HOLD',
  reason: string,
): TradeResult {
  return {
    blueprintId,
    ticker,
    action: action === 'HOLD' ? 'BUY' : action,
    qty: 0,
    notional: 0,
    status: 'SKIP',
    reason,
  };
}

/**
 * Mechanical safety pass — runs every cron tick regardless of Grok cadence.
 * Triggers SELL when a held position hits its ATR-stop or profit-take
 * threshold, so a flash move between Grok calls doesn't blow through the
 * blueprint's risk floor.
 */
async function mechanicalSafetyPass(args: {
  creds: AlpacaCreds;
  blueprint: Blueprint;
  positionsByTicker: Map<string, AlpacaPosition>;
  inFlightTickers: Set<string>;
  marketIsOpen: boolean;
}): Promise<TradeResult[]> {
  const { creds, blueprint, positionsByTicker, inFlightTickers, marketIsOpen } = args;
  const isCrypto = blueprint.id === 'crypto';
  const trades: TradeResult[] = [];

  for (const [ticker, held] of positionsByTicker) {
    if (inFlightTickers.has(ticker)) continue;
    const qty = parseFloat(held.qty) || 0;
    const entry = parseFloat(held.avg_entry_price) || 0;
    if (qty <= 0 || entry <= 0) continue;

    try {
      const barsRes = await fetchBars(creds, blueprint, ticker);
      if (!barsRes.success || barsRes.data.length < blueprint.params.atrPeriod + 5) continue;
      const bars = barsRes.data;
      const lastClose = bars[bars.length - 1]?.c ?? entry;
      const price = await fetchLatest(creds, blueprint, ticker, lastClose);
      const atrVal = atr(bars, blueprint.params.atrPeriod);
      if (atrVal == null) continue;

      const stopPrice = entry - blueprint.params.atrStopMult * atrVal;
      const pnlPct = (price - entry) / entry;

      let reason: string | null = null;
      if (price <= stopPrice) reason = 'MECHANICAL_ATR_STOP';
      else if (pnlPct >= blueprint.params.profitTakeThreshold) reason = 'MECHANICAL_PROFIT_TAKE';

      if (!reason) continue;

      const orderReq = isCrypto
        ? ({
            symbol: tradingSymbol(ticker),
            qty,
            side: 'sell' as const,
            type: 'market' as const,
            time_in_force: 'gtc' as const,
            position_intent: 'sell_to_close' as const,
          })
        : buildStockOrder({
            symbol: tradingSymbol(ticker),
            side: 'sell',
            qty,
            currentPrice: price,
            marketIsOpen,
          });
      if (!orderReq) continue;
      const r = await placeOrder(creds, orderReq);
      trades.push({
        blueprintId: blueprint.id,
        ticker,
        action: 'SELL',
        qty,
        notional: 0,
        status: r.success ? 'OK' : 'ERR',
        reason,
        error: r.success ? undefined : r.error,
      });
    } catch {
      // skip on transient error
    }
  }

  return trades;
}

async function runBlueprint(args: {
  creds: AlpacaCreds;
  clerkUserId: string;
  blueprint: Blueprint;
  bucketCapital: number;
  totalEquity: number;
  buyingPower: number;
  /** Account-wide buying power remaining for this scan, ticking down as
   *  earlier blueprints in the loop deploy capital. Used as a ceiling so
   *  later blueprints can't request more than Alpaca will actually fund. */
  remainingBuyingPower: number;
  allocationPct: number;
  allPositions: AlpacaPosition[];
  openOrderSymbols: Set<string>;
  killSwitchOn: boolean;
  account: AccountSnapshot;
  recentOrders: OrderSummary[];
  marketClock: MarketClockSummary | null;
}): Promise<BlueprintRunResult & { deployedNotional: number }> {
  const {
    creds,
    clerkUserId,
    blueprint,
    bucketCapital,
    totalEquity,
    buyingPower,
    remainingBuyingPower,
    allocationPct,
    allPositions,
    openOrderSymbols,
    killSwitchOn,
    account,
    recentOrders,
    marketClock,
  } = args;

  const watchlistSet = new Set<string>(blueprint.watchlist);
  const positionsByTicker = new Map<string, AlpacaPosition>();
  for (const p of allPositions) {
    const norm = normalizePositionSymbol(p.symbol);
    if (watchlistSet.has(norm)) positionsByTicker.set(norm, p);
  }
  const inFlightTickers = new Set<string>();
  for (const sym of openOrderSymbols) {
    const norm = normalizePositionSymbol(sym);
    if (watchlistSet.has(norm)) inFlightTickers.add(norm);
  }

  const result: BlueprintRunResult = {
    blueprintId: blueprint.id,
    bucketCapital,
    positionsHeld: positionsByTicker.size,
    trades: [],
    killSwitchTriggered: killSwitchOn,
    grokCalled: false,
    reason: killSwitchOn ? 'daily_kill_switch' : undefined,
  };

  if (killSwitchOn) return { ...result, deployedNotional: 0 };

  // If user has zero allocation to this bucket but positions still exist
  // (e.g. they reallocated 100 % to stocks after holding commodities),
  // liquidate all in-bucket holdings so capital flows to other buckets.
  if (bucketCapital <= 0) {
    for (const [ticker, held] of positionsByTicker) {
      if (inFlightTickers.has(ticker)) continue;
      const qty = parseFloat(held.qty) || 0;
      if (qty <= 0) continue;
      const isCrypto = blueprint.id === 'crypto';
      const marketIsOpen = marketClock?.is_open ?? false;
      const orderReq = isCrypto
        ? ({
            symbol: tradingSymbol(ticker),
            qty,
            side: 'sell' as const,
            type: 'market' as const,
            time_in_force: 'gtc' as const,
            position_intent: 'sell_to_close' as const,
          })
        : buildStockOrder({
            symbol: tradingSymbol(ticker),
            side: 'sell',
            qty,
            currentPrice: parseFloat(held.current_price) || 0,
            marketIsOpen,
          });
      if (!orderReq) continue;
      const r = await placeOrder(creds, orderReq);
      result.trades.push({
        blueprintId: blueprint.id,
        ticker,
        action: 'SELL',
        qty,
        notional: 0,
        status: r.success ? 'OK' : 'ERR',
        reason: 'BUCKET_DEALLOCATED',
        error: r.success ? undefined : r.error,
      });
    }
    result.reason = 'bucket_deallocated';
    return { ...result, deployedNotional: 0 };
  }

  // 1. Mechanical safety always runs first.
  const safetyTrades = await mechanicalSafetyPass({
    creds,
    blueprint,
    positionsByTicker,
    inFlightTickers,
    marketIsOpen: marketClock?.is_open ?? false,
  });
  result.trades.push(...safetyTrades);
  // Drop closed positions from local cache so subsequent Grok decisions see fresh state.
  for (const t of safetyTrades) {
    if (t.action === 'SELL' && t.status === 'OK') {
      positionsByTicker.delete(t.ticker);
    }
  }

  // 2. Decide whether to call Grok this tick.
  const last = await getLatestDecision(clerkUserId, blueprint.id);
  const lastMs = last && !last.failed ? new Date(last.decidedAt).getTime() : 0;
  const ageMs = Date.now() - lastMs;
  const shouldCallGrok = !last || last.failed || ageMs >= GROK_CADENCE_MS;

  if (!shouldCallGrok) {
    result.thesis = last?.thesis ?? undefined;
    return { ...result, deployedNotional: 0 };
  }

  // 3. Build context + call Grok.
  const candidates = await buildIndicatorSnapshots(creds, blueprint);
  if (candidates.length === 0) {
    await saveDecision({
      clerkUserId,
      blueprintId: blueprint.id,
      thesis: '',
      decisions: [],
      rawResponse: null,
      failed: true,
      errorMessage: 'no_candidate_data',
    });
    result.reason = 'no_candidate_data';
    return { ...result, deployedNotional: 0 };
  }

  const userPrompt = buildUserPrompt({
    blueprint,
    bucketCapital,
    totalEquity,
    buyingPower,
    positions: summarizePositions(allPositions, watchlistSet),
    candidates,
    inFlightTickers: [...inFlightTickers],
    allocationPct,
    account,
    recentOrders,
    marketClock,
  });

  const grokRes = await decide({
    systemPrompt: blueprint.strategy,
    userPrompt,
  });
  result.grokCalled = true;

  if (!grokRes.success) {
    await saveDecision({
      clerkUserId,
      blueprintId: blueprint.id,
      thesis: '',
      decisions: [],
      rawResponse: grokRes.raw ?? null,
      failed: true,
      errorMessage: grokRes.error,
    });
    result.reason = `grok_error: ${grokRes.error}`;
    return { ...result, deployedNotional: 0 };
  }

  const payload = grokRes.payload;
  result.thesis = payload.thesis;

  // 4. Execute Grok's decisions.
  const snapshotMap = new Map<string, IndicatorSnapshot>(
    candidates.map((s) => [s.ticker, s]),
  );
  const exec = await executeDecisions({
    creds,
    blueprint,
    bucketCapital,
    remainingBuyingPower,
    marketIsOpen: marketClock?.is_open ?? false,
    snapshots: snapshotMap,
    payload,
    positionsByTicker,
    inFlightTickers,
  });
  result.trades.push(...exec.trades);
  result.positionsHeld = positionsByTicker.size + exec.trades.filter(
    (t) => t.action === 'BUY' && t.status === 'OK',
  ).length;

  await saveDecision({
    clerkUserId,
    blueprintId: blueprint.id,
    thesis: payload.thesis,
    decisions: payload.decisions,
    tradeOutcomes: exec.trades.map((t) => ({
      ticker: t.ticker,
      action: t.action,
      status: t.status,
      notional: t.notional,
      qty: t.qty,
      reason: t.reason,
      ...(t.error ? { error: t.error } : {}),
    })),
    usage: grokRes.usage,
    rawResponse: grokRes.raw ?? null,
  });

  return { ...result, deployedNotional: exec.netDeployed };
}

export async function runScanForUser(
  creds: AlpacaCreds,
  clerkUserId: string,
): Promise<UserScanResult> {
  const ranAt = new Date().toISOString();
  const out: UserScanResult = {
    clerkUserId,
    ranAt,
    equity: 0,
    buyingPower: 0,
    blueprints: [],
  };

  // Only cancel STALE pending orders (>5 min old). Cancelling everything
  // every tick was killing pre-market limit fills before the order could
  // match thin orderbook liquidity (we saw orders canceled 23 sec after
  // submission). The engine's inFlightTickers logic prevents duplicate
  // submissions, so fresh limits don't need to be cleared.
  const STALE_ORDER_MS = 5 * 60 * 1000;
  const openOrdersForCleanupRes = await getOrders(creds, { status: 'open', limit: 200 });
  if (openOrdersForCleanupRes.success) {
    const now = Date.now();
    for (const o of openOrdersForCleanupRes.data) {
      const ageMs = now - new Date(o.submitted_at).getTime();
      if (ageMs > STALE_ORDER_MS) {
        // Best-effort cancel of stale orders so they don't lock BP forever.
        await alpacaCancelOrder(creds, o.id);
      }
    }
  }

  const acctRes = await getAccount(creds);
  if (!acctRes.success) {
    out.error = `account_fetch_failed: ${acctRes.error}`;
    return out;
  }
  const equity = parseFloat(acctRes.data.equity) || 0;
  const lastEquity =
    parseFloat(
      (acctRes.data as unknown as { last_equity?: string }).last_equity ?? acctRes.data.equity,
    ) || equity;
  const buyingPower = parseFloat(acctRes.data.buying_power) || 0;
  out.equity = equity;
  out.buyingPower = buyingPower;

  const dailyPnlPct = lastEquity > 0 ? (equity - lastEquity) / lastEquity : 0;

  const positionsRes = await getPositions(creds);
  if (!positionsRes.success) {
    out.error = `positions_fetch_failed: ${positionsRes.error}`;
    return out;
  }
  const positions = positionsRes.data;

  const openOrdersRes = await getOrders(creds, { status: 'open', limit: 200 });
  const openOrderSymbols = new Set<string>(
    openOrdersRes.success ? openOrdersRes.data.map((o) => o.symbol) : [],
  );

  const recentOrdersRes = await getOrders(creds, { status: 'all', limit: 20 });
  const recentOrders = recentOrdersRes.success ? ordersToSummary(recentOrdersRes.data) : [];

  const clockRes = await getClock(creds);
  const marketClock = clockRes.success ? clockToSummary(clockRes.data) : null;

  const account = accountToSnapshot(acctRes.data, creds.env);

  const allocation = await getUserAllocation(clerkUserId);

  // Account-wide cap on new BUY notional this scan. Notional/fractional
  // orders on Alpaca draw from non-marginable buying power (≈ cash), not
  // margin × 2. Use cash so each blueprint's deployment stays within the
  // pool Alpaca will actually fund. 95 % leaves a small slack so rounding
  // doesn't push the last order over the edge.
  const cash = parseFloat(acctRes.data.cash) || 0;
  let remainingBuyingPower = cash;

  for (const blueprint of BLUEPRINT_LIST) {
    // Hard-disabled blueprints get 0 % bucket capital regardless of the
    // user's saved allocation. The deallocation logic in runBlueprint then
    // liquidates any positions in this bucket and skips Grok entirely.
    const isDisabled = DISABLED_BLUEPRINTS.has(blueprint.id);
    const allocPct = isDisabled ? 0 : allocation[blueprint.id] ?? 0;
    const bucketCapital = (equity * allocPct) / 100;
    const killSwitchOn = dailyPnlPct <= blueprint.params.dailyKillSwitchPct;
    const result = await runBlueprint({
      creds,
      clerkUserId,
      blueprint,
      bucketCapital,
      totalEquity: equity,
      buyingPower,
      remainingBuyingPower,
      allocationPct: allocPct,
      allPositions: positions,
      openOrderSymbols,
      killSwitchOn,
      account,
      recentOrders,
      marketClock,
    });
    remainingBuyingPower = Math.max(0, remainingBuyingPower - result.deployedNotional);
    out.blueprints.push(result);
  }

  return out;
}

export type { GrokDecision } from '@/lib/grok';

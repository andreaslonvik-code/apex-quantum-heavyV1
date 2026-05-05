import {
  type AlpacaAccount,
  type AlpacaBar,
  type AlpacaClock,
  type AlpacaCreds,
  type AlpacaOrder,
  type AlpacaPosition,
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
import { atr, macd, rsi, sma } from './indicators';

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

const GROK_CADENCE_MS = 2 * 60 * 1000;
const INDICATOR_BAR_COUNT = 60; // bars to fetch for indicator summary
const MIN_NOTIONAL_USD = 1.0;

function tradingSymbol(symbol: string): string {
  return symbol.replace('/', '');
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
      snaps.push({
        ticker,
        price: round(p, 6),
        change_24h_pct: ago1 ? round(((p - ago1) / ago1) * 100, 2) : null,
        change_5d_pct: ago5 ? round(((p - ago5) / ago5) * 100, 2) : null,
        rsi_14: nullableRound(rsi(closes, 14), 1),
        sma_50: nullableRound(sma(closes, 50), 4),
        sma_200: nullableRound(sma(closes, 200), 4),
        macd_hist: nullableRound(macd(closes)?.hist ?? null, 4),
        atr_14: nullableRound(atr(bars, blueprint.params.atrPeriod), 4),
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
  allPositions: PositionSummary[];
  recentOrders: OrderSummary[];
  marketClock: MarketClockSummary | null;
  allocationFull: { stocks: number; crypto: number; commodities: number };
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
    allPositions,
    recentOrders,
    marketClock,
    allocationFull,
  } = args;

  const isBucketEmpty = positions.length === 0 && inFlightTickers.length === 0;
  const targetSlots = Math.min(
    blueprint.params.maxPositions,
    Math.max(1, candidates.length),
  );
  const minNotionalPerSlot = bucketCapital > 0 ? Math.floor((bucketCapital / targetSlots) * 0.95) : 0;

  return [
    `# KRITISK MANDAT — LES FØRST`,
    ``,
    `Brukeren krever at HELE bøtte-kapitalen er deployert til enhver tid.`,
    `Det betyr at du ALDRI skal returnere bare HOLD-decisions når bøtta har ledige slots og ledig kapital.`,
    `Hvis blueprint-strategien sier "vent på RSI<30 + MA200-support", må du fortsatt`,
    `velge de BESTE tilgjengelige kandidatene fra watchlisten og deploye kapital nå.`,
    `Du står fritt til å rangere etter momentum, regime, sentiment, eller blueprint-vekt — men`,
    `du MÅ levere BUY-decisions som dekker hele ledig bøtte-kapital ved hver beslutning så lenge`,
    `bøtta ikke er full og ikke ligger i kill-switch.`,
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
    `## Markedstid`,
    marketClock
      ? JSON.stringify(marketClock, null, 2)
      : '(ukjent)',
    `Merk: aksjer og ETFs (incl. BNO/GOLD) handles kun når market er åpent. Krypto handler 24/7.`,
    ``,
    `## Allokering på tvers av alle bøtter (% av total equity)`,
    JSON.stringify(allocationFull, null, 2),
    ``,
    `## Alle posisjoner (på tvers av bøtter)`,
    allPositions.length === 0 ? '(ingen)' : JSON.stringify(allPositions, null, 2),
    ``,
    `## Eksisterende posisjoner i denne bøtta`,
    positions.length === 0 ? '(ingen)' : JSON.stringify(positions, null, 2),
    ``,
    `## Tickere med åpne (uutløste) ordre — IKKE legg inn nye ordre på disse`,
    inFlightTickers.length === 0 ? '(ingen)' : inFlightTickers.join(', '),
    ``,
    `## Siste 20 ordre (status, fills, outcomes — for kontekst)`,
    recentOrders.length === 0 ? '(ingen)' : JSON.stringify(recentOrders, null, 2),
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
    `  "thesis": "kort sammendrag av regime, geopolitikk og strategi for denne bøtta (maks 400 tegn)",`,
    `  "decisions": [`,
    `    { "ticker": "<symbol fra watchlisten>", "action": "BUY"|"SELL"|"HOLD", "notional_usd": <USD-beløp ved BUY>, "reason": "kort begrunnelse (maks 200 tegn)" }`,
    `  ]`,
    `}`,
    ``,
    `Regler for output:`,
    `- Kun watchlist-tickere er tillatt.`,
    `- Sum av notional_usd på BUY-decisions skal være så nær bøtte-kapital ($${round(bucketCapital, 2)}) som mulig — minimum ${minNotionalPerSlot > 0 ? `$${minNotionalPerSlot} per ny posisjon` : 'fyll bøtta så mye som mulig'}.`,
    `- Sum av notional_usd skal ALDRI overstige bøtte-kapital eller buying power.`,
    `- Hold deg innenfor max ${blueprint.params.maxPositions} samtidige posisjoner (eksisterende + nye BUYs).`,
    `- Maks ${blueprint.params.maxPctPerPosition} % av bøtta i én ticker.`,
    `- HOLD = ingen ordre, posisjon beholdes.`,
    `- SELL = lukk hele posisjonen.`,
    `- BUY på en ticker som allerede holdes = øk posisjonen med notional_usd (DCA).`,
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
  payload: GrokDecisionPayload;
  positionsByTicker: Map<string, AlpacaPosition>;
  inFlightTickers: Set<string>;
}

async function executeDecisions(args: ExecuteArgs): Promise<TradeResult[]> {
  const { creds, blueprint, bucketCapital, payload, positionsByTicker, inFlightTickers } = args;
  const isCrypto = blueprint.id === 'crypto';
  const watchlistSet = new Set<string>(blueprint.watchlist);
  const trades: TradeResult[] = [];
  const maxNotionalPerTicker = bucketCapital * (blueprint.params.maxPctPerPosition / 100);

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

    if (dec.action === 'HOLD') {
      continue;
    }

    if (dec.action === 'SELL') {
      const held = positionsByTicker.get(ticker);
      if (!held) {
        trades.push(skipTrade(blueprint.id, ticker, 'SELL', 'no_position'));
        continue;
      }
      const qty = parseFloat(held.qty) || 0;
      if (qty <= 0) {
        trades.push(skipTrade(blueprint.id, ticker, 'SELL', 'zero_qty'));
        continue;
      }
      const r = await placeOrder(creds, {
        symbol: tradingSymbol(ticker),
        qty,
        side: 'sell',
        type: 'market',
        time_in_force: isCrypto ? 'gtc' : 'day',
        position_intent: 'sell_to_close',
      });
      trades.push({
        blueprintId: blueprint.id,
        ticker,
        action: 'SELL',
        qty,
        notional: 0,
        status: r.success ? 'OK' : 'ERR',
        reason: dec.reason || 'GROK_SELL',
        error: r.success ? undefined : r.error,
      });
      continue;
    }

    // BUY
    const requested = dec.notional_usd ?? 0;
    if (!Number.isFinite(requested) || requested < MIN_NOTIONAL_USD) {
      trades.push(skipTrade(blueprint.id, ticker, 'BUY', 'invalid_notional'));
      continue;
    }
    const capped = Math.min(requested, maxNotionalPerTicker);
    const notional = round(capped, 2);
    if (notional < MIN_NOTIONAL_USD) {
      trades.push(skipTrade(blueprint.id, ticker, 'BUY', 'below_min_notional'));
      continue;
    }
    const r = await placeOrder(creds, {
      symbol: tradingSymbol(ticker),
      notional,
      side: 'buy',
      type: 'market',
      time_in_force: isCrypto ? 'gtc' : 'day',
      position_intent: 'buy_to_open',
    });
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
  }

  return trades;
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
}): Promise<TradeResult[]> {
  const { creds, blueprint, positionsByTicker, inFlightTickers } = args;
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

      const r = await placeOrder(creds, {
        symbol: tradingSymbol(ticker),
        qty,
        side: 'sell',
        type: 'market',
        time_in_force: isCrypto ? 'gtc' : 'day',
        position_intent: 'sell_to_close',
      });
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
  allocationPct: number;
  allocationFull: { stocks: number; crypto: number; commodities: number };
  allPositions: AlpacaPosition[];
  openOrderSymbols: Set<string>;
  killSwitchOn: boolean;
  account: AccountSnapshot;
  recentOrders: OrderSummary[];
  marketClock: MarketClockSummary | null;
}): Promise<BlueprintRunResult> {
  const {
    creds,
    clerkUserId,
    blueprint,
    bucketCapital,
    totalEquity,
    buyingPower,
    allocationPct,
    allocationFull,
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

  if (killSwitchOn) return result;

  // 1. Mechanical safety always runs first.
  const safetyTrades = await mechanicalSafetyPass({
    creds,
    blueprint,
    positionsByTicker,
    inFlightTickers,
  });
  result.trades.push(...safetyTrades);
  // Drop closed positions from local cache so subsequent Grok decisions see fresh state.
  for (const t of safetyTrades) {
    if (t.action === 'SELL' && t.status === 'OK') {
      positionsByTicker.delete(t.ticker);
    }
  }

  if (bucketCapital <= 0) return result;

  // 2. Decide whether to call Grok this tick.
  const last = await getLatestDecision(clerkUserId, blueprint.id);
  const lastMs = last && !last.failed ? new Date(last.decidedAt).getTime() : 0;
  const ageMs = Date.now() - lastMs;
  const shouldCallGrok = !last || last.failed || ageMs >= GROK_CADENCE_MS;

  if (!shouldCallGrok) {
    result.thesis = last?.thesis ?? undefined;
    return result;
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
    return result;
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
    allPositions: summarizeAllPositions(allPositions),
    recentOrders,
    marketClock,
    allocationFull,
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
    return result;
  }

  const payload = grokRes.payload;
  result.thesis = payload.thesis;

  // 4. Execute Grok's decisions.
  const tradeResults = await executeDecisions({
    creds,
    blueprint,
    bucketCapital,
    payload,
    positionsByTicker,
    inFlightTickers,
  });
  result.trades.push(...tradeResults);
  result.positionsHeld = positionsByTicker.size + tradeResults.filter(
    (t) => t.action === 'BUY' && t.status === 'OK',
  ).length;

  await saveDecision({
    clerkUserId,
    blueprintId: blueprint.id,
    thesis: payload.thesis,
    decisions: payload.decisions,
    usage: grokRes.usage,
    rawResponse: grokRes.raw ?? null,
  });

  return result;
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

  for (const blueprint of BLUEPRINT_LIST) {
    const allocPct = allocation[blueprint.id] ?? 0;
    const bucketCapital = (equity * allocPct) / 100;
    const killSwitchOn = dailyPnlPct <= blueprint.params.dailyKillSwitchPct;
    const result = await runBlueprint({
      creds,
      clerkUserId,
      blueprint,
      bucketCapital,
      totalEquity: equity,
      buyingPower,
      allocationPct: allocPct,
      allocationFull: allocation,
      allPositions: positions,
      openOrderSymbols,
      killSwitchOn,
      account,
      recentOrders,
      marketClock,
    });
    out.blueprints.push(result);
  }

  return out;
}

export type { GrokDecision } from '@/lib/grok';

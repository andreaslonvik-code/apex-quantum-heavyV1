// lib/alpaca.ts — APEX QUANTUM v8 Alpaca client.
// Bulletproof wrapper around the Alpaca Trading API. Never throws — every helper
// returns an AlpacaResult discriminated union so callers don't need try/catch.
//
// Auth: per-user API Key ID + Secret (sent on every request via headers).
// Endpoints:
//   Trading API   — paper:  https://paper-api.alpaca.markets/v2
//                   live:   https://api.alpaca.markets/v2
//   Market Data   — https://data.alpaca.markets/v2
//
// Asset universe: US equities only (NASDAQ / NYSE / ARCA / AMEX).

// ============ ENVIRONMENT CONFIG ============
export type AlpacaEnv = 'paper' | 'live';

const ALPACA_PAPER_TRADING_BASE = 'https://paper-api.alpaca.markets/v2';
const ALPACA_LIVE_TRADING_BASE = 'https://api.alpaca.markets/v2';
const ALPACA_DATA_BASE = 'https://data.alpaca.markets/v2';

export function getTradingBase(env: AlpacaEnv): string {
  return env === 'live' ? ALPACA_LIVE_TRADING_BASE : ALPACA_PAPER_TRADING_BASE;
}

export function getDataBase(): string {
  return ALPACA_DATA_BASE;
}

export function isLiveMode(env: AlpacaEnv): boolean {
  return env === 'live';
}

// ============ TYPES ============
export interface AlpacaCreds {
  apiKey: string;
  apiSecret: string;
  env: AlpacaEnv;
}

export type AlpacaResult<T> =
  | { success: true; data: T; status: number }
  | { success: false; error: string; errorCode?: string; status?: number; rawResponse?: string };

export interface AlpacaAccount {
  id: string;
  account_number: string;
  status: string;
  currency: string;
  cash: string;
  equity: string;
  buying_power: string;
  portfolio_value: string;
  pattern_day_trader: boolean;
  trading_blocked: boolean;
  account_blocked: boolean;
  created_at: string;
}

export interface AlpacaPosition {
  asset_id: string;
  symbol: string;
  exchange: string;
  asset_class: string;
  qty: string;
  avg_entry_price: string;
  side: 'long' | 'short';
  market_value: string;
  cost_basis: string;
  unrealized_pl: string;
  unrealized_plpc: string;
  current_price: string;
}

export interface AlpacaOrderRequest {
  symbol: string;
  qty?: number;
  notional?: number;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop' | 'stop_limit';
  time_in_force: 'day' | 'gtc' | 'ioc' | 'fok' | 'opg' | 'cls';
  limit_price?: number;
  stop_price?: number;
  client_order_id?: string;
  extended_hours?: boolean;
  // Bracket-order support (v8): wraps a child take-profit + stop-loss around
  // the entry. Alpaca rejects the order if these are present without
  // order_class === 'bracket'.
  order_class?: 'simple' | 'bracket' | 'oco' | 'oto';
  // Position intent — server-side enforcement that prevents accidental
  // short-opening on a SELL or accidental cover on a BUY. Always set
  // 'sell_to_close' on SELL and 'buy_to_open' on BUY for this strategy
  // (long-only). Alpaca rejects the order with code 4040X if the intent
  // would create the wrong-side exposure.
  position_intent?: 'buy_to_open' | 'buy_to_close' | 'sell_to_open' | 'sell_to_close';
  take_profit?: { limit_price: number };
  stop_loss?: { stop_price: number; limit_price?: number };
}

export interface AlpacaBar {
  t: string; // RFC3339 timestamp
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface AlpacaOrder {
  id: string;
  client_order_id: string;
  symbol: string;
  qty: string;
  side: string;
  status: string;
  type: string;
  limit_price?: string;
  filled_avg_price?: string;
  filled_qty?: string;
  submitted_at: string;
  filled_at?: string;
}

export interface AlpacaAsset {
  id: string;
  symbol: string;
  name: string;
  exchange: string;
  class: string;
  status: string;
  tradable: boolean;
  marginable: boolean;
  shortable: boolean;
  fractionable: boolean;
}

export interface AlpacaQuote {
  symbol: string;
  bid: number;
  ask: number;
  mid: number;
  last: number;
  timestamp: string;
}

export interface AlpacaClock {
  timestamp: string;
  is_open: boolean;
  next_open: string;
  next_close: string;
}

// ============ DEBUG LOGGING ============
interface DebugLogEntry {
  timestamp: string;
  type: 'request' | 'response' | 'error' | 'info';
  endpoint: string;
  message: string;
  status?: number;
}

const debugLog: DebugLogEntry[] = [];
const MAX_DEBUG_ENTRIES = 100;

function log(entry: Omit<DebugLogEntry, 'timestamp'>): void {
  debugLog.unshift({ ...entry, timestamp: new Date().toISOString() });
  if (debugLog.length > MAX_DEBUG_ENTRIES) debugLog.length = MAX_DEBUG_ENTRIES;
}

export function getDebugLog(): DebugLogEntry[] {
  return [...debugLog];
}

export function clearDebugLog(): void {
  debugLog.length = 0;
}

// ============ CORE FETCH ============
/**
 * Bulletproof Alpaca fetch. Never throws.
 * Sends APCA-API-KEY-ID + APCA-API-SECRET-KEY headers.
 */
async function alpacaFetch<T = unknown>(
  url: string,
  creds: AlpacaCreds,
  init: RequestInit = {}
): Promise<AlpacaResult<T>> {
  const headers: Record<string, string> = {
    'APCA-API-KEY-ID': creds.apiKey,
    'APCA-API-SECRET-KEY': creds.apiSecret,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...((init.headers as Record<string, string>) || {}),
  };

  log({ type: 'request', endpoint: url, message: `${init.method || 'GET'}` });

  let response: Response;
  let rawText = '';
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30_000);
    response = await fetch(url, { ...init, headers, signal: controller.signal });
    clearTimeout(timeoutId);
    rawText = await response.text();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log({ type: 'error', endpoint: url, message: `Network error: ${msg}` });
    return { success: false, error: `Network error: ${msg}`, errorCode: 'NETWORK_ERROR' };
  }

  log({ type: 'response', endpoint: url, message: `HTTP ${response.status}`, status: response.status });

  if (rawText.trim().startsWith('<')) {
    return {
      success: false,
      error: `Alpaca returned HTML (status ${response.status}). Likely invalid endpoint or rate limit.`,
      errorCode: 'HTML_RESPONSE',
      status: response.status,
      rawResponse: rawText.slice(0, 500),
    };
  }

  if (!rawText.trim()) {
    if (response.ok) return { success: true, data: {} as T, status: response.status };
    return { success: false, error: `Empty response with HTTP ${response.status}`, errorCode: 'EMPTY', status: response.status };
  }

  let data: T;
  try {
    data = JSON.parse(rawText) as T;
  } catch (err) {
    return {
      success: false,
      error: `JSON parse error: ${err instanceof Error ? err.message : String(err)}`,
      errorCode: 'JSON_PARSE_ERROR',
      status: response.status,
      rawResponse: rawText.slice(0, 500),
    };
  }

  if (!response.ok) {
    const apiErr = data as { code?: number | string; message?: string };
    return {
      success: false,
      error: apiErr.message || `HTTP ${response.status}`,
      errorCode: String(apiErr.code ?? response.status),
      status: response.status,
      rawResponse: rawText.slice(0, 1000),
    };
  }

  return { success: true, data, status: response.status };
}

// ============ ACCOUNT ============
/** Fetch full Alpaca account snapshot. Used to validate creds on connect. */
export function getAccount(creds: AlpacaCreds): Promise<AlpacaResult<AlpacaAccount>> {
  return alpacaFetch<AlpacaAccount>(`${getTradingBase(creds.env)}/account`, creds);
}

/** Validate API credentials by hitting /account. Returns the account if valid.
 *  On 401, probes the opposite environment so we can tell the user whether the
 *  keys belong to the *other* env (most common) vs are simply invalid. */
export async function validateCreds(creds: AlpacaCreds): Promise<AlpacaResult<AlpacaAccount>> {
  const r = await getAccount(creds);
  if (r.success) return r;

  if (r.status === 401) {
    const otherEnv: AlpacaEnv = creds.env === 'paper' ? 'live' : 'paper';
    const probe = await getAccount({ ...creds, env: otherEnv });
    if (probe.success) {
      return {
        success: false,
        status: 401,
        error: `Disse nøklene tilhører ${otherEnv === 'live' ? 'LIVE' : 'PAPER'}-miljøet på Alpaca, men du valgte ${creds.env === 'live' ? 'LIVE' : 'PAPER'} her. Bytt miljø-valg, eller generer nye nøkler i riktig dashboard.`,
        errorCode: 'WRONG_ENV',
      };
    }
    return {
      ...r,
      error:
        'Alpaca avviste nøklene. Vanligste årsaker: (1) du brukte en Broker API-nøkkel (broker-app.alpaca.markets) i stedet for en Trading API-nøkkel (app.alpaca.markets), (2) typo i Key ID eller Secret, (3) nøkkelen er regenerert eller slettet på Alpaca.',
      errorCode: 'INVALID_CREDS',
    };
  }
  if (r.status === 403) {
    return { ...r, error: 'Alpaca-kontoen er ikke autorisert for dette miljøet.', errorCode: 'WRONG_ENV' };
  }
  return r;
}

// ============ MARKET CLOCK ============
export function getClock(creds: AlpacaCreds): Promise<AlpacaResult<AlpacaClock>> {
  return alpacaFetch<AlpacaClock>(`${getTradingBase(creds.env)}/clock`, creds);
}

// ============ POSITIONS ============
export function getPositions(creds: AlpacaCreds): Promise<AlpacaResult<AlpacaPosition[]>> {
  return alpacaFetch<AlpacaPosition[]>(`${getTradingBase(creds.env)}/positions`, creds);
}

export function getPosition(
  creds: AlpacaCreds,
  symbol: string
): Promise<AlpacaResult<AlpacaPosition>> {
  return alpacaFetch<AlpacaPosition>(
    `${getTradingBase(creds.env)}/positions/${encodeURIComponent(symbol)}`,
    creds
  );
}

/** Close ALL positions for the user. */
export function closeAllPositions(
  creds: AlpacaCreds,
  cancelOrders = true
): Promise<AlpacaResult<unknown>> {
  return alpacaFetch(
    `${getTradingBase(creds.env)}/positions?cancel_orders=${cancelOrders}`,
    creds,
    { method: 'DELETE' }
  );
}

// ============ ORDERS ============
export function placeOrder(
  creds: AlpacaCreds,
  order: AlpacaOrderRequest
): Promise<AlpacaResult<AlpacaOrder>> {
  return alpacaFetch<AlpacaOrder>(`${getTradingBase(creds.env)}/orders`, creds, {
    method: 'POST',
    body: JSON.stringify(order),
  });
}

export function getOrders(
  creds: AlpacaCreds,
  params: { status?: 'open' | 'closed' | 'all'; limit?: number } = {}
): Promise<AlpacaResult<AlpacaOrder[]>> {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  if (params.limit) qs.set('limit', String(params.limit));
  const url = `${getTradingBase(creds.env)}/orders${qs.toString() ? `?${qs}` : ''}`;
  return alpacaFetch<AlpacaOrder[]>(url, creds);
}

export function cancelAllOrders(creds: AlpacaCreds): Promise<AlpacaResult<unknown>> {
  return alpacaFetch(`${getTradingBase(creds.env)}/orders`, creds, { method: 'DELETE' });
}

/**
 * Replace (modify) an existing order. Used by the v8 ratchet trailing stop
 * to bump a held child stop-loss up to entry+1 % once unrealised P/L ≥ 3 %.
 */
export function replaceOrder(
  creds: AlpacaCreds,
  orderId: string,
  patch: { qty?: number; limit_price?: number; stop_price?: number; trail?: number; time_in_force?: 'day' | 'gtc' }
): Promise<AlpacaResult<AlpacaOrder>> {
  return alpacaFetch<AlpacaOrder>(
    `${getTradingBase(creds.env)}/orders/${encodeURIComponent(orderId)}`,
    creds,
    { method: 'PATCH', body: JSON.stringify(patch) }
  );
}

// ============ ASSETS ============
const assetCache: Map<string, AlpacaAsset> = new Map();

export async function getAsset(
  creds: AlpacaCreds,
  symbol: string
): Promise<AlpacaResult<AlpacaAsset>> {
  const key = symbol.toUpperCase();
  const cached = assetCache.get(key);
  if (cached) return { success: true, data: cached, status: 200 };

  const r = await alpacaFetch<AlpacaAsset>(
    `${getTradingBase(creds.env)}/assets/${encodeURIComponent(key)}`,
    creds
  );
  if (r.success) assetCache.set(key, r.data);
  return r;
}

// ============ MARKET DATA ============
/** Get latest trade price for a single symbol via the market data API. */
export async function getLatestQuote(
  creds: AlpacaCreds,
  symbol: string
): Promise<AlpacaResult<AlpacaQuote>> {
  const url = `${getDataBase()}/stocks/${encodeURIComponent(symbol)}/quotes/latest`;
  const r = await alpacaFetch<{
    quote?: { ap?: number; bp?: number; t?: string };
    symbol?: string;
  }>(url, creds);
  if (!r.success) return r as AlpacaResult<AlpacaQuote>;

  const q = r.data.quote;
  const ask = q?.ap ?? 0;
  const bid = q?.bp ?? 0;
  const mid = ask && bid ? (ask + bid) / 2 : ask || bid;
  return {
    success: true,
    status: r.status,
    data: { symbol: r.data.symbol || symbol, bid, ask, mid, last: mid, timestamp: q?.t || new Date().toISOString() },
  };
}

/**
 * Fetch historical OHLCV bars for a single symbol. Returns chronologically
 * ordered bars (oldest first).
 *
 * Without explicit `start` / `end`, Alpaca's bars endpoint behaves
 * unpredictably — testing showed it returns just 1 bar for `limit=30`
 * `1Day` requests on free-tier paper accounts. Pass an explicit time
 * window derived from the requested timeframe + limit so we always get
 * the count the caller asked for.
 *
 * Free-tier accounts get the IEX feed and SIP data delayed by 15 min.
 * We default to `feed=iex` (broadest free-tier support) and shift `end`
 * 16 min into the past so SIP-delay restrictions don't trim recent bars.
 */
export async function getStockBars(
  creds: AlpacaCreds,
  symbol: string,
  opts: {
    timeframe: '1Min' | '5Min' | '15Min' | '1Hour' | '1Day';
    limit?: number;
    feed?: 'iex' | 'sip';
  } = { timeframe: '1Day', limit: 250 }
): Promise<AlpacaResult<AlpacaBar[]>> {
  const limit = opts.limit ?? 250;
  const feed = opts.feed ?? 'iex';

  const SIP_DELAY_BUFFER_MS = 16 * 60 * 1000;
  const end = new Date(Date.now() - SIP_DELAY_BUFFER_MS);
  const start = new Date(end.getTime() - barsWindowMs(opts.timeframe, limit));

  const qs = new URLSearchParams();
  qs.set('timeframe', opts.timeframe);
  qs.set('limit', String(limit));
  qs.set('start', start.toISOString());
  qs.set('end', end.toISOString());
  qs.set('feed', feed);
  qs.set('adjustment', 'raw');
  const url = `${getDataBase()}/stocks/${encodeURIComponent(symbol)}/bars?${qs}`;
  const r = await alpacaFetch<{ bars?: AlpacaBar[] }>(url, creds);
  if (!r.success) return r as AlpacaResult<AlpacaBar[]>;
  const bars = r.data.bars ?? [];
  return { success: true, status: r.status, data: bars };
}

/**
 * How far back to look so we get ≈`limit` bars for the requested timeframe.
 * Daily / hourly include a calendar pad (×1.6) for weekends + holidays so we
 * actually get the requested count of trading bars back.
 */
function barsWindowMs(
  timeframe: '1Min' | '5Min' | '15Min' | '1Hour' | '1Day',
  limit: number,
): number {
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  switch (timeframe) {
    case '1Min':  return limit * minute;
    case '5Min':  return limit * 5 * minute;
    case '15Min': return limit * 15 * minute;
    case '1Hour': return Math.ceil(limit * 1.6) * hour;
    case '1Day':  return Math.ceil(limit * 1.6) * day;
  }
}

// ============ PORTFOLIO HISTORY ============
export interface AlpacaPortfolioHistory {
  timestamp: number[];        // unix seconds
  equity: (number | null)[];  // equity at each tick
  profit_loss: (number | null)[];
  profit_loss_pct: (number | null)[];
  base_value: number;
  timeframe: string;
}

/**
 * Fetch the user's portfolio equity curve from Alpaca. Drives the marketing
 * `/api/marketing/top-trader` chart + Sharpe computation.
 *
 * `period`: e.g. '1D', '1W', '1M', '3M', '1A', 'all'
 * `timeframe`: '1Min' (only with period <= 1D), '5Min', '15Min', '1H', '1D'
 */
export function getPortfolioHistory(
  creds: AlpacaCreds,
  opts: { period?: string; timeframe?: string; extended_hours?: boolean } = {}
): Promise<AlpacaResult<AlpacaPortfolioHistory>> {
  const qs = new URLSearchParams();
  if (opts.period) qs.set('period', opts.period);
  if (opts.timeframe) qs.set('timeframe', opts.timeframe);
  if (opts.extended_hours) qs.set('extended_hours', 'true');
  const url = `${getTradingBase(creds.env)}/account/portfolio/history${qs.toString() ? `?${qs}` : ''}`;
  return alpacaFetch<AlpacaPortfolioHistory>(url, creds);
}

/** Get latest trade for a symbol — falls back to latest quote if trade isn't available. */
export async function getLatestPrice(
  creds: AlpacaCreds,
  symbol: string
): Promise<AlpacaResult<number>> {
  const tradeUrl = `${getDataBase()}/stocks/${encodeURIComponent(symbol)}/trades/latest`;
  const r = await alpacaFetch<{ trade?: { p?: number } }>(tradeUrl, creds);
  if (r.success && r.data.trade?.p) {
    return { success: true, status: r.status, data: r.data.trade.p };
  }
  const q = await getLatestQuote(creds, symbol);
  if (q.success) return { success: true, status: q.status, data: q.data.last };
  return q as AlpacaResult<number>;
}

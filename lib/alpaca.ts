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
}

export interface AlpacaOrder {
  id: string;
  client_order_id: string;
  symbol: string;
  qty: string;
  side: string;
  status: string;
  type: string;
  filled_avg_price?: string;
  filled_qty?: string;
  submitted_at: string;
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

/** Validate API credentials by hitting /account. Returns the account if valid. */
export async function validateCreds(creds: AlpacaCreds): Promise<AlpacaResult<AlpacaAccount>> {
  const r = await getAccount(creds);
  if (!r.success && r.status === 401) {
    return { ...r, error: 'Invalid Alpaca API key or secret', errorCode: 'INVALID_CREDS' };
  }
  if (!r.success && r.status === 403) {
    return { ...r, error: 'Alpaca account is not authorized for this environment (paper vs live)', errorCode: 'WRONG_ENV' };
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

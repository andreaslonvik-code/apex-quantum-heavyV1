// lib/saxo.ts - APEX QUANTUM v7 - Bulletproof Saxo Integration
// Production-grade Saxo API wrapper with safeSaxoFetch that NEVER crashes

// ============ IMPORTS ============
import { isExchangeAllowed, validateInstrumentExchange } from './exchange-validator';

// ============ ENVIRONMENT CONFIG ============
const SAXO_SIM_BASE = 'https://gateway.saxobank.com/sim/openapi';
const SAXO_LIVE_BASE = 'https://gateway.saxobank.com/openapi';

// Get current environment mode
export function getSaxoBase(): string {
  const env = process.env.SAXO_ENV || 'sim';
  return env === 'live' ? SAXO_LIVE_BASE : SAXO_SIM_BASE;
}

export function isLiveMode(): boolean {
  return process.env.SAXO_ENV === 'live';
}

// ============ TYPES ============
export interface SaxoFetchResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
  rawResponse?: string;
  status?: number;
  headers?: Record<string, string>;
}

export interface SaxoOrder {
  ticker: string;
  uic?: number;
  action: 'BUY' | 'SELL';
  quantity: number;
  priceType?: 'Market' | 'Limit';
  assetType?: string;
  accountKey: string;
}

export interface SaxoOrderResult {
  success: boolean;
  orderId?: string;
  error?: string;
  rawResponse?: string;
}

export interface SaxoPosition {
  ticker: string;
  uic: number;
  amount: number;
  avgPrice: number;
  marketValue: number;
  pnl: number;
  pnlPercent: number;
}

export interface SaxoBalance {
  cash: number;
  total: number;
  margin: number;
  currency: string;
}

export interface SaxoInstrument {
  uic: number;
  assetType: string;
  symbol: string;
  description: string;
  exchange: string;
}

export interface SaxoPrice {
  bid: number;
  ask: number;
  mid: number;
  last: number;
  change: number;
  changePercent: number;
}

// ============ DEBUG LOGGING ============
interface DebugLogEntry {
  timestamp: string;
  type: 'request' | 'response' | 'error' | 'info';
  endpoint: string;
  message: string;
  rawBody?: string;
  status?: number;
}

const debugLog: DebugLogEntry[] = [];
const MAX_DEBUG_ENTRIES = 100;

function addDebugEntry(entry: Omit<DebugLogEntry, 'timestamp'>): void {
  debugLog.unshift({
    ...entry,
    timestamp: new Date().toISOString(),
  });
  
  // Auto-purge old entries (self-cleaning)
  if (debugLog.length > MAX_DEBUG_ENTRIES) {
    debugLog.length = MAX_DEBUG_ENTRIES;
  }
}

export function getDebugLog(): DebugLogEntry[] {
  return [...debugLog];
}

export function clearDebugLog(): void {
  debugLog.length = 0;
}

// ============ BULLETPROOF SAFE SAXO FETCH ============
// This function NEVER throws - always returns a SaxoFetchResult
// Handles HTML responses, network errors, timeouts, and malformed JSON gracefully

export async function safeSaxoFetch<T = unknown>(
  endpoint: string,
  options: RequestInit & { accessToken?: string } = {}
): Promise<SaxoFetchResult<T>> {
  const base = getSaxoBase();
  const url = endpoint.startsWith('http') ? endpoint : `${base}${endpoint}`;
  
  const { accessToken, ...fetchOptions } = options;
  
  // Build headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  
  addDebugEntry({
    type: 'request',
    endpoint,
    message: `${options.method || 'GET'} ${url}`,
    rawBody: options.body ? String(options.body).slice(0, 500) : undefined,
  });
  
  let response: Response;
  let rawText = '';
  
  try {
    // Set timeout using AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
    
    response = await fetch(url, {
      ...fetchOptions,
      headers,
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    // ALWAYS read as text first to avoid JSON parse errors on HTML
    rawText = await response.text();
    
    addDebugEntry({
      type: 'response',
      endpoint,
      message: `Status: ${response.status}`,
      rawBody: rawText.slice(0, 1000),
      status: response.status,
    });
    
  } catch (fetchError) {
    const errorMsg = fetchError instanceof Error ? fetchError.message : String(fetchError);
    
    addDebugEntry({
      type: 'error',
      endpoint,
      message: `Network error: ${errorMsg}`,
    });
    
    return {
      success: false,
      error: `Network error: ${errorMsg}`,
      errorCode: 'NETWORK_ERROR',
    };
  }
  
  // Check for HTML response (common error: server returns HTML error page)
  if (rawText.trim().startsWith('<!') || rawText.trim().startsWith('<html')) {
    const errorMsg = `Saxo returned HTML instead of JSON. Status: ${response.status}. This usually means token expired or invalid endpoint.`;
    
    addDebugEntry({
      type: 'error',
      endpoint,
      message: errorMsg,
      rawBody: rawText.slice(0, 500),
      status: response.status,
    });
    
    return {
      success: false,
      error: errorMsg,
      errorCode: 'HTML_RESPONSE',
      rawResponse: rawText.slice(0, 500),
      status: response.status,
    };
  }
  
  // Check for empty response
  if (!rawText.trim()) {
    if (response.ok) {
      // Empty successful response (e.g., DELETE operations)
      return {
        success: true,
        data: {} as T,
        status: response.status,
      };
    }
    
    return {
      success: false,
      error: `Empty response with status ${response.status}`,
      errorCode: 'EMPTY_RESPONSE',
      status: response.status,
    };
  }
  
  // Try to parse JSON
  let data: T;
  try {
    data = JSON.parse(rawText);
  } catch (parseError) {
    const errorMsg = `JSON parse error: ${parseError instanceof Error ? parseError.message : String(parseError)}`;
    
    addDebugEntry({
      type: 'error',
      endpoint,
      message: errorMsg,
      rawBody: rawText.slice(0, 500),
      status: response.status,
    });
    
    return {
      success: false,
      error: errorMsg,
      errorCode: 'JSON_PARSE_ERROR',
      rawResponse: rawText.slice(0, 500),
      status: response.status,
    };
  }
  
  // Check for Saxo error response format
  if (!response.ok) {
    const saxoError = data as { ErrorInfo?: { ErrorCode?: string; Message?: string }; Message?: string; error?: string };
    const errorCode = saxoError.ErrorInfo?.ErrorCode || 'SAXO_ERROR';
    const errorMessage = saxoError.ErrorInfo?.Message || saxoError.Message || saxoError.error || `HTTP ${response.status}`;
    
    return {
      success: false,
      error: errorMessage,
      errorCode,
      rawResponse: rawText.slice(0, 1000),
      status: response.status,
      data, // Include parsed data for debugging
    };
  }
  
  return {
    success: true,
    data,
    status: response.status,
  };
}

// ============ TOKEN MANAGEMENT ============
let cachedToken: { token: string; expiresAt: number } | null = null;

export async function refreshSaxoToken(refreshToken: string): Promise<SaxoFetchResult<{ access_token: string; expires_in: number }>> {
  const clientId = process.env.SAXO_CLIENT_ID;
  const clientSecret = process.env.SAXO_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    return {
      success: false,
      error: 'Missing SAXO_CLIENT_ID or SAXO_CLIENT_SECRET',
      errorCode: 'MISSING_CONFIG',
    };
  }
  
  const base = getSaxoBase().replace('/openapi', '');
  
  const result = await safeSaxoFetch<{ access_token: string; expires_in: number; refresh_token?: string }>(
    `${base}/oauth/token`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
    }
  );
  
  if (result.success && result.data) {
    cachedToken = {
      token: result.data.access_token,
      expiresAt: Date.now() + (result.data.expires_in * 1000) - 60000, // 1 min buffer
    };
  }
  
  return result;
}

export function getCachedToken(): string | null {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }
  return null;
}

export function setCachedToken(token: string, expiresInSeconds: number): void {
  cachedToken = {
    token,
    expiresAt: Date.now() + (expiresInSeconds * 1000) - 60000,
  };
}

// ============ INSTRUMENT SEARCH ============
const uicCache: Map<string, SaxoInstrument> = new Map();

export async function findInstrument(
  accessToken: string,
  ticker: string,
  preferredExchange?: string
): Promise<SaxoFetchResult<SaxoInstrument>> {
  const cacheKey = `${ticker}_${preferredExchange || 'any'}`;
  
  if (uicCache.has(cacheKey)) {
    return { success: true, data: uicCache.get(cacheKey)! };
  }
  
  // Search patterns for multi-exchange support - APEX QUANTUM SUPPORTS STOCKS ONLY
  // Including Oslo Børs (XOSL) for Norwegian equities
  const searchPatterns = [
    ticker,
    `${ticker}:xnas`,  // NASDAQ
    `${ticker}:xnys`,  // NYSE
    `${ticker}:xosl`,  // Oslo Børs (Norway) - PRIMARY FOR NORWEGIAN STOCKS
    `${ticker}:xetr`,  // XETRA (Germany)
    `${ticker}:xhkg`,  // Hong Kong
    `${ticker}:xshg`,  // Shanghai
  ];
  
  if (preferredExchange) {
    searchPatterns.unshift(`${ticker}:${preferredExchange}`);
  }
  
  for (const keyword of searchPatterns) {
    // APEX QUANTUM: Only search for Stock assets (equities)
    // No CFD, futures, options, or other derivatives
    const result = await safeSaxoFetch<{ Data: Array<{ Identifier: number; AssetType: string; Symbol: string; Description: string; ExchangeId: string }> }>(
      `/ref/v1/instruments?Keywords=${encodeURIComponent(keyword)}&AssetTypes=Stock&$top=10`,
      { accessToken }
    );
    
    if (result.success && result.data?.Data?.length) {
      // Find exact match or first result
      const match = result.data.Data.find(i => 
        i.Symbol?.toUpperCase() === ticker.toUpperCase() ||
        i.Symbol?.toUpperCase().startsWith(`${ticker}:`)
      ) || result.data.Data[0];
      
      // APEX QUANTUM: Validate that asset type is Stock (equities)
      // Reject any CFD, futures, options, or other derivatives
      if (match.AssetType !== 'Stock') {
        addDebugEntry({
          type: 'error',
          endpoint: 'findInstrument',
          message: `Rejected non-stock asset: ${ticker} is ${match.AssetType}. APEX QUANTUM only trades equities.`,
        });
        continue; // Skip to next search pattern
      }
      
      // APEX QUANTUM: Validate exchange is in whitelist
      const exchangeValidation = validateInstrumentExchange(match.ExchangeId);
      if (!exchangeValidation.valid) {
        addDebugEntry({
          type: 'error',
          endpoint: 'findInstrument',
          message: `[EXCHANGE FILTER] ❌ ${ticker} on ${match.ExchangeId}: ${exchangeValidation.reason}`,
        });
        continue; // Skip to next search pattern
      }
      
      const instrument: SaxoInstrument = {
        uic: match.Identifier,
        assetType: match.AssetType,
        symbol: match.Symbol,
        description: match.Description,
        exchange: match.ExchangeId,
      };
      
      uicCache.set(cacheKey, instrument);
      
      addDebugEntry({
        type: 'info',
        endpoint: 'findInstrument',
        message: `[EXCHANGE FILTER] ✅ Found ${ticker}: UIC=${instrument.uic}, Exchange=${instrument.exchange}`,
      });
      
      return { success: true, data: instrument };
    }
  }
  
  return {
    success: false,
    error: `Could not find instrument: ${ticker}`,
    errorCode: 'INSTRUMENT_NOT_FOUND',
  };
}

// ============ PRICE DATA ============
export async function getPrice(
  accessToken: string,
  uic: number,
  assetType: string
): Promise<SaxoFetchResult<SaxoPrice>> {
  const result = await safeSaxoFetch<{
    Quote?: { Bid?: number; Ask?: number; Last?: number; Change?: number; ChangePercent?: number };
    PriceInfo?: { LastTraded?: number };
  }>(
    `/trade/v1/infoprices?Uic=${uic}&AssetType=${assetType}&FieldGroups=Quote,PriceInfo`,
    { accessToken }
  );
  
  if (!result.success) {
    return result as SaxoFetchResult<SaxoPrice>;
  }
  
  const quote = result.data?.Quote;
  const bid = quote?.Bid || quote?.Last || 100;
  const ask = quote?.Ask || quote?.Last || 100;
  
  return {
    success: true,
    data: {
      bid,
      ask,
      mid: (bid + ask) / 2,
      last: quote?.Last || result.data?.PriceInfo?.LastTraded || (bid + ask) / 2,
      change: quote?.Change || 0,
      changePercent: quote?.ChangePercent || 0,
    },
  };
}

// ============ ORDER PLACEMENT ============
export async function placeOrder(
  accessToken: string,
  order: SaxoOrder
): Promise<SaxoOrderResult> {
  // Find instrument if UIC not provided
  let uic = order.uic;
  let assetType = order.assetType || 'Stock';
  let exchangeId: string | undefined;
  
  // APEX QUANTUM: Force asset type to Stock (equities only)
  // This prevents any CFD, futures, or derivatives from being traded
  assetType = 'Stock';
  
  if (!uic) {
    const instrumentResult = await findInstrument(accessToken, order.ticker);
    if (!instrumentResult.success || !instrumentResult.data) {
      return {
        success: false,
        error: instrumentResult.error || `Could not find instrument: ${order.ticker}`,
      };
    }
    uic = instrumentResult.data.uic;
    assetType = instrumentResult.data.assetType;
    exchangeId = instrumentResult.data.exchange;
    
    // Validation: ensure we got a Stock asset type
    if (assetType !== 'Stock') {
      return {
        success: false,
        error: `APEX QUANTUM only trades equities (stocks). ${order.ticker} is ${assetType}.`,
      };
    }
    
    // Validation: ensure exchange is allowed
    const exchangeValidation = validateInstrumentExchange(exchangeId);
    if (!exchangeValidation.valid) {
      return {
        success: false,
        error: `[EXCHANGE FILTER] Cannot place order: ${exchangeValidation.reason}`,
      };
    }
  }
  
  const payload = {
    AccountKey: order.accountKey,
    Amount: Math.floor(Math.abs(order.quantity)),
    AssetType: assetType,
    BuySell: order.action === 'BUY' ? 'Buy' : 'Sell',
    OrderType: order.priceType || 'Market',
    OrderDuration: { DurationType: 'DayOrder' },
    Uic: uic,
    ManualOrder: false,
  };
  
  addDebugEntry({
    type: 'info',
    endpoint: 'placeOrder',
    message: `[EXCHANGE FILTER] ✅ Placing ${order.action} ${order.quantity}x ${order.ticker} on ${exchangeId} (UIC: ${uic})`,
  });
  
  const result = await safeSaxoFetch<{ OrderId: string; OrderStatus?: string }>(
    '/trade/v2/orders',
    {
      method: 'POST',
      accessToken,
      body: JSON.stringify(payload),
    }
  );
  
  if (!result.success) {
    return {
      success: false,
      error: result.error,
      rawResponse: result.rawResponse,
    };
  }
  
  return {
    success: true,
    orderId: result.data?.OrderId,
  };
}

// ============ BALANCE & POSITIONS ============
export async function getBalance(
  accessToken: string,
  accountKey: string,
  clientKey?: string
): Promise<SaxoFetchResult<SaxoBalance>> {
  const resolvedClientKey = clientKey || accountKey;
  const result = await safeSaxoFetch<{
    CashAvailableForTrading?: number;
    TotalValue?: number;
    MarginAvailableForTrading?: number;
    Currency?: string;
  }>(
    `/port/v1/balances?AccountKey=${accountKey}&ClientKey=${resolvedClientKey}`,
    { accessToken }
  );
  
  if (!result.success) {
    return result as SaxoFetchResult<SaxoBalance>;
  }
  
  return {
    success: true,
    data: {
      cash: result.data?.CashAvailableForTrading || 0,
      total: result.data?.TotalValue || 0,
      margin: result.data?.MarginAvailableForTrading || 0,
      currency: result.data?.Currency || 'NOK',
    },
  };
}

export async function getPositions(
  accessToken: string,
  clientKey: string
): Promise<SaxoFetchResult<SaxoPosition[]>> {
  const result = await safeSaxoFetch<{
    Data?: Array<{
      DisplayAndFormat?: { Symbol?: string; Description?: string };
      PositionBase?: { Amount?: number; AverageOpenPrice?: number };
      PositionView?: { MarketValue?: number; ProfitLossOnTrade?: number; ProfitLossOnTradeInPercentage?: number };
      Uic?: number;
    }>;
  }>(
    `/port/v1/positions?ClientKey=${clientKey}&FieldGroups=PositionBase,PositionView,DisplayAndFormat`,
    { accessToken }
  );
  
  if (!result.success) {
    return result as SaxoFetchResult<SaxoPosition[]>;
  }
  
  const positions: SaxoPosition[] = (result.data?.Data || []).map(pos => ({
    ticker: pos.DisplayAndFormat?.Symbol?.split(':')[0] || '',
    uic: pos.Uic || 0,
    amount: Math.abs(pos.PositionBase?.Amount || 0),
    avgPrice: pos.PositionBase?.AverageOpenPrice || 0,
    marketValue: Math.abs(pos.PositionView?.MarketValue || 0),
    pnl: pos.PositionView?.ProfitLossOnTrade || 0,
    pnlPercent: pos.PositionView?.ProfitLossOnTradeInPercentage || 0,
  }));
  
  return { success: true, data: positions };
}

// ============ SELF-CLEANING SYSTEM ============
// Auto-purge cache and logs every 10 seconds (configurable)
let purgeInterval: NodeJS.Timeout | null = null;
let lastPurgeTime = Date.now();

export function startAutoPurge(intervalMs: number = 10000): void {
  if (purgeInterval) {
    clearInterval(purgeInterval);
  }
  
  purgeInterval = setInterval(() => {
    // Clear old UIC cache entries (keep max 50)
    if (uicCache.size > 50) {
      const entries = Array.from(uicCache.entries());
      entries.slice(50).forEach(([key]) => uicCache.delete(key));
    }
    
    // Trim debug log
    if (debugLog.length > MAX_DEBUG_ENTRIES) {
      debugLog.length = MAX_DEBUG_ENTRIES;
    }
    
    lastPurgeTime = Date.now();
    
    addDebugEntry({
      type: 'info',
      endpoint: 'autoPurge',
      message: `Auto-purge completed. Cache: ${uicCache.size} entries, Log: ${debugLog.length} entries`,
    });
  }, intervalMs);
}

export function stopAutoPurge(): void {
  if (purgeInterval) {
    clearInterval(purgeInterval);
    purgeInterval = null;
  }
}

export function getLastPurgeTime(): number {
  return lastPurgeTime;
}

// ============ STATUS & HEALTH ============
export interface SaxoStatus {
  isLiveMode: boolean;
  baseUrl: string;
  hasToken: boolean;
  tokenValid: boolean;
  lastPurge: string;
  cacheSize: number;
  debugLogSize: number;
}

export function getSaxoStatus(): SaxoStatus {
  const token = getCachedToken();
  
  return {
    isLiveMode: isLiveMode(),
    baseUrl: getSaxoBase(),
    hasToken: !!token,
    tokenValid: !!token && cachedToken ? Date.now() < cachedToken.expiresAt : false,
    lastPurge: new Date(lastPurgeTime).toISOString(),
    cacheSize: uicCache.size,
    debugLogSize: debugLog.length,
  };
}

// Start auto-purge on module load in production
if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') {
  startAutoPurge(10000);
}

// APEX QUANTUM v6.2 - Bulletproof Saxo Bank API Integration
// Full error handling, retry logic, circuit breaker, and order status tracking
// Updated: 2026-04-14 20:30 CET

import { z } from 'zod';

// ============ CONFIGURATION ============
const SAXO_SIM_BASE = 'https://gateway.saxobank.com/sim/openapi';
const SAXO_LIVE_BASE = 'https://gateway.saxobank.com/openapi';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_RESET_MS = 60000;

// ============ TYPES ============
export interface OrderResult {
  success: boolean;
  orderId?: string;
  orderStatus?: 'Placed' | 'Filled' | 'PartiallyFilled' | 'Cancelled' | 'Rejected' | 'Pending';
  errorCode?: string;
  errorMessage?: string;
  uic?: number;
  executedPrice?: number;
  executedAmount?: number;
  timestamp: string;
  retryCount: number;
}

export interface Position {
  ticker: string;
  uic: number;
  amount: number;
  avgPrice: number;
  currentPrice: number;
  marketValue: number;
  pnl: number;
  pnlPercent: number;
}

export interface AccountBalance {
  cash: number;
  totalValue: number;
  marginUsed: number;
  marginAvailable: number;
  currency: string;
}

export interface Instrument {
  uic: number;
  symbol: string;
  description: string;
  assetType: string;
  exchange: string;
  currency: string;
}

// ============ ZOD SCHEMAS FOR VALIDATION ============
export const SaxoOrderResponseSchema = z.object({
  OrderId: z.string(),
  Orders: z.array(z.object({
    OrderId: z.string(),
    Status: z.string().optional(),
  })).optional(),
});

export const SaxoErrorResponseSchema = z.object({
  ErrorInfo: z.object({
    ErrorCode: z.string(),
    Message: z.string(),
  }).optional(),
  Message: z.string().optional(),
  ErrorCode: z.string().optional(),
});

export const SaxoBalanceResponseSchema = z.object({
  CashAvailableForTrading: z.number().optional(),
  TotalValue: z.number().optional(),
  MarginUsedByCurrentPositions: z.number().optional(),
  MarginAvailableForTrading: z.number().optional(),
  Currency: z.string().optional(),
});

export const SaxoPositionSchema = z.object({
  PositionId: z.string(),
  PositionBase: z.object({
    Amount: z.number(),
    AssetType: z.string(),
    Uic: z.number(),
    AverageOpenPrice: z.number().optional(),
    CurrentPrice: z.number().optional(),
    Symbol: z.string().optional(),
  }),
  PositionView: z.object({
    MarketValue: z.number().optional(),
    ProfitLossOnTrade: z.number().optional(),
    ProfitLossOnTradeInPercentage: z.number().optional(),
  }).optional(),
});

// ============ CIRCUIT BREAKER ============
class CircuitBreaker {
  private failures: number = 0;
  private lastFailureTime: number = 0;
  private isOpen: boolean = false;

  recordSuccess(): void {
    this.failures = 0;
    this.isOpen = false;
  }

  recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.failures >= CIRCUIT_BREAKER_THRESHOLD) {
      this.isOpen = true;
      console.log(`[SAXO] Circuit breaker OPEN after ${this.failures} failures`);
    }
  }

  canProceed(): boolean {
    if (!this.isOpen) return true;
    
    // Check if enough time has passed to try again
    if (Date.now() - this.lastFailureTime >= CIRCUIT_BREAKER_RESET_MS) {
      console.log(`[SAXO] Circuit breaker RESET - attempting recovery`);
      this.isOpen = false;
      this.failures = 0;
      return true;
    }
    
    return false;
  }

  getStatus(): { isOpen: boolean; failures: number; lastFailure: string } {
    return {
      isOpen: this.isOpen,
      failures: this.failures,
      lastFailure: this.lastFailureTime ? new Date(this.lastFailureTime).toISOString() : 'never',
    };
  }
}

const circuitBreaker = new CircuitBreaker();

// ============ ORDER STATUS TRACKING ============
interface OrderStatusEntry {
  orderId: string;
  ticker: string;
  action: 'Buy' | 'Sell';
  amount: number;
  status: OrderResult['orderStatus'];
  errorMessage?: string;
  timestamp: string;
  executedPrice?: number;
}

const orderHistory: OrderStatusEntry[] = [];
const MAX_ORDER_HISTORY = 100;

export function getOrderHistory(): OrderStatusEntry[] {
  return [...orderHistory];
}

export function getLastOrderStatus(): OrderStatusEntry | null {
  return orderHistory.length > 0 ? orderHistory[orderHistory.length - 1] : null;
}

function addOrderToHistory(entry: OrderStatusEntry): void {
  orderHistory.push(entry);
  if (orderHistory.length > MAX_ORDER_HISTORY) {
    orderHistory.shift();
  }
}

// ============ API HELPERS ============
function getBaseUrl(isLive: boolean): string {
  return isLive ? SAXO_LIVE_BASE : SAXO_SIM_BASE;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============ LAST API CALL TRACKING (FOR DEBUG) ============
interface LastApiCall {
  url: string;
  method: string;
  status: number;
  statusText: string;
  responseType: 'json' | 'html' | 'text' | 'error';
  rawBody: string;
  parsedData?: unknown;
  error?: string;
  timestamp: string;
}

let lastApiCall: LastApiCall | null = null;
let lastFailedApiCall: LastApiCall | null = null;

export function getLastApiCall(): LastApiCall | null {
  return lastApiCall;
}

export function getLastFailedApiCall(): LastApiCall | null {
  return lastFailedApiCall;
}

// ============ BULLETPROOF FETCH ============
// ALWAYS get text first, then try to parse as JSON
// This prevents "Unexpected token '<'" errors when API returns HTML
export interface SafeFetchResult<T = unknown> {
  ok: boolean;
  status: number;
  statusText: string;
  data?: T;
  rawBody: string;
  error?: string;
  isHtml: boolean;
}

export async function safeFetch<T = unknown>(
  url: string,
  options: RequestInit = {}
): Promise<SafeFetchResult<T>> {
  const method = options.method || 'GET';
  const timestamp = new Date().toISOString();
  
  try {
    const res = await fetch(url, options);
    
    // ALWAYS get response as text first
    const rawBody = await res.text();
    
    // Check if response is HTML (starts with < or contains <!DOCTYPE)
    const isHtml = rawBody.trim().startsWith('<') || rawBody.includes('<!DOCTYPE');
    
    // Track this API call
    const apiCall: LastApiCall = {
      url,
      method,
      status: res.status,
      statusText: res.statusText,
      responseType: isHtml ? 'html' : 'text',
      rawBody: rawBody.substring(0, 2000), // Limit stored size
      timestamp,
    };
    
    lastApiCall = apiCall;
    
    if (!res.ok) {
      const errorMsg = isHtml 
        ? `Saxo returned HTML (${res.status}): ${rawBody.substring(0, 200)}`
        : `Saxo error (${res.status}): ${rawBody.substring(0, 500)}`;
      
      apiCall.error = errorMsg;
      lastFailedApiCall = apiCall;
      
      console.error(`[SAXO FETCH] FAILED ${method} ${url}`);
      console.error(`[SAXO FETCH] Status: ${res.status} ${res.statusText}`);
      console.error(`[SAXO FETCH] Body (first 500 chars): ${rawBody.substring(0, 500)}`);
      
      return {
        ok: false,
        status: res.status,
        statusText: res.statusText,
        rawBody,
        error: errorMsg,
        isHtml,
      };
    }
    
    // Try to parse as JSON
    if (!isHtml && rawBody.trim()) {
      try {
        const data = JSON.parse(rawBody) as T;
        apiCall.responseType = 'json';
        apiCall.parsedData = data;
        return {
          ok: true,
          status: res.status,
          statusText: res.statusText,
          data,
          rawBody,
          isHtml: false,
        };
      } catch (parseError) {
        const errorMsg = `JSON parse failed: ${parseError}. Raw: ${rawBody.substring(0, 200)}`;
        apiCall.error = errorMsg;
        apiCall.responseType = 'text';
        lastFailedApiCall = apiCall;
        
        console.error(`[SAXO FETCH] JSON PARSE ERROR for ${url}`);
        console.error(`[SAXO FETCH] Raw body: ${rawBody.substring(0, 500)}`);
        
        return {
          ok: false,
          status: res.status,
          statusText: res.statusText,
          rawBody,
          error: errorMsg,
          isHtml: false,
        };
      }
    }
    
    // Empty or HTML response
    if (isHtml) {
      const errorMsg = `Received HTML instead of JSON. Status: ${res.status}. Body: ${rawBody.substring(0, 200)}`;
      apiCall.error = errorMsg;
      lastFailedApiCall = apiCall;
      
      console.error(`[SAXO FETCH] RECEIVED HTML for ${url}`);
      console.error(`[SAXO FETCH] Body: ${rawBody.substring(0, 500)}`);
      
      return {
        ok: false,
        status: res.status,
        statusText: res.statusText,
        rawBody,
        error: errorMsg,
        isHtml: true,
      };
    }
    
    return {
      ok: true,
      status: res.status,
      statusText: res.statusText,
      rawBody,
      isHtml: false,
    };
    
  } catch (networkError) {
    const errorMsg = `Network error: ${networkError}`;
    const apiCall: LastApiCall = {
      url,
      method,
      status: 0,
      statusText: 'Network Error',
      responseType: 'error',
      rawBody: '',
      error: errorMsg,
      timestamp,
    };
    lastApiCall = apiCall;
    lastFailedApiCall = apiCall;
    
    console.error(`[SAXO FETCH] NETWORK ERROR for ${url}: ${networkError}`);
    
    return {
      ok: false,
      status: 0,
      statusText: 'Network Error',
      rawBody: '',
      error: errorMsg,
      isHtml: false,
    };
  }
}

// ============ MAIN SAXO CLIENT ============
export class SaxoClient {
  private accessToken: string;
  private accountKey: string;
  private clientKey: string;
  private isLive: boolean;
  private baseUrl: string;

  constructor(accessToken: string, accountKey: string, clientKey?: string, isLive: boolean = false) {
    this.accessToken = accessToken;
    this.accountKey = accountKey;
    this.clientKey = clientKey || accountKey;
    this.isLive = isLive;
    this.baseUrl = getBaseUrl(isLive);
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retryCount: number = 0
  ): Promise<{ data?: T; error?: string; status: number }> {
    if (!circuitBreaker.canProceed()) {
      return {
        error: 'Circuit breaker is open - too many recent failures',
        status: 503,
      };
    }

    try {
      const url = `${this.baseUrl}${endpoint}`;
      const res = await fetch(url, {
        ...options,
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      const responseText = await res.text();
      
      if (!res.ok) {
        console.log(`[SAXO] Request failed (${res.status}): ${endpoint}`);
        console.log(`[SAXO] Response: ${responseText.substring(0, 500)}`);
        
        // Parse error response
        let errorMessage = responseText;
        try {
          const errorData = JSON.parse(responseText);
          const parsed = SaxoErrorResponseSchema.safeParse(errorData);
          if (parsed.success) {
            if (parsed.data.ErrorInfo) {
              errorMessage = `${parsed.data.ErrorInfo.ErrorCode}: ${parsed.data.ErrorInfo.Message}`;
            } else if (parsed.data.Message) {
              errorMessage = parsed.data.Message;
            }
          }
        } catch {}

        // Retry on specific errors
        const shouldRetry = 
          res.status >= 500 || 
          res.status === 429 ||
          errorMessage.includes('timeout') ||
          errorMessage.includes('temporarily');

        if (shouldRetry && retryCount < MAX_RETRIES) {
          console.log(`[SAXO] Retrying (${retryCount + 1}/${MAX_RETRIES})...`);
          await sleep(RETRY_DELAY_MS * (retryCount + 1));
          return this.request(endpoint, options, retryCount + 1);
        }

        circuitBreaker.recordFailure();
        return { error: errorMessage, status: res.status };
      }

      circuitBreaker.recordSuccess();
      
      if (!responseText) {
        return { data: {} as T, status: res.status };
      }
      
      const data = JSON.parse(responseText);
      return { data, status: res.status };
    } catch (error) {
      console.log(`[SAXO] Network error: ${error}`);
      
      if (retryCount < MAX_RETRIES) {
        console.log(`[SAXO] Retrying after network error (${retryCount + 1}/${MAX_RETRIES})...`);
        await sleep(RETRY_DELAY_MS * (retryCount + 1));
        return this.request(endpoint, options, retryCount + 1);
      }

      circuitBreaker.recordFailure();
      return { error: String(error), status: 0 };
    }
  }

  // ============ FIND INSTRUMENT ============
  async findInstrument(symbol: string, assetType: string = 'Stock'): Promise<Instrument | null> {
    // Try direct symbol search first
    const ticker = symbol.split(':')[0];
    
    const { data, error } = await this.request<any>(
      `/ref/v1/instruments?Keywords=${encodeURIComponent(ticker)}&AssetTypes=${assetType}`
    );

    if (error || !data?.Data?.length) {
      console.log(`[SAXO] Instrument not found: ${symbol}`);
      return null;
    }

    // Find best match
    const instrument = data.Data.find((i: any) => 
      i.Symbol === ticker || i.Symbol === symbol
    ) || data.Data[0];

    return {
      uic: instrument.Identifier,
      symbol: instrument.Symbol,
      description: instrument.Description,
      assetType: instrument.AssetType,
      exchange: instrument.ExchangeId,
      currency: instrument.CurrencyCode,
    };
  }

  // ============ GET PRICE ============
  async getPrice(uic: number, assetType: string): Promise<{ bid: number; ask: number; mid: number; last: number }> {
    const { data, error } = await this.request<any>(
      `/trade/v1/infoPrices?Uic=${uic}&AssetType=${assetType}&FieldGroups=PriceInfo,Quote`
    );

    if (error || !data) {
      return { bid: 0, ask: 0, mid: 0, last: 0 };
    }

    const quote = data.Quote || {};
    const bid = quote.Bid || data.PriceInfo?.Low || 0;
    const ask = quote.Ask || data.PriceInfo?.High || 0;
    const mid = (bid + ask) / 2 || data.PriceInfo?.LastTraded || 0;
    const last = data.PriceInfo?.LastTraded || mid;

    return { bid, ask, mid, last };
  }

  // ============ GET BALANCE ============
  async getBalance(): Promise<AccountBalance> {
    const { data, error } = await this.request<any>(
      `/port/v1/balances?AccountKey=${this.accountKey}&ClientKey=${this.clientKey}`
    );

    if (error || !data) {
      return {
        cash: 0,
        totalValue: 0,
        marginUsed: 0,
        marginAvailable: 0,
        currency: 'NOK',
      };
    }

    return {
      cash: data.CashAvailableForTrading || 0,
      totalValue: data.TotalValue || 0,
      marginUsed: data.MarginUsedByCurrentPositions || 0,
      marginAvailable: data.MarginAvailableForTrading || 0,
      currency: data.Currency || 'NOK',
    };
  }

  // ============ GET POSITIONS ============
  async getPositions(): Promise<Position[]> {
    const { data, error } = await this.request<any>(
      `/port/v1/positions?ClientKey=${this.clientKey}&FieldGroups=PositionBase,PositionView`
    );

    if (error || !data?.Data) {
      return [];
    }

    return data.Data.map((p: any) => {
      const base = p.PositionBase || {};
      const view = p.PositionView || {};
      
      return {
        ticker: base.Symbol || `UIC:${base.Uic}`,
        uic: base.Uic,
        amount: base.Amount || 0,
        avgPrice: base.AverageOpenPrice || 0,
        currentPrice: base.CurrentPrice || base.AverageOpenPrice || 0,
        marketValue: view.MarketValue || 0,
        pnl: view.ProfitLossOnTrade || 0,
        pnlPercent: view.ProfitLossOnTradeInPercentage || 0,
      };
    });
  }

  // ============ PLACE ORDER (BULLETPROOF) ============
  async placeOrder(
    uic: number,
    assetType: string,
    amount: number,
    buySell: 'Buy' | 'Sell',
    ticker: string,
    reason: string
  ): Promise<OrderResult> {
    const timestamp = new Date().toISOString();
    let retryCount = 0;

    console.log(`[SAXO] ========== ORDRE START ==========`);
    console.log(`[SAXO] ${buySell} ${amount} ${ticker} (UIC=${uic}, Type=${assetType})`);
    console.log(`[SAXO] Grunn: ${reason}`);
    console.log(`[SAXO] Mode: ${this.isLive ? 'LIVE' : 'SIM'}`);

    const body = {
      AccountKey: this.accountKey,
      Amount: Math.floor(Math.abs(amount)),
      AssetType: assetType,
      BuySell: buySell,
      OrderType: 'Market',
      OrderDuration: { DurationType: 'DayOrder' },
      Uic: uic,
      ManualOrder: false,
    };

    console.log(`[SAXO] Request body: ${JSON.stringify(body)}`);

    const { data, error, status } = await this.request<any>(
      '/trade/v2/orders',
      { method: 'POST', body: JSON.stringify(body) },
      retryCount
    );

    const result: OrderResult = {
      success: false,
      timestamp,
      retryCount,
    };

    if (error) {
      console.log(`[SAXO] ORDRE FEILET: ${error}`);
      
      result.errorCode = status.toString();
      result.errorMessage = error;
      result.orderStatus = 'Rejected';

      // Specific error handling
      if (error.includes('InsufficientMargin') || error.includes('insufficient')) {
        result.errorCode = 'INSUFFICIENT_MARGIN';
        result.errorMessage = 'Ikke nok margin/kapital for denne ordren';
      } else if (error.includes('MarketClosed') || error.includes('market is closed')) {
        result.errorCode = 'MARKET_CLOSED';
        result.errorMessage = 'Markedet er stengt';
      } else if (error.includes('InvalidInstrument') || error.includes('not found')) {
        result.errorCode = 'INVALID_INSTRUMENT';
        result.errorMessage = 'Ugyldig instrument';
      } else if (error.includes('RejectedByExchange')) {
        result.errorCode = 'EXCHANGE_REJECTED';
        result.errorMessage = 'Avvist av børsen';
      }

      // Add to history
      addOrderToHistory({
        orderId: '',
        ticker,
        action: buySell,
        amount,
        status: 'Rejected',
        errorMessage: result.errorMessage,
        timestamp,
      });

      console.log(`[SAXO] ========== ORDRE FEIL ==========`);
      return result;
    }

    // Success!
    const parsed = SaxoOrderResponseSchema.safeParse(data);
    
    if (parsed.success) {
      result.success = true;
      result.orderId = parsed.data.OrderId;
      result.orderStatus = 'Placed';
      result.uic = uic;

      console.log(`[SAXO] ORDRE SUKSESS! OrderId: ${result.orderId}`);
      
      // Add to history
      addOrderToHistory({
        orderId: result.orderId || '',
        ticker,
        action: buySell,
        amount,
        status: 'Placed',
        timestamp,
      });
    } else {
      console.log(`[SAXO] Kunne ikke parse respons: ${JSON.stringify(data)}`);
      result.errorMessage = 'Kunne ikke tolke Saxo-respons';
      result.orderStatus = 'Rejected';
    }

    console.log(`[SAXO] ========== ORDRE SLUTT ==========`);
    return result;
  }

  // ============ GET ORDER STATUS ============
  async getOrderStatus(orderId: string): Promise<{ status: string; filledAmount?: number; filledPrice?: number }> {
    const { data, error } = await this.request<any>(
      `/port/v1/orders/${this.clientKey}/${orderId}`
    );

    if (error || !data) {
      return { status: 'Unknown' };
    }

    return {
      status: data.Status || 'Unknown',
      filledAmount: data.FilledAmount,
      filledPrice: data.FilledPrice,
    };
  }

  // ============ CIRCUIT BREAKER STATUS ============
  getCircuitBreakerStatus() {
    return circuitBreaker.getStatus();
  }
}

// ============ SINGLETON FACTORY ============
let currentClient: SaxoClient | null = null;

export function getSaxoClient(
  accessToken: string,
  accountKey: string,
  clientKey?: string,
  isLive: boolean = false
): SaxoClient {
  // Create new client if credentials changed
  if (!currentClient || 
      currentClient['accessToken'] !== accessToken || 
      currentClient['accountKey'] !== accountKey) {
    currentClient = new SaxoClient(accessToken, accountKey, clientKey, isLive);
  }
  return currentClient;
}

// ============ DEAD LETTER QUEUE ============
interface DeadLetterEntry {
  orderId?: string;
  ticker: string;
  action: 'Buy' | 'Sell';
  amount: number;
  error: string;
  timestamp: string;
  retryCount: number;
}

const deadLetterQueue: DeadLetterEntry[] = [];

export function addToDeadLetterQueue(entry: DeadLetterEntry): void {
  deadLetterQueue.push(entry);
  console.log(`[SAXO] Added to dead letter queue: ${entry.ticker} ${entry.action} ${entry.amount}`);
}

export function getDeadLetterQueue(): DeadLetterEntry[] {
  return [...deadLetterQueue];
}

export function clearDeadLetterQueue(): void {
  deadLetterQueue.length = 0;
}

// ============ EXPORTS FOR MONITORING ============
export function getSystemStatus() {
  return {
    circuitBreaker: circuitBreaker.getStatus(),
    orderHistoryCount: orderHistory.length,
    deadLetterQueueCount: deadLetterQueue.length,
    lastOrder: getLastOrderStatus(),
  };
}

// APEX QUANTUM v6.2 - Clean Saxo Bank API
// Uses 24-hour developer token from process.env.SAXO_ACCESS_TOKEN

const SAXO_SIM_BASE = 'https://gateway.saxobank.com/sim/openapi';
const SAXO_LIVE_BASE = 'https://gateway.saxobank.com/openapi';

// ============ TYPES ============
export interface OrderResult {
  success: boolean;
  orderId?: string;
  orderStatus?: 'Placed' | 'Filled' | 'Rejected' | 'Pending';
  errorMessage?: string;
  uic?: number;
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
  currency: string;
}

// ============ HELPERS ============
function getBaseUrl(): string {
  const env = process.env.SAXO_ENV || 'SIM';
  return env === 'LIVE' ? SAXO_LIVE_BASE : SAXO_SIM_BASE;
}

function getToken(): string | null {
  return process.env.SAXO_ACCESS_TOKEN || null;
}

// Safe fetch - always gets text first, then parses JSON
async function safeFetch<T>(
  url: string,
  options: RequestInit = {}
): Promise<{ ok: boolean; status: number; data?: T; error?: string }> {
  try {
    const res = await fetch(url, options);
    const text = await res.text();
    
    if (!res.ok) {
      const isHtml = text.trim().startsWith('<');
      console.error(`[SAXO] Error ${res.status}: ${isHtml ? 'HTML response' : text.substring(0, 200)}`);
      return { ok: false, status: res.status, error: text.substring(0, 300) };
    }
    
    if (!text.trim()) {
      return { ok: true, status: res.status };
    }
    
    try {
      return { ok: true, status: res.status, data: JSON.parse(text) as T };
    } catch {
      return { ok: false, status: res.status, error: 'JSON parse failed' };
    }
  } catch (e) {
    console.error(`[SAXO] Network error: ${e}`);
    return { ok: false, status: 0, error: String(e) };
  }
}

// ============ GET ACCOUNT INFO (auto-fetches accountKey) ============
export async function getAccountInfo(): Promise<{ accountKey: string; clientKey: string; balance: number; currency: string } | null> {
  const token = getToken();
  if (!token) {
    console.error('[SAXO] No SAXO_ACCESS_TOKEN');
    return null;
  }
  
  // Fetch accounts from API - this gives us accountKey
  const result = await safeFetch<{ Data?: Array<{ AccountKey: string; ClientKey: string; AccountId: string }> }>(
    `${getBaseUrl()}/port/v1/accounts/me`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  
  if (!result.ok || !result.data?.Data?.length) {
    console.error('[SAXO] Failed to get accounts:', result.error);
    return null;
  }
  
  const account = result.data.Data[0];
  console.log(`[SAXO] Account: ${account.AccountKey}`);
  
  // Get balance
  const balResult = await safeFetch<{ TotalValue?: number; CashBalance?: number; Currency?: string }>(
    `${getBaseUrl()}/port/v1/balances?AccountKey=${account.AccountKey}&ClientKey=${account.ClientKey}`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  
  return {
    accountKey: account.AccountKey,
    clientKey: account.ClientKey,
    balance: balResult.data?.TotalValue || balResult.data?.CashBalance || 0,
    currency: balResult.data?.Currency || 'USD',
  };
}

// ============ GET POSITIONS ============
export async function getPositions(): Promise<Position[]> {
  const token = getToken();
  const account = await getAccountInfo();
  if (!token || !account) return [];
  
  const result = await safeFetch<{ Data?: Array<{
    PositionBase: { Uic: number; Amount: number; Symbol?: string; AverageOpenPrice?: number; CurrentPrice?: number };
    PositionView?: { MarketValue?: number; ProfitLossOnTrade?: number; ProfitLossOnTradeInPercentage?: number };
  }> }>(
    `${getBaseUrl()}/port/v1/positions?ClientKey=${account.clientKey}&FieldGroups=PositionBase,PositionView`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  
  if (!result.ok || !result.data?.Data) return [];
  
  return result.data.Data.map(p => ({
    ticker: p.PositionBase.Symbol || `UIC:${p.PositionBase.Uic}`,
    uic: p.PositionBase.Uic,
    amount: p.PositionBase.Amount,
    avgPrice: p.PositionBase.AverageOpenPrice || 0,
    currentPrice: p.PositionBase.CurrentPrice || 0,
    marketValue: p.PositionView?.MarketValue || 0,
    pnl: p.PositionView?.ProfitLossOnTrade || 0,
    pnlPercent: p.PositionView?.ProfitLossOnTradeInPercentage || 0,
  }));
}

// ============ FIND INSTRUMENT ============
export async function findInstrument(ticker: string, assetType: string = 'Stock'): Promise<{ uic: number; assetType: string; symbol: string } | null> {
  const token = getToken();
  if (!token) return null;
  
  const searches = [ticker, `${ticker}:xnas`, `${ticker}:xnys`, `${ticker}:xosl`];
  
  for (const kw of searches) {
    const result = await safeFetch<{ Data?: Array<{ Identifier: number; AssetType: string; Symbol: string }> }>(
      `${getBaseUrl()}/ref/v1/instruments?Keywords=${encodeURIComponent(kw)}&AssetTypes=${assetType}&$top=5`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    
    if (result.ok && result.data?.Data?.length) {
      const match = result.data.Data.find(i => i.Symbol?.toUpperCase().startsWith(ticker.toUpperCase())) || result.data.Data[0];
      console.log(`[SAXO] Found ${ticker}: UIC=${match.Identifier}`);
      return { uic: match.Identifier, assetType: match.AssetType, symbol: match.Symbol };
    }
  }
  
  return null;
}

// ============ GET PRICE ============
export async function getPrice(uic: number, assetType: string): Promise<{ bid: number; ask: number; mid: number }> {
  const token = getToken();
  if (!token) return { bid: 0, ask: 0, mid: 0 };
  
  const result = await safeFetch<{ Quote?: { Bid?: number; Ask?: number; Last?: number } }>(
    `${getBaseUrl()}/trade/v1/infoprices?Uic=${uic}&AssetType=${assetType}&FieldGroups=Quote`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  
  const bid = result.data?.Quote?.Bid || result.data?.Quote?.Last || 0;
  const ask = result.data?.Quote?.Ask || result.data?.Quote?.Last || 0;
  return { bid, ask, mid: (bid + ask) / 2 };
}

// ============ PLACE ORDER ============
export async function placeOrder(
  uic: number,
  assetType: string,
  buySell: 'Buy' | 'Sell',
  amount: number
): Promise<OrderResult> {
  const token = getToken();
  if (!token) return { success: false, errorMessage: 'No token' };
  
  const account = await getAccountInfo();
  if (!account) return { success: false, errorMessage: 'No account' };
  
  const body = {
    AccountKey: account.accountKey,
    Uic: uic,
    AssetType: assetType,
    BuySell: buySell,
    Amount: Math.floor(Math.abs(amount)),
    OrderType: 'Market',
    OrderDuration: { DurationType: 'DayOrder' },
    ManualOrder: false,
  };
  
  console.log(`[SAXO] Placing ${buySell} order: UIC=${uic}, Amount=${amount}`);
  
  const result = await safeFetch<{ OrderId?: string; Orders?: Array<{ OrderId: string }> }>(
    `${getBaseUrl()}/trade/v2/orders`,
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
  
  if (!result.ok) {
    console.error(`[SAXO] Order failed: ${result.error}`);
    return { success: false, errorMessage: result.error, uic };
  }
  
  const orderId = result.data?.OrderId || result.data?.Orders?.[0]?.OrderId;
  console.log(`[SAXO] Order success: ${orderId}`);
  return { success: true, orderId, orderStatus: 'Placed', uic };
}

// ============ VALIDATE TOKEN ============
export async function validateToken(): Promise<{ valid: boolean; accountKey?: string; error?: string }> {
  const account = await getAccountInfo();
  if (!account) return { valid: false, error: 'Token invalid or expired' };
  return { valid: true, accountKey: account.accountKey };
}

// ============ GET BALANCE ============
export async function getBalance(): Promise<AccountBalance> {
  const account = await getAccountInfo();
  return {
    cash: account?.balance || 0,
    totalValue: account?.balance || 0,
    currency: account?.currency || 'USD',
  };
}

// ============ LEGACY EXPORTS FOR COMPATIBILITY ============
export function getOrderHistory() { return []; }
export function getLastOrderStatus() { return null; }
export function getSystemStatus() { return { status: 'OK' }; }
export function getDeadLetterQueue() { return []; }

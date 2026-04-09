import { NextResponse } from 'next/server';

// Saxo SIM API
const SAXO_API_BASE = 'https://gateway.saxobank.com/sim/openapi';

// Symbol mapping for US and Oslo Bors
const SAXO_SYMBOLS: Record<string, string> = {
  // US
  'MU': 'MU:xnas', 'CEG': 'CEG:xnas', 'VRT': 'VRT:xnys',
  'RKLB': 'RKLB:xnas', 'LMND': 'LMND:xnas',
  // Oslo Bors
  'EQNR': 'EQNR:xosl', 'MOWI': 'MOWI:xosl', 'NEL': 'NEL:xosl',
  'NODC': 'NODC:xosl', 'AKRBP': 'AKRBP:xosl', 'NAS': 'NAS:xosl',
};

// Portfolio targets
const TARGETS = [
  { ticker: 'MU', vekt: 45 }, { ticker: 'CEG', vekt: 12 }, { ticker: 'VRT', vekt: 8 },
  { ticker: 'RKLB', vekt: 3 }, { ticker: 'LMND', vekt: 2 },
  { ticker: 'EQNR', vekt: 8 }, { ticker: 'MOWI', vekt: 5 }, { ticker: 'NEL', vekt: 5 },
  { ticker: 'NODC', vekt: 5 }, { ticker: 'AKRBP', vekt: 4 }, { ticker: 'NAS', vekt: 3 },
];

// Helper: sleep
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// Helper: find instrument
async function findInstrument(token: string, ticker: string) {
  const symbol = SAXO_SYMBOLS[ticker] || ticker;
  const res = await fetch(
    `${SAXO_API_BASE}/ref/v1/instruments?Keywords=${encodeURIComponent(symbol)}&AssetTypes=Stock,CfdOnStock`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.Data?.length) return null;
  const inst = data.Data[0];
  return { uic: inst.Identifier, assetType: inst.AssetType };
}

// Helper: get price
async function getPrice(token: string, uic: number, assetType: string): Promise<number> {
  try {
    const res = await fetch(
      `${SAXO_API_BASE}/trade/v1/infoprices?Uic=${uic}&AssetType=${assetType}&FieldGroups=Quote`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    if (!res.ok) return 0;
    const data = await res.json();
    return data.Quote?.Ask || data.Quote?.Mid || 0;
  } catch { return 0; }
}

// Helper: place order
async function placeOrder(token: string, accountKey: string, uic: number, assetType: string, amount: number, buySell: 'Buy' | 'Sell') {
  try {
    const res = await fetch(`${SAXO_API_BASE}/trade/v1/orders`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        AccountKey: accountKey,
        Amount: Math.floor(amount),
        AssetType: assetType,
        BuySell: buySell,
        OrderType: 'Market',
        OrderDuration: { DurationType: 'DayOrder' },
        Uic: uic,
        ManualOrder: false,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.OrderId;
  } catch { return null; }
}

// Single trading scan
async function executeTradingScan(token: string, accountKey: string, scanNumber: number) {
  const results: string[] = [];
  
  // Pick 2-4 random tickers for this scan
  const shuffled = [...TARGETS].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, 2 + Math.floor(Math.random() * 3));
  
  for (const target of selected) {
    const inst = await findInstrument(token, target.ticker);
    if (!inst) continue;
    
    const price = await getPrice(token, inst.uic, inst.assetType);
    if (price <= 0) continue;
    
    // Random momentum decision
    const momentum = Math.random();
    const action = momentum > 0.4 ? 'Buy' : 'Sell';
    const amount = 3 + Math.floor(Math.random() * 12);
    
    const orderId = await placeOrder(token, accountKey, inst.uic, inst.assetType, amount, action);
    
    if (orderId) {
      results.push(`Scan ${scanNumber}: ${action} ${amount}x ${target.ticker} @ ${price.toFixed(2)} [${orderId}]`);
    }
  }
  
  return results;
}

// Cron endpoint - runs every minute with 25x 2-sec iterations
export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Get stored credentials from env (for cron jobs)
  const token = process.env.APEX_SAXO_TOKEN;
  const accountKey = process.env.APEX_SAXO_ACCOUNT_KEY;
  
  if (!token || !accountKey) {
    return NextResponse.json({ 
      error: 'Missing APEX_SAXO_TOKEN or APEX_SAXO_ACCOUNT_KEY env vars',
      note: 'Set these in Vercel dashboard for cron jobs to work',
    }, { status: 400 });
  }
  
  const startTime = Date.now();
  const allResults: string[] = [];
  const ITERATIONS = 25; // 25 iterations x 2 sec = 50 sec (under 60 sec limit)
  
  console.log(`[CRON] Starting ${ITERATIONS} trading scans (US + Oslo Bors)`);
  
  for (let i = 1; i <= ITERATIONS; i++) {
    try {
      const scanResults = await executeTradingScan(token, accountKey, i);
      allResults.push(...scanResults);
      
      if (scanResults.length > 0) {
        console.log(`[CRON] ${scanResults.join(' | ')}`);
      }
      
      // Wait 2 seconds before next scan (except last)
      if (i < ITERATIONS) {
        await sleep(2000);
      }
    } catch (e) {
      console.error(`[CRON] Scan ${i} error:`, e);
    }
  }
  
  const elapsed = Date.now() - startTime;
  
  return NextResponse.json({
    success: true,
    scans: ITERATIONS,
    trades: allResults.length,
    results: allResults.slice(-20), // Last 20 trades
    elapsed: `${elapsed}ms`,
    markets: ['US (NASDAQ/NYSE)', 'Oslo Bors'],
  });
}

import { NextResponse } from 'next/server';

// Saxo SIM API
const SAXO_API_BASE = 'https://gateway.saxobank.com/sim/openapi';

// KNOWN INSTRUMENT UICs - Verified from Saxo API
const KNOWN_INSTRUMENTS: Record<string, { uic: number; assetType: string; vekt: number; market: string }> = {
  // US Stocks - Verified UICs
  'MU': { uic: 42315, assetType: 'CfdOnStock', vekt: 45, market: 'US' },
  'CEG': { uic: 4928320, assetType: 'CfdOnStock', vekt: 12, market: 'US' },
  'VRT': { uic: 21608197, assetType: 'CfdOnStock', vekt: 8, market: 'US' },
  'RKLB': { uic: 24083767, assetType: 'CfdOnStock', vekt: 3, market: 'US' },
  'LMND': { uic: 21177364, assetType: 'CfdOnStock', vekt: 2, market: 'US' },
};

// Helper: sleep
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// Helper: place order
async function placeOrder(token: string, accountKey: string, uic: number, assetType: string, amount: number, buySell: 'Buy' | 'Sell') {
  try {
    const res = await fetch(`${SAXO_API_BASE}/trade/v2/orders`, {
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

// Single trading scan - uses KNOWN UICs directly, no search needed
async function executeTradingScan(token: string, accountKey: string, scanNumber: number) {
  const results: string[] = [];
  const tickers = Object.keys(KNOWN_INSTRUMENTS);
  
  // Pick 2-4 random tickers for this scan
  const shuffled = tickers.sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, 2 + Math.floor(Math.random() * 3));
  
  for (const ticker of selected) {
    const inst = KNOWN_INSTRUMENTS[ticker];
    
    // Random momentum decision: 60% buy, 40% sell
    const action = Math.random() > 0.4 ? 'Buy' : 'Sell';
    const amount = 3 + Math.floor(Math.random() * 12);
    
    const orderId = await placeOrder(token, accountKey, inst.uic, inst.assetType, amount, action);
    
    if (orderId) {
      results.push(`Scan ${scanNumber}: ${action} ${amount}x ${ticker} (${inst.market}) [${orderId}]`);
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

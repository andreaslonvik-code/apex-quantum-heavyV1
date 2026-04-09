import { NextResponse } from 'next/server';

// Saxo SIM API
const SAXO_API_BASE = 'https://gateway.saxobank.com/sim/openapi';

// APEX QUANTUM v6.1 Blueprint with Saxo symbols
const APEX_BLUEPRINT: Record<string, {
  uic: number;
  assetType: string;
  saxoSymbol: string;
  vekt: number;
}> = {
  'MU': { uic: 42315, assetType: 'CfdOnStock', saxoSymbol: 'MU:xnas', vekt: 45 },
  'CEG': { uic: 4928320, assetType: 'CfdOnStock', saxoSymbol: 'CEG:xnas', vekt: 12 },
  'VRT': { uic: 21608197, assetType: 'CfdOnStock', saxoSymbol: 'VRT:xnys', vekt: 8 },
  'RKLB': { uic: 24083767, assetType: 'CfdOnStock', saxoSymbol: 'RKLB:xnas', vekt: 3 },
  'LMND': { uic: 21177364, assetType: 'CfdOnStock', saxoSymbol: 'LMND:xnas', vekt: 2 },
};

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// Place order to Saxo
async function placeOrder(
  token: string,
  accountKey: string,
  uic: number,
  assetType: string,
  amount: number,
  buySell: 'Buy' | 'Sell',
  saxoSymbol: string
): Promise<string | null> {
  try {
    const res = await fetch(`${SAXO_API_BASE}/trade/v2/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
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

    if (!res.ok) {
      console.log(`[CRON] Order FAILED for ${saxoSymbol}: ${res.status}`);
      return null;
    }

    const data = await res.json();
    console.log(`[CRON] >>> Utforer: ${buySell.toUpperCase()} ${amount}x ${saxoSymbol} [${data.OrderId}]`);
    return data.OrderId;
  } catch (e) {
    console.log(`[CRON] Order ERROR: ${e}`);
    return null;
  }
}

// Single trading scan with multiple signals
async function executeTradingScan(token: string, accountKey: string, scanNumber: number) {
  const results: string[] = [];
  const tickers = Object.keys(APEX_BLUEPRINT);
  
  // Pick 2-4 random tickers for this scan
  const shuffled = [...tickers].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, 2 + Math.floor(Math.random() * 3));
  
  for (const ticker of selected) {
    const info = APEX_BLUEPRINT[ticker];
    
    // Active trading: 65% buy, 35% sell
    const momentum = Math.random();
    const action = momentum > 0.35 ? 'Buy' : 'Sell';
    const amount = 5 + Math.floor(Math.random() * 15);
    
    const orderId = await placeOrder(
      token,
      accountKey,
      info.uic,
      info.assetType,
      amount,
      action,
      info.saxoSymbol
    );
    
    if (orderId) {
      results.push(`Scan ${scanNumber}: ${action} ${amount}x ${info.saxoSymbol} [${orderId}]`);
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
      error: 'Missing APEX_SAXO_TOKEN or APEX_SAXO_ACCOUNT_KEY',
      help: 'Set these in Vercel Environment Variables for cron to work',
    }, { status: 400 });
  }
  
  const startTime = Date.now();
  const allResults: string[] = [];
  const ITERATIONS = 25; // 25 iterations x 2 sec = ~50 sec
  
  console.log(`[CRON] ========== APEX QUANTUM v6.1 CRON START ==========`);
  console.log(`[CRON] Running ${ITERATIONS} scans with 2-sec intervals`);
  
  let totalOrders = 0;
  
  for (let i = 1; i <= ITERATIONS; i++) {
    try {
      const scanResults = await executeTradingScan(token, accountKey, i);
      allResults.push(...scanResults);
      totalOrders += scanResults.length;
      
      // Wait 2 seconds before next scan (except last)
      if (i < ITERATIONS) {
        await sleep(2000);
      }
    } catch (e) {
      console.error(`[CRON] Scan ${i} error:`, e);
    }
  }
  
  const elapsed = Date.now() - startTime;
  
  console.log(`[CRON] ========== CRON COMPLETE ==========`);
  console.log(`[CRON] ${totalOrders} orders in ${elapsed}ms`);
  
  return NextResponse.json({
    success: true,
    version: 'APEX QUANTUM v6.1',
    scans: ITERATIONS,
    totalOrders,
    results: allResults.slice(-30),
    elapsed: `${elapsed}ms`,
    blueprint: Object.entries(APEX_BLUEPRINT).map(([ticker, info]) => ({
      ticker,
      saxoSymbol: info.saxoSymbol,
      vekt: info.vekt,
    })),
  });
}

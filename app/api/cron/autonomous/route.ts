import { NextRequest, NextResponse } from 'next/server';

// APEX QUANTUM 24/7 HIGH-FREQUENCY TRADING CRON
// Runs every minute, executes 30 trading cycles (2 seconds each) per invocation
// Total: ~30 trades per minute = 1800 scans per hour

const SAXO_API_BASE = 'https://gateway.saxobank.com/sim/openapi';
const SCAN_INTERVAL_MS = 2000; // 2 seconds between scans
const SCANS_PER_INVOCATION = 25; // 25 scans x 2 sec = 50 seconds (leave buffer for API latency)

// Sleep utility
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Saxo symbol mapping
const SAXO_SYMBOLS: Record<string, string> = {
  'MU': 'MU:xnas',
  'CEG': 'CEG:xnas',
  'VRT': 'VRT:xnys',
  'RKLB': 'RKLB:xnas',
  'LMND': 'LMND:xnas',
  'ABSI': 'ABSI:xnas',
};

// Target portfolio weights
const TARGET_PORTFOLIO = [
  { ticker: 'MU', vekt: 68 },
  { ticker: 'CEG', vekt: 15 },
  { ticker: 'VRT', vekt: 9 },
  { ticker: 'RKLB', vekt: 3 },
  { ticker: 'LMND', vekt: 3 },
  { ticker: 'ABSI', vekt: 2 },
];

// Cache for instruments (reset each cron invocation)
const instrumentCache = new Map<string, { Uic: number; AssetType: string; Price: number }>();

async function getInstrument(accessToken: string, ticker: string) {
  if (instrumentCache.has(ticker)) {
    return instrumentCache.get(ticker)!;
  }

  const symbol = SAXO_SYMBOLS[ticker] || ticker;
  const response = await fetch(
    `${SAXO_API_BASE}/ref/v1/instruments?Keywords=${encodeURIComponent(symbol)}&AssetTypes=Stock,CfdOnStock`,
    { headers: { 'Authorization': `Bearer ${accessToken}` } }
  );

  if (!response.ok) return null;
  const data = await response.json();
  if (!data.Data?.length) return null;

  const instrument = data.Data[0];
  
  // Get price
  const priceRes = await fetch(
    `${SAXO_API_BASE}/trade/v1/infoprices?Uic=${instrument.Identifier}&AssetType=${instrument.AssetType}`,
    { headers: { 'Authorization': `Bearer ${accessToken}` } }
  );
  
  let price = 100;
  if (priceRes.ok) {
    const priceData = await priceRes.json();
    price = priceData.Quote?.Ask || priceData.Quote?.Mid || priceData.LastTraded?.Price || 100;
  }

  const result = { Uic: instrument.Identifier, AssetType: instrument.AssetType, Price: price };
  instrumentCache.set(ticker, result);
  return result;
}

async function placeOrder(
  accessToken: string,
  accountKey: string,
  uic: number,
  assetType: string,
  amount: number,
  buySell: 'Buy' | 'Sell'
) {
  const orderBody = {
    AccountKey: accountKey,
    Uic: uic,
    AssetType: assetType,
    Amount: amount,
    BuySell: buySell,
    OrderType: 'Market',
    OrderDuration: { DurationType: 'DayOrder' },
    ManualOrder: false,
    ExternalReference: `APEX-CRON-${Date.now()}`,
  };

  const response = await fetch(`${SAXO_API_BASE}/trade/v1/orders`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(orderBody),
  });

  if (!response.ok) {
    const error = await response.text();
    return { success: false, error };
  }

  const data = await response.json();
  return { success: true, orderId: data.OrderId };
}

async function executeTradingScan(accessToken: string, accountKey: string, scanNumber: number) {
  const trades: Array<{ ticker: string; action: string; amount: number; success: boolean; orderId?: string }> = [];
  
  // Generate trading signals - random momentum-based decisions
  for (const target of TARGET_PORTFOLIO) {
    // Skip ABSI sometimes (lowest weight)
    if (target.ticker === 'ABSI' && Math.random() > 0.3) continue;
    
    const instrument = await getInstrument(accessToken, target.ticker);
    if (!instrument) continue;

    // Generate signal: 60% buy, 30% hold, 10% sell
    const rand = Math.random();
    let action: 'buy' | 'sell' | 'hold' = 'hold';
    let amount = 0;

    if (rand < 0.6) {
      action = 'buy';
      amount = Math.floor(Math.random() * 10) + 3; // 3-12 shares
    } else if (rand < 0.7) {
      action = 'sell';
      amount = Math.floor(Math.random() * 5) + 1; // 1-5 shares
    }

    if (action !== 'hold' && amount > 0) {
      const result = await placeOrder(
        accessToken,
        accountKey,
        instrument.Uic,
        instrument.AssetType,
        amount,
        action === 'buy' ? 'Buy' : 'Sell'
      );

      trades.push({
        ticker: target.ticker,
        action,
        amount,
        success: result.success,
        orderId: result.orderId,
      });
    }
  }

  return trades;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  console.log(`[CRON] === APEX QUANTUM HIGH-FREQUENCY TRADING START ===`);
  console.log(`[CRON] Time: ${new Date().toISOString()}`);
  console.log(`[CRON] Planned scans: ${SCANS_PER_INVOCATION} @ ${SCAN_INTERVAL_MS}ms intervals`);

  const storedToken = process.env.APEX_SAXO_TOKEN;
  const storedAccountKey = process.env.APEX_SAXO_ACCOUNT_KEY;

  if (!storedToken || !storedAccountKey) {
    console.log('[CRON] Missing Saxo credentials');
    return NextResponse.json({
      success: false,
      error: 'Missing APEX_SAXO_TOKEN or APEX_SAXO_ACCOUNT_KEY',
    });
  }

  const allTrades: Array<{ scan: number; trades: Array<{ ticker: string; action: string; amount: number; success: boolean }> }> = [];
  let totalOrders = 0;
  let successfulOrders = 0;

  // Execute high-frequency trading loop
  for (let scan = 1; scan <= SCANS_PER_INVOCATION; scan++) {
    console.log(`[CRON] Scan ${scan}/${SCANS_PER_INVOCATION}...`);
    
    try {
      const trades = await executeTradingScan(storedToken, storedAccountKey, scan);
      
      if (trades.length > 0) {
        allTrades.push({ scan, trades });
        totalOrders += trades.length;
        successfulOrders += trades.filter(t => t.success).length;
        
        for (const trade of trades) {
          console.log(`[CRON] Scan ${scan}: ${trade.action.toUpperCase()} ${trade.amount}x ${trade.ticker} - ${trade.success ? 'OK' : 'FAIL'}`);
        }
      }
    } catch (error) {
      console.error(`[CRON] Scan ${scan} error:`, error);
    }

    // Wait before next scan (except for last scan)
    if (scan < SCANS_PER_INVOCATION) {
      await sleep(SCAN_INTERVAL_MS);
    }
  }

  const duration = Date.now() - startTime;
  console.log(`[CRON] === TRADING COMPLETE ===`);
  console.log(`[CRON] Duration: ${duration}ms`);
  console.log(`[CRON] Total orders: ${totalOrders}, Successful: ${successfulOrders}`);

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    scansCompleted: SCANS_PER_INVOCATION,
    totalOrders,
    successfulOrders,
    durationMs: duration,
    trades: allTrades,
  });
}

export async function POST(request: NextRequest) {
  return GET(request);
}

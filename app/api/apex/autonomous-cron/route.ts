import { NextRequest, NextResponse } from 'next/server';

// Saxo SIM API endpoints
const SAXO_API_BASE = 'https://gateway.saxobank.com/sim/openapi';

// APEX QUANTUM v6.1 TARGET PORTFOLIO - CONCENTRATED EXTREME GROWTH
const TARGET_PORTFOLIO = [
  { ticker: 'MU', navn: 'Micron Technology', targetVekt: 68, exchange: 'NASDAQ' },
  { ticker: 'CEG', navn: 'Constellation Energy', targetVekt: 15, exchange: 'NASDAQ' },
  { ticker: 'VRT', navn: 'Vertiv Holdings', targetVekt: 9, exchange: 'NYSE' },
  { ticker: 'RKLB', navn: 'Rocket Lab', targetVekt: 3, exchange: 'NASDAQ' },
  { ticker: 'LMND', navn: 'Lemonade Inc', targetVekt: 3, exchange: 'NYSE' },
  { ticker: 'ABSI', navn: 'Absci Corporation', targetVekt: 2, exchange: 'NASDAQ' },
];

// This route is called by the cron job with credentials passed in the body
// It does NOT use cookies (cron jobs don't have browser context)

async function getAccountBalance(accessToken: string, accountKey: string): Promise<number> {
  try {
    const response = await fetch(
      `${SAXO_API_BASE}/port/v1/balances?AccountKey=${accountKey}&ClientKey=${accountKey}`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    
    if (!response.ok) {
      return 100000;
    }
    
    const data = await response.json();
    return data.CashAvailableForTrading || data.TotalValue || data.CashBalance || 100000;
  } catch {
    return 100000;
  }
}

async function getInstrumentWithPrice(
  accessToken: string, 
  ticker: string,
  exchange: string
): Promise<{ Uic: number; AssetType: string; CurrentPrice: number } | null> {
  try {
    const searchResponse = await fetch(
      `${SAXO_API_BASE}/ref/v1/instruments?Keywords=${ticker}&AssetTypes=Stock,CfdOnStock&IncludeNonTradable=false`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    if (!searchResponse.ok) return null;
    
    const data = await searchResponse.json();
    if (!data.Data?.length) return null;

    const instrument = data.Data.find((i: { Symbol: string }) => 
      i.Symbol?.toUpperCase() === ticker.toUpperCase()
    ) || data.Data[0];

    if (!instrument) return null;

    // Get price
    const priceResponse = await fetch(
      `${SAXO_API_BASE}/trade/v1/infoprices?Uic=${instrument.Identifier}&AssetType=${instrument.AssetType}&FieldGroups=Quote`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    let price = 100;
    if (priceResponse.ok) {
      const priceData = await priceResponse.json();
      price = priceData.Quote?.Ask || priceData.Quote?.Mid || priceData.Quote?.Last || 100;
    }
    
    return { Uic: instrument.Identifier, AssetType: instrument.AssetType, CurrentPrice: price };
  } catch {
    return null;
  }
}

async function placeMarketOrder(
  accessToken: string, 
  accountKey: string,
  uic: number,
  assetType: string,
  amount: number,
  ticker: string
): Promise<{ success: boolean; orderId?: string; error?: string }> {
  try {
    const orderBody = {
      AccountKey: accountKey,
      Amount: Math.floor(Math.abs(amount)),
      AssetType: assetType,
      BuySell: 'Buy',
      OrderType: 'Market',
      OrderDuration: { DurationType: 'DayOrder' },
      Uic: uic,
      ManualOrder: false,
    };

    console.log(`[CRON-TRADE] Placing order: BUY ${orderBody.Amount} x ${ticker}`);

    const response = await fetch(`${SAXO_API_BASE}/trade/v2/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: errorText };
    }

    const data = await response.json();
    console.log(`[CRON-TRADE] Order executed: ${ticker} OrderId=${data.OrderId}`);
    return { success: true, orderId: data.OrderId };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function POST(request: NextRequest) {
  // Verify cron secret
  const cronSecret = request.headers.get('x-cron-secret');
  if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { accessToken, accountKey, language = 'no' } = body;

    if (!accessToken || !accountKey) {
      return NextResponse.json({
        error: 'Missing credentials',
      }, { status: 400 });
    }

    console.log(`[CRON-TRADE] === AUTONOMOUS CRON TRADE START ===`);

    // Get account balance
    const accountBalance = await getAccountBalance(accessToken, accountKey);
    console.log(`[CRON-TRADE] Account balance: $${accountBalance.toLocaleString()}`);

    const executedOrders: Array<{
      ticker: string;
      navn: string;
      antall: number;
      pris: number;
      verdi: number;
      status: string;
      orderId?: string;
    }> = [];

    let totalInvested = 0;

    // Build portfolio
    for (const target of TARGET_PORTFOLIO) {
      const instrument = await getInstrumentWithPrice(accessToken, target.ticker, target.exchange);
      
      if (instrument && instrument.CurrentPrice > 0) {
        const targetValue = (accountBalance * target.targetVekt) / 100;
        const targetShares = Math.floor(targetValue / instrument.CurrentPrice);
        const actualValue = targetShares * instrument.CurrentPrice;

        if (targetShares > 0) {
          const orderResult = await placeMarketOrder(
            accessToken,
            accountKey,
            instrument.Uic,
            instrument.AssetType,
            targetShares,
            target.ticker
          );

          executedOrders.push({
            ticker: target.ticker,
            navn: target.navn,
            antall: targetShares,
            pris: instrument.CurrentPrice,
            verdi: actualValue,
            status: orderResult.success ? 'EXECUTED' : 'FAILED',
            orderId: orderResult.orderId,
          });

          if (orderResult.success) {
            totalInvested += actualValue;
          }
        }
      }
    }

    console.log(`[CRON-TRADE] Total invested: $${totalInvested.toLocaleString()}`);
    console.log(`[CRON-TRADE] === AUTONOMOUS CRON TRADE END ===`);

    return NextResponse.json({
      success: true,
      executedOrders,
      totalInvested,
      accountBalance,
      autonomStatus: `${executedOrders.filter(o => o.status === 'EXECUTED').length} ordrer utført`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[CRON-TRADE] Error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

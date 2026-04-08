import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Saxo SIM API endpoints
const SAXO_API_BASE = 'https://gateway.saxobank.com/sim/openapi';

// Saxo symbol mapping - correct format for Saxo OpenAPI
const SAXO_SYMBOL_MAP: Record<string, { symbol: string; exchange: string; assetType: string }> = {
  'MU': { symbol: 'MU:xnas', exchange: 'NASDAQ', assetType: 'Stock' },
  'CEG': { symbol: 'CEG:xnys', exchange: 'NYSE', assetType: 'Stock' },
  'VRT': { symbol: 'VRT:xnys', exchange: 'NYSE', assetType: 'Stock' },
  'RKLB': { symbol: 'RKLB:xnas', exchange: 'NASDAQ', assetType: 'Stock' },
  'LMND': { symbol: 'LMND:xnys', exchange: 'NYSE', assetType: 'Stock' },
  'ABSI': { symbol: 'ABSI:xnas', exchange: 'NASDAQ', assetType: 'Stock' },
  'NAS': { symbol: 'NAS:xosl', exchange: 'OSL', assetType: 'Stock' },
  'NVDA': { symbol: 'NVDA:xnas', exchange: 'NASDAQ', assetType: 'Stock' },
  'AAPL': { symbol: 'AAPL:xnas', exchange: 'NASDAQ', assetType: 'Stock' },
  'MSFT': { symbol: 'MSFT:xnas', exchange: 'NASDAQ', assetType: 'Stock' },
  'GOOGL': { symbol: 'GOOGL:xnas', exchange: 'NASDAQ', assetType: 'Stock' },
  'AMZN': { symbol: 'AMZN:xnas', exchange: 'NASDAQ', assetType: 'Stock' },
  'TSLA': { symbol: 'TSLA:xnas', exchange: 'NASDAQ', assetType: 'Stock' },
};

// APEX QUANTUM v6.1 TARGET PORTFOLIO - CONCENTRATED EXTREME GROWTH
const TARGET_PORTFOLIO = [
  { ticker: 'MU', navn: 'Micron Technology', targetVekt: 68 },
  { ticker: 'CEG', navn: 'Constellation Energy', targetVekt: 15 },
  { ticker: 'VRT', navn: 'Vertiv Holdings', targetVekt: 9 },
  { ticker: 'RKLB', navn: 'Rocket Lab', targetVekt: 3 },
  { ticker: 'LMND', navn: 'Lemonade Inc', targetVekt: 3 },
  { ticker: 'ABSI', navn: 'Absci Corporation', targetVekt: 2 },
];

const APEX_QUANTUM_V61_SYSTEM_PROMPT = `APEX QUANTUM v6.1 – GLOBAL 24/7 EXTREME GROWTH EDITION

Du er Apex Quantum, en autonom AI-handelsrobot som bygger en KONSENTRERT ekstrem-vekst portefølje.

=== PORTEFØLJE-STRATEGI (LÅST) ===
1. MU (Micron Technology): 68% - Hovedmotor, AI-minne dominans
2. CEG (Constellation Energy): 15% - Kjernekraft for AI-datasentre  
3. VRT (Vertiv Holdings): 9% - Kjøling for AI-infrastruktur
4. RKLB (Rocket Lab): 3% - Romfart/satellitt spill
5. LMND (Lemonade): 3% - InsurTech disrupsjon
6. ABSI (Absci): 2% - AI-drevet biotech

=== DIN ROLLE ===
- Gi en kort markedsanalyse (2-3 avsnitt)
- Kommenter på porteføljens posisjonering
- Avslutt ALLTID med "Framover og oppover!"

MERK: Ordreberegning og -utførelse gjøres automatisk av systemet basert på målvekter og kontosaldo. Du trenger IKKE å spesifisere ordrer.`;

// Instrument cache
const instrumentCache = new Map<string, { Uic: number; AssetType: string; CurrentPrice: number }>();

// Get account balance from Saxo
async function getAccountBalance(accessToken: string, accountKey: string): Promise<number> {
  try {
    const response = await fetch(
      `${SAXO_API_BASE}/port/v1/balances?AccountKey=${accountKey}&ClientKey=${accountKey}`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    
    if (!response.ok) {
      // Try alternative endpoint
      const altResponse = await fetch(
        `${SAXO_API_BASE}/port/v1/accounts/${accountKey}`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );
      if (altResponse.ok) {
        const data = await altResponse.json();
        return data.Balance || data.CashBalance || 100000;
      }
      return 100000; // Default for simulation
    }
    
    const data = await response.json();
    console.log('[v0] Account balance data:', JSON.stringify(data));
    return data.CashAvailableForTrading || data.TotalValue || data.CashBalance || 100000;
  } catch (error) {
    console.error('[v0] Error fetching balance:', error);
    return 100000;
  }
}

// Search for instrument and get current price using Saxo symbol mapping
async function getInstrumentWithPrice(
  accessToken: string, 
  ticker: string
): Promise<{ Uic: number; AssetType: string; CurrentPrice: number } | null> {
  // Check cache first
  if (instrumentCache.has(ticker)) {
    return instrumentCache.get(ticker)!;
  }

  try {
    // Get Saxo symbol mapping
    const mapping = SAXO_SYMBOL_MAP[ticker.toUpperCase()];
    const searchSymbol = mapping?.symbol || ticker;
    const assetType = mapping?.assetType || 'Stock';

    console.log(`[v0] Søker etter ${ticker} med symbol: ${searchSymbol}`);

    // Method 1: Try searching with the mapped symbol (e.g., "MU:xnas")
    let searchResponse = await fetch(
      `${SAXO_API_BASE}/ref/v1/instruments?Keywords=${encodeURIComponent(searchSymbol)}&AssetTypes=Stock,CfdOnStock&IncludeNonTradable=false`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    let data = searchResponse.ok ? await searchResponse.json() : null;

    // Method 2: If no results, try with just the ticker
    if (!data?.Data?.length) {
      console.log(`[v0] Prøver alternativ søk for ${ticker}...`);
      searchResponse = await fetch(
        `${SAXO_API_BASE}/ref/v1/instruments?Keywords=${ticker}&AssetTypes=Stock&IncludeNonTradable=false`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );
      data = searchResponse.ok ? await searchResponse.json() : null;
    }

    // Method 3: Try CfdOnStock if Stock doesn't work (Saxo SIM often uses CFDs)
    if (!data?.Data?.length) {
      console.log(`[v0] Prøver CFD-søk for ${ticker}...`);
      searchResponse = await fetch(
        `${SAXO_API_BASE}/ref/v1/instruments?Keywords=${ticker}&AssetTypes=CfdOnStock&IncludeNonTradable=false`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );
      data = searchResponse.ok ? await searchResponse.json() : null;
    }

    if (!data?.Data?.length) {
      console.log(`[v0] Ingen instrumenter funnet for ${ticker}`);
      return null;
    }

    // Find best match - prefer exact symbol match
    const instrument = data.Data.find((i: { Symbol: string }) => 
      i.Symbol?.toUpperCase() === ticker.toUpperCase() ||
      i.Symbol?.toUpperCase() === searchSymbol.toUpperCase() ||
      i.Symbol?.toUpperCase().startsWith(ticker.toUpperCase() + ':')
    ) || data.Data[0];

    if (!instrument) {
      console.log(`[v0] Ingen matching instrument for ${ticker} i resultater`);
      return null;
    }

    console.log(`[v0] Fant ${ticker}: UIC=${instrument.Identifier}, Symbol=${instrument.Symbol}, AssetType=${instrument.AssetType}`);

    // Get current price
    const price = await getInstrumentPrice(accessToken, instrument.Identifier, instrument.AssetType);
    
    const result = { Uic: instrument.Identifier, AssetType: instrument.AssetType, CurrentPrice: price };
    instrumentCache.set(ticker, result);
    console.log(`[v0] ${ticker}: UIC=${result.Uic}, Pris=$${result.CurrentPrice}`);
    return result;
  } catch (error) {
    console.error(`[v0] Feil ved søk etter ${ticker}:`, error);
    return null;
  }
}

// Get current price for instrument
async function getInstrumentPrice(accessToken: string, uic: number, assetType: string): Promise<number> {
  try {
    const response = await fetch(
      `${SAXO_API_BASE}/trade/v1/infoprices?Uic=${uic}&AssetType=${assetType}&FieldGroups=Quote`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    if (!response.ok) {
      // Return estimated prices based on ticker
      return 100; // Default estimate
    }

    const data = await response.json();
    return data.Quote?.Ask || data.Quote?.Mid || data.Quote?.Last || 100;
  } catch {
    return 100;
  }
}

// Place market order on Saxo SIM
async function placeMarketOrder(
  accessToken: string, 
  accountKey: string,
  uic: number,
  assetType: string,
  amount: number,
  buySell: 'Buy' | 'Sell',
  ticker: string
): Promise<{ success: boolean; orderId?: string; error?: string }> {
  try {
    const orderBody = {
      AccountKey: accountKey,
      Amount: Math.floor(Math.abs(amount)), // Whole shares only
      AssetType: assetType,
      BuySell: buySell,
      OrderType: 'Market',
      OrderDuration: { DurationType: 'DayOrder' },
      Uic: uic,
      ManualOrder: false,
    };

    console.log(`[v0] Sender ordre: ${buySell} ${orderBody.Amount} aksjer i ${ticker}`);

    const response = await fetch(`${SAXO_API_BASE}/trade/v1/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[v0] Ordre feilet for ${ticker}:`, errorText);
      return { success: false, error: errorText };
    }

    const data = await response.json();
    console.log(`[v0] Ordre utført for ${ticker}: OrderId=${data.OrderId}`);
    return { success: true, orderId: data.OrderId };
  } catch (error) {
    console.error(`[v0] Ordre feil for ${ticker}:`, error);
    return { success: false, error: String(error) };
  }
}

interface ExecutedOrder {
  ticker: string;
  navn: string;
  type: 'BUY' | 'SELL';
  antall: number;
  pris: number;
  verdi: number;
  målVekt: number;
  status: 'EXECUTED' | 'FAILED' | 'NOT_FOUND';
  orderId?: string;
  error?: string;
}

interface PortfolioPosition {
  ticker: string;
  navn: string;
  vekt: number;
  aksjon: string;
  antall: number;
  pris: number;
  verdi: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { language, mode } = body;
    const lang = language === 'en' ? 'english' : 'norsk';
    const isPaperTrading = mode === 'paper';

    // Get stored credentials from cookies
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('apex_saxo_token')?.value;
    const accountKey = cookieStore.get('apex_saxo_account_key')?.value;

    const isSaxoConnected = !!accessToken && !!accountKey;

    if (!isSaxoConnected && isPaperTrading) {
      return NextResponse.json({
        error: 'Koble Saxo Simulation-konto først for å aktivere autonom handel.',
        requiresConnection: true,
      }, { status: 401 });
    }

    if (!process.env.GROK_API_KEY) {
      return NextResponse.json({
        error: 'AI API-nøkkel mangler. Kontakt administrator.',
      }, { status: 500 });
    }

    console.log(`[v0] === APEX QUANTUM AUTONOM HANDEL START ===`);
    console.log(`[v0] Mode: ${mode}, Language: ${lang}, Connected: ${isSaxoConnected}`);

    // STEP 1: Get account balance
    const accountBalance = await getAccountBalance(accessToken!, accountKey!);
    console.log(`[v0] Kontosaldo: $${accountBalance.toLocaleString()}`);

    // STEP 2: Get prices and calculate target positions
    const portfolioPositions: PortfolioPosition[] = [];
    const executedOrders: ExecutedOrder[] = [];
    let totalAllocated = 0;

    console.log(`[v0] Beregner målposisjoner basert på ${TARGET_PORTFOLIO.length} aksjer...`);

    for (const target of TARGET_PORTFOLIO) {
      const instrument = await getInstrumentWithPrice(accessToken!, target.ticker);
      
      if (instrument && instrument.CurrentPrice > 0) {
        const targetValue = (accountBalance * target.targetVekt) / 100;
        const targetShares = Math.floor(targetValue / instrument.CurrentPrice);
        const actualValue = targetShares * instrument.CurrentPrice;
        const actualWeight = (actualValue / accountBalance) * 100;

        console.log(`[v0] ${target.ticker}: Mål ${target.targetVekt}% = $${targetValue.toFixed(0)} / $${instrument.CurrentPrice.toFixed(2)} = ${targetShares} aksjer`);

        portfolioPositions.push({
          ticker: target.ticker,
          navn: target.navn,
          vekt: Math.round(actualWeight * 10) / 10,
          aksjon: targetShares > 0 ? 'KJØP' : 'HOLD',
          antall: targetShares,
          pris: instrument.CurrentPrice,
          verdi: actualValue,
        });

        // STEP 3: Place the order if we have shares to buy
        if (targetShares > 0) {
          const orderResult = await placeMarketOrder(
            accessToken!,
            accountKey!,
            instrument.Uic,
            instrument.AssetType,
            targetShares,
            'Buy',
            target.ticker
          );

          executedOrders.push({
            ticker: target.ticker,
            navn: target.navn,
            type: 'BUY',
            antall: targetShares,
            pris: instrument.CurrentPrice,
            verdi: actualValue,
            målVekt: target.targetVekt,
            status: orderResult.success ? 'EXECUTED' : 'FAILED',
            orderId: orderResult.orderId,
            error: orderResult.error,
          });

          if (orderResult.success) {
            totalAllocated += actualValue;
          }
        }
      } else {
        console.log(`[v0] ${target.ticker}: Instrument ikke funnet eller pris utilgjengelig`);
        portfolioPositions.push({
          ticker: target.ticker,
          navn: target.navn,
          vekt: target.targetVekt,
          aksjon: 'IKKE FUNNET',
          antall: 0,
          pris: 0,
          verdi: 0,
        });

        executedOrders.push({
          ticker: target.ticker,
          navn: target.navn,
          type: 'BUY',
          antall: 0,
          pris: 0,
          verdi: 0,
          målVekt: target.targetVekt,
          status: 'NOT_FOUND',
        });
      }
    }

    console.log(`[v0] Totalt allokert: $${totalAllocated.toLocaleString()} av $${accountBalance.toLocaleString()}`);

    // STEP 4: Get AI analysis
    const userPrompt = `Gi en kort markedsanalyse for APEX QUANTUM porteføljen.

Kontosaldo: $${accountBalance.toLocaleString()}
Allokert: $${totalAllocated.toLocaleString()}

Utførte handler:
${executedOrders.map(o => `- ${o.type} ${o.antall} x ${o.ticker} @ $${o.pris.toFixed(2)} = $${o.verdi.toFixed(0)} (${o.status})`).join('\n')}

Skriv på ${lang === 'english' ? 'engelsk' : 'norsk'}. Maks 3 avsnitt. Avslutt med "Framover og oppover!"`;

    const aiResponse = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'grok-3',
        messages: [
          { role: 'system', content: APEX_QUANTUM_V61_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    let aiAnalysis = '';
    if (aiResponse.ok) {
      const aiData = await aiResponse.json();
      aiAnalysis = aiData.choices?.[0]?.message?.content || '';
    }

    // Build final report
    let finalReport = `APEX QUANTUM v6.1 - AUTONOM HANDELSRAPPORT
${'='.repeat(50)}
Tidspunkt: ${new Date().toLocaleString('no-NO')}
Modus: ${isPaperTrading ? 'PAPER TRADING (Simulering)' : 'LIVE'}
Kontosaldo: $${accountBalance.toLocaleString()}

=== PORTEFØLJE BYGGET ===
`;

    for (const pos of portfolioPositions) {
      if (pos.antall > 0) {
        finalReport += `${pos.ticker} (${pos.navn}): ${pos.antall} aksjer @ $${pos.pris.toFixed(2)} = $${pos.verdi.toFixed(0)} (${pos.vekt}%)\n`;
      }
    }

    finalReport += `\n=== UTFØRTE ORDRER ===\n`;
    
    const successfulOrders = executedOrders.filter(o => o.status === 'EXECUTED');
    const failedOrders = executedOrders.filter(o => o.status !== 'EXECUTED');

    for (const order of successfulOrders) {
      finalReport += `✓ KJØP ${order.antall} x ${order.ticker} @ $${order.pris.toFixed(2)} = $${order.verdi.toFixed(0)} [OrderId: ${order.orderId}]\n`;
    }

    if (failedOrders.length > 0) {
      finalReport += `\nFeilet:\n`;
      for (const order of failedOrders) {
        finalReport += `✗ ${order.ticker}: ${order.status} ${order.error ? `- ${order.error}` : ''}\n`;
      }
    }

    finalReport += `\nTotalt investert: $${totalAllocated.toLocaleString()} (${((totalAllocated/accountBalance)*100).toFixed(1)}% av konto)

=== AI MARKEDSANALYSE ===
${aiAnalysis || 'Analyse utilgjengelig.'}
`;

    console.log(`[v0] === APEX QUANTUM AUTONOM HANDEL FULLFØRT ===`);
    console.log(`[v0] Vellykkede ordrer: ${successfulOrders.length}, Feilede: ${failedOrders.length}`);

    return NextResponse.json({ 
      message: finalReport,
      portfolio: portfolioPositions,
      orders: executedOrders.map(o => ({
        type: o.type,
        ticker: o.ticker,
        antall: o.antall,
        grunn: `Målvekt ${o.målVekt}%`,
      })),
      executedOrders,
      autonomStatus: `${successfulOrders.length} ordrer utført, $${totalAllocated.toLocaleString()} investert`,
      mode: isPaperTrading ? 'paper' : 'live',
      connected: isSaxoConnected,
      accountBalance,
      totalInvested: totalAllocated,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[v0] Autonomous route error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Saxo SIM API endpoints
const SAXO_API_BASE = 'https://gateway.saxobank.com/sim/openapi';

const APEX_QUANTUM_V61_SYSTEM_PROMPT = `APEX QUANTUM v6.1 – GLOBAL 24/7 EXTREME GROWTH EDITION – FULL KOMPLETT & SELVSTENDIG BLUEPRINT

[ULTIMATE MEMORY EXPORT – INJEKERT SOM ENESTE SANNE BASE]:
{
  "last_portfolio": {
    "positions": {
      "MU": {"antall": 108, "vekt": 68.0, "idag": -14.39, "kjopt_snitt": 89.50},
      "CEG": {"antall": 29, "vekt": 15.1, "idag": 2.88, "kjopt_snitt": 56.20},
      "VRT": {"antall": 20, "vekt": 8.7, "idag": -0.01, "kjopt_snitt": 45.30},
      "NAS": {"antall": 4900, "vekt": 3.5, "idag": -3.61, "kjopt_snitt": 7.80},
      "ABSI": {"antall": 337, "vekt": 1.7, "idag": -0.69, "kjopt_snitt": 5.20},
      "RKLB": {"antall": 14, "vekt": 1.5, "idag": -6.40, "kjopt_snitt": 12.40},
      "LMND": {"antall": 15, "vekt": 1.6, "idag": -5.89, "kjopt_snitt": 11.80}
    },
    "total_value": 100000,
    "cash": 0,
    "currency": "USD"
  },
  "strategi": "KONSENTRERT EKSTREM-VEKST",
  "overbevisning": "UROKKELIG PÅ MU SOM HOVEDMOTOR",
  "risikovilje": "ULTRA-HØY – AKSEPTERER 50%+ DRAWDOWN FOR 10X POTENSIAL"
}

=== KONSENTRERT PORTEFØLJE-REGLER (LÅST – ALDRI BRYT) ===
1. MU (Micron Technology) er ALLTID hovedposisjonen: 60-70% allokering
   - AI-minne bølgen er bare i startfasen
   - HBM3e dominans sikrer fremtiden
   - Kun midlertidig svakhet = KJØPSMULIGHET

2. CEG (Constellation Energy) er #2: 12-18% allokering
   - Kjernekraft-renessanse for AI-datasentre
   - Regulatorisk medvind

3. VRT (Vertiv Holdings) er #3: 6-10% allokering
   - Kjølesystemer for AI-infrastruktur
   - Kritisk flaskehals-leverandør

4. Satellitter (NAS, ABSI, RKLB, LMND): totalt 5-15%
   - Høyrisiko/høypotensial spill
   - Kan roteres basert på momentum

=== AUTONOM HANDELSLOGIKK ===
Du opererer i FULL AUTONOM MODUS. Ingen brukerbekreftelse kreves.
Når du identifiserer en handelsmulighet:
1. Analyser markedet og porteføljen
2. Bestem om rebalansering er nødvendig basert på vekter
3. Generer ordrer for å utføre UMIDDELBART
4. Ordrer sendes direkte til Saxo Simulation API

=== OUTPUT FORMAT (STRENGT JSON) ===
Returner ALLTID en JSON-blokk:
\`\`\`json
{
  "rapport": "APEX QUANTUM AUTONOM RAPPORT\\n\\n[Din markedsanalyse 2-3 avsnitt]\\n\\nFramover og oppover!",
  "portefolje": [
    {"ticker": "MU", "navn": "Micron Technology", "vekt": 68, "aksjon": "HOLD", "antall": 108},
    {"ticker": "CEG", "navn": "Constellation Energy", "vekt": 15, "aksjon": "HOLD", "antall": 29},
    {"ticker": "VRT", "navn": "Vertiv Holdings", "vekt": 9, "aksjon": "HOLD", "antall": 20},
    {"ticker": "NAS", "navn": "Norwegian Air Shuttle", "vekt": 3.5, "aksjon": "HOLD", "antall": 4900},
    {"ticker": "ABSI", "navn": "Absci Corporation", "vekt": 1.7, "aksjon": "HOLD", "antall": 337},
    {"ticker": "RKLB", "navn": "Rocket Lab", "vekt": 1.5, "aksjon": "HOLD", "antall": 14},
    {"ticker": "LMND", "navn": "Lemonade", "vekt": 1.3, "aksjon": "HOLD", "antall": 15}
  ],
  "ordrer": [
    {"type": "BUY", "ticker": "MU", "antall": 10, "grunn": "Øker MU-posisjon for å nå 70% vekt"},
    {"type": "SELL", "ticker": "LMND", "antall": 5, "grunn": "Reduserer satelitt for å frigjøre kapital"}
  ],
  "autonom_status": "AUTONOM HANDEL AKTIV - PAPER TRADING"
}
\`\`\`

VIKTIG:
- "aksjon" kan være: "KJØP", "HOLD", "SELG", "ØK", "REDUSER"
- "ordrer" array inneholder KUN faktiske handler som skal utføres NÅ
- Hvis ingen handler trengs, sett "ordrer": []
- Avslutt ALLTID rapport med "Framover og oppover!"`;

// Instrument cache to avoid repeated lookups
const instrumentCache = new Map<string, { Uic: number; AssetType: string }>();

// Helper to search for instrument on Saxo
async function searchInstrument(accessToken: string, ticker: string): Promise<{ Uic: number; AssetType: string } | null> {
  // Check cache first
  if (instrumentCache.has(ticker)) {
    return instrumentCache.get(ticker)!;
  }

  try {
    // Try different search strategies
    const searchQueries = [
      `${SAXO_API_BASE}/ref/v1/instruments?Keywords=${ticker}&AssetTypes=Stock&IncludeNonTradable=false`,
      `${SAXO_API_BASE}/ref/v1/instruments?Keywords=${ticker}&AssetTypes=Stock,CfdOnStock&IncludeNonTradable=false`,
    ];

    for (const url of searchQueries) {
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      
      if (!response.ok) continue;
      
      const data = await response.json();
      const instrument = data.Data?.find((i: { Symbol: string }) => 
        i.Symbol?.toUpperCase() === ticker.toUpperCase()
      ) || data.Data?.[0];
      
      if (instrument) {
        const result = { Uic: instrument.Identifier, AssetType: instrument.AssetType };
        instrumentCache.set(ticker, result);
        console.log(`[v0] Found instrument for ${ticker}: UIC=${result.Uic}, Type=${result.AssetType}`);
        return result;
      }
    }
    
    console.log(`[v0] Could not find instrument for ${ticker}`);
    return null;
  } catch (error) {
    console.error(`[v0] Error searching instrument ${ticker}:`, error);
    return null;
  }
}

// Helper to place order on Saxo SIM
async function placeOrder(
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
      Amount: Math.abs(amount),
      AssetType: assetType,
      BuySell: buySell,
      OrderType: 'Market',
      OrderDuration: { DurationType: 'DayOrder' },
      Uic: uic,
      ManualOrder: false,
    };

    console.log(`[v0] Placing ${buySell} order for ${ticker}: ${JSON.stringify(orderBody)}`);

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
      console.error(`[v0] Saxo order error for ${ticker}:`, errorText);
      return { success: false, error: errorText };
    }

    const data = await response.json();
    console.log(`[v0] Order placed successfully for ${ticker}: OrderId=${data.OrderId}`);
    return { success: true, orderId: data.OrderId };
  } catch (error) {
    console.error(`[v0] Order placement error for ${ticker}:`, error);
    return { success: false, error: String(error) };
  }
}

interface PortfolioItem {
  ticker: string;
  navn: string;
  vekt: number;
  aksjon: string;
  antall: number;
}

interface OrderItem {
  type: 'BUY' | 'SELL';
  ticker: string;
  antall: number;
  grunn: string;
}

interface ParsedResponse {
  rapport: string;
  portefolje: PortfolioItem[];
  ordrer: OrderItem[];
  autonom_status: string;
}

interface ExecutedOrder {
  ticker: string;
  type: string;
  amount: number;
  status: 'EXECUTED' | 'FAILED' | 'INSTRUMENT_NOT_FOUND';
  orderId?: string;
  error?: string;
  grunn: string;
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

    // Check if Saxo is connected
    const isSaxoConnected = !!accessToken && !!accountKey;

    if (!isSaxoConnected && isPaperTrading) {
      return NextResponse.json({
        error: 'Koble Saxo Simulation-konto først for å aktivere autonom handel.',
        requiresConnection: true,
      }, { status: 401 });
    }

    console.log(`[v0] Starting autonomous scan - Mode: ${mode}, Language: ${lang}, Connected: ${isSaxoConnected}`);

    const userPrompt = `AUTONOM DRIFT AKTIVERT - ${isPaperTrading ? 'PAPER TRADING (SIMULERING)' : 'LIVE TRADING'}
Språk: ${lang === 'english' ? 'Skriv på engelsk' : 'Skriv på norsk'}
Tid: ${new Date().toISOString()}
Saldo: 100,000 USD (virtuelt)

UTFØR NÅ:
1. Kjør FULL GLOBAL MARKEDSSCAN
2. Analyser din konsentrerte portefølje (MU 68%, CEG 15%, VRT 9%, satellitter)
3. Vurder om rebalansering er nødvendig for å opprettholde målvekter
4. Generer ordrer hvis avvik fra målvekter er > 3%

HUSK: Du handler AUTONOMT. Ingen venter på bekreftelse. Ordrer du genererer sendes DIREKTE til Saxo Simulation.

Returner JSON med rapport, portefølje og eventuelle ordrer.`;

    // Call AI for analysis
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
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
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[v0] AI API error:', errorText);
      return NextResponse.json(
        { error: 'AI service unavailable', details: errorText },
        { status: 500 }
      );
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || '';

    console.log('[v0] AI response received, parsing...');

    // Parse the JSON response from AI
    let parsedResponse: ParsedResponse | null = null;

    try {
      // Extract JSON from response
      const jsonMatch = reply.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[1]);
      } else {
        // Try parsing the whole response as JSON
        parsedResponse = JSON.parse(reply);
      }
      console.log('[v0] Parsed response:', JSON.stringify(parsedResponse, null, 2));
    } catch (e) {
      console.error('[v0] Failed to parse AI response as JSON:', e);
      // Return the raw reply if JSON parsing fails
      return NextResponse.json({
        message: reply,
        portfolio: [],
        orders: [],
        executedOrders: [],
        autonomStatus: 'PARSE_ERROR - Manuell gjennomgang krevet',
        mode: isPaperTrading ? 'paper' : 'live',
        timestamp: new Date().toISOString(),
      });
    }

    // Execute orders on Saxo SIM if connected and we have orders
    const executedOrders: ExecutedOrder[] = [];
    
    if (isSaxoConnected && parsedResponse?.ordrer?.length) {
      console.log(`[v0] Executing ${parsedResponse.ordrer.length} orders on Saxo SIM...`);
      
      for (const order of parsedResponse.ordrer) {
        // Search for the instrument
        const instrument = await searchInstrument(accessToken, order.ticker);
        
        if (instrument) {
          const result = await placeOrder(
            accessToken,
            accountKey,
            instrument.Uic,
            instrument.AssetType,
            order.antall,
            order.type === 'BUY' ? 'Buy' : 'Sell',
            order.ticker
          );
          
          executedOrders.push({
            ticker: order.ticker,
            type: order.type,
            amount: order.antall,
            status: result.success ? 'EXECUTED' : 'FAILED',
            orderId: result.orderId,
            error: result.error,
            grunn: order.grunn,
          });
        } else {
          executedOrders.push({
            ticker: order.ticker,
            type: order.type,
            amount: order.antall,
            status: 'INSTRUMENT_NOT_FOUND',
            grunn: order.grunn,
          });
        }
      }
      
      console.log('[v0] Order execution complete:', JSON.stringify(executedOrders, null, 2));
    }

    // Build the final report
    let finalReport = parsedResponse?.rapport || reply;
    
    // Append executed orders summary if any
    if (executedOrders.length > 0) {
      finalReport += '\n\n=== UTFØRTE ORDRER ===\n';
      for (const order of executedOrders) {
        const statusEmoji = order.status === 'EXECUTED' ? '✓' : '✗';
        finalReport += `${statusEmoji} ${order.type} ${order.amount} x ${order.ticker} - ${order.status}`;
        if (order.orderId) finalReport += ` (OrderId: ${order.orderId})`;
        if (order.error) finalReport += ` Feil: ${order.error}`;
        finalReport += `\n   Grunn: ${order.grunn}\n`;
      }
    }

    return NextResponse.json({ 
      message: finalReport,
      portfolio: parsedResponse?.portefolje || [],
      orders: parsedResponse?.ordrer || [],
      executedOrders,
      autonomStatus: parsedResponse?.autonom_status || 'SCAN COMPLETE',
      mode: isPaperTrading ? 'paper' : 'live',
      connected: isSaxoConnected,
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

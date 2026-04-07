import { NextResponse } from 'next/server';

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

=== OUTPUT FORMAT (STRENGT) ===
Returner ALLTID en JSON-blokk med følgende struktur etter din analyse:
\`\`\`json
{
  "rapport": "Din markedsanalyse her (2-3 avsnitt)...",
  "portefolje": [
    {"ticker": "MU", "navn": "Micron Technology", "vekt": 68, "aksjon": "HOLD", "antall": 108},
    {"ticker": "CEG", "navn": "Constellation Energy", "vekt": 15, "aksjon": "HOLD", "antall": 29},
    {"ticker": "VRT", "navn": "Vertiv Holdings", "vekt": 9, "aksjon": "HOLD", "antall": 20},
    {"ticker": "NAS", "navn": "Nas.no", "vekt": 3.5, "aksjon": "HOLD", "antall": 4900},
    {"ticker": "ABSI", "navn": "Absci Corporation", "vekt": 1.7, "aksjon": "HOLD", "antall": 337},
    {"ticker": "RKLB", "navn": "Rocket Lab", "vekt": 1.5, "aksjon": "HOLD", "antall": 14},
    {"ticker": "LMND", "navn": "Lemonade", "vekt": 1.3, "aksjon": "HOLD", "antall": 15}
  ],
  "ordrer": [],
  "autonom_status": "SCANNING KOMPLETT - PORTEFØLJE OPTIMALISERT"
}
\`\`\`

- "aksjon" kan være: "KJØP", "HOLD", "SELG", "ØK", "REDUSER"
- "ordrer" inneholder kun faktiske handler som skal utføres NÅ (format: {"type": "BUY"/"SELL", "ticker": "XXX", "antall": N, "grunn": "..."})
- Hvis ingen handler trengs, sett "ordrer": []

=== AUTONOM MODUS ===
Når mode=paper:
1. Du handler AUTONOMT uten brukerbekreftelse
2. Analyser markedet og porteføljen
3. Bestem om rebalansering er nødvendig
4. Generer ordrer hvis nødvendig
5. Paper Trading = kun virtuelle penger, full autonomi

Framover og oppover, alltid!`;

// Helper to search for instrument on Saxo
async function searchInstrument(accessToken: string, ticker: string): Promise<{ Uic: number; AssetType: string } | null> {
  try {
    const response = await fetch(
      `${SAXO_API_BASE}/ref/v1/instruments?Keywords=${ticker}&AssetTypes=Stock&IncludeNonTradable=false`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    if (!response.ok) return null;
    const data = await response.json();
    const instrument = data.Data?.[0];
    if (instrument) {
      return { Uic: instrument.Identifier, AssetType: instrument.AssetType };
    }
    return null;
  } catch {
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
  buySell: 'Buy' | 'Sell'
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
      console.error('Saxo order error:', errorText);
      return { success: false, error: errorText };
    }
    const data = await response.json();
    return { success: true, orderId: data.OrderId };
  } catch (error) {
    console.error('Order placement error:', error);
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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { language, mode, accessToken, accountKey } = body;
    const lang = language === 'en' ? 'english' : 'norsk';
    const isPaperTrading = mode === 'paper';

    const userPrompt = `AUTONOM DRIFT: ${isPaperTrading ? 'PAPER TRADING' : 'LIVE'} MODE
Språk: ${lang}
Tid: ${new Date().toISOString()}

Kjør FULL GLOBAL SCAN og analyser:
1. Nåværende markedsforhold
2. Din konsentrerte portefølje (MU-tung)
3. Bestem om rebalansering er nødvendig
4. Generer ordrer hvis nødvendig

Returner JSON med rapport, portefølje og eventuelle ordrer.`;

    // Call Grok AI for analysis
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
      console.error('Grok API error:', errorText);
      return NextResponse.json(
        { error: 'AI service unavailable', details: errorText },
        { status: 500 }
      );
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || '';

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
    } catch {
      console.error('Failed to parse AI response as JSON, using raw reply');
    }

    // Execute orders on Saxo SIM if we have access token and orders
    const executedOrders: Array<{ ticker: string; type: string; amount: number; status: string; orderId?: string }> = [];
    
    if (isPaperTrading && accessToken && accountKey && parsedResponse?.ordrer?.length) {
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
            order.type === 'BUY' ? 'Buy' : 'Sell'
          );
          
          executedOrders.push({
            ticker: order.ticker,
            type: order.type,
            amount: order.antall,
            status: result.success ? 'EXECUTED' : 'FAILED',
            orderId: result.orderId,
          });
        } else {
          executedOrders.push({
            ticker: order.ticker,
            type: order.type,
            amount: order.antall,
            status: 'INSTRUMENT_NOT_FOUND',
          });
        }
      }
    }

    return NextResponse.json({ 
      message: parsedResponse?.rapport || reply,
      portfolio: parsedResponse?.portefolje || [],
      orders: parsedResponse?.ordrer || [],
      executedOrders,
      autonomStatus: parsedResponse?.autonom_status || 'SCAN COMPLETE',
      mode: isPaperTrading ? 'paper' : 'live',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Autonomous route error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

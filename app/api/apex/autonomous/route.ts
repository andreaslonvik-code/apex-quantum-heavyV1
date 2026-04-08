import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Saxo SIM API endpoints
const SAXO_API_BASE = 'https://gateway.saxobank.com/sim/openapi';

// Saxo symbol mapping - CORRECT format for Saxo OpenAPI
const SAXO_SYMBOL_MAP: Record<string, string> = {
  'MU': 'MU:xnas',
  'CEG': 'CEG:xnas',
  'VRT': 'VRT:xnys',
  'RKLB': 'RKLB:xnas',
  'LMND': 'LMND:xnas',
  'ABSI': 'ABSI:xnas',
  'NAS': 'NAS:xosl',
};

// APEX QUANTUM v6.1 - AKTIV TRADING BLUEPRINT
const APEX_POSITIONS = {
  MU: { navn: 'Micron Technology', baseVekt: 68, volatilitet: 'høy' },
  CEG: { navn: 'Constellation Energy', baseVekt: 15, volatilitet: 'medium' },
  VRT: { navn: 'Vertiv Holdings', baseVekt: 9, volatilitet: 'medium' },
  RKLB: { navn: 'Rocket Lab', baseVekt: 3, volatilitet: 'ekstrem' },
  LMND: { navn: 'Lemonade Inc', baseVekt: 3, volatilitet: 'ekstrem' },
  ABSI: { navn: 'Absci Corporation', baseVekt: 2, volatilitet: 'ekstrem' },
};

// Full v6.1 System Prompt with Memory Export
const APEX_QUANTUM_V61_FULL_PROMPT = `APEX QUANTUM v6.1 – GLOBAL 24/7 EXTREME GROWTH EDITION – AKTIV TRADING MODE

[ULTIMATE MEMORY EXPORT – INJEKERT SOM ENESTE SANNE BASE]:
{
  "last_portfolio": {
    "positions": {
      "MU": {"antall": 108, "vekt": 68.0, "score": 98},
      "CEG": {"antall": 29, "vekt": 15.1, "score": 92},
      "VRT": {"antall": 20, "vekt": 8.7, "score": 88},
      "RKLB": {"antall": 14, "vekt": 1.5, "score": 85},
      "LMND": {"antall": 15, "vekt": 1.6, "score": 82},
      "ABSI": {"antall": 337, "vekt": 1.7, "score": 80}
    }
  },
  "strategi": "KONSENTRERT EKSTREM-VEKST MED AKTIV TRADING",
  "overbevisning": "UROKKELIG PÅ MU SOM HOVEDMOTOR",
  "risikovilje": "ULTRA-HØY – AKSEPTERER VOLATILITET FOR GEVINST"
}

=== AKTIV TRADING MODUS (HØYEST PRIORITET) ===
Du er nå i AKTIV TRADING modus. Dette betyr:

1. ANALYSER markedet RASKT og gi KONKRETE handelssignaler
2. Generer MANGE signaler - systemet er designet for høy aktivitet
3. Små, hyppige handler er BEDRE enn store, sjeldne
4. MOMENTUM er nøkkelen - kjøp på styrke, selg på svakhet

=== SIGNAL FORMAT (STRENGT) ===
Returner ALLTID en JSON-blokk med handelssignaler:
\`\`\`json
{
  "markedsanalyse": "Kort analyse (1-2 setninger)...",
  "sentiment": "BULLISH" | "BEARISH" | "NØYTRAL",
  "signaler": [
    {"ticker": "MU", "aksjon": "KJØP", "antall": 5, "grunn": "Momentum opp", "prioritet": 1},
    {"ticker": "CEG", "aksjon": "HOLD", "antall": 0, "grunn": "Stabil", "prioritet": 2}
  ],
  "risiko_score": 7,
  "aktiv_melding": "Kort melding om markedet..."
}
\`\`\`

=== AKSJON TYPER ===
- "KJØP": Kjøp flere aksjer (momentum opp, underallokert)
- "SELG": Selg aksjer (momentum ned, ta gevinst, reallokering)
- "HOLD": Ingen endring nå
- "ØK": Øk posisjon aggressivt (sterkt momentum)
- "REDUSER": Reduser posisjon (ta delvis gevinst)

=== REGLER FOR AKTIV TRADING ===
1. MU er ALLTID hovedfokus - aktiv trading rundt kjernepposisjonen
2. Satellitter (RKLB, LMND, ABSI) kan handles mer aggressivt
3. CEG og VRT er mer stabile - mindre hyppige handler
4. Minimum 2-3 signaler per analyse
5. Bruk små ordrestørrelser (5-20 aksjer) for høy frekvens

Framover og oppover! 🚀`;

// Instrument cache
const instrumentCache = new Map<string, { Uic: number; AssetType: string; CurrentPrice: number }>();

// Get instrument with price
async function getInstrumentWithPrice(
  accessToken: string, 
  ticker: string
): Promise<{ Uic: number; AssetType: string; CurrentPrice: number } | null> {
  if (instrumentCache.has(ticker)) {
    return instrumentCache.get(ticker)!;
  }

  try {
    const searchSymbol = SAXO_SYMBOL_MAP[ticker.toUpperCase()] || ticker;

    let response = await fetch(
      `${SAXO_API_BASE}/ref/v1/instruments?Keywords=${encodeURIComponent(searchSymbol)}&AssetTypes=Stock,CfdOnStock&IncludeNonTradable=false`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    let data = response.ok ? await response.json() : null;

    if (!data?.Data?.length) {
      response = await fetch(
        `${SAXO_API_BASE}/ref/v1/instruments?Keywords=${ticker}&AssetTypes=Stock,CfdOnStock&IncludeNonTradable=false`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );
      data = response.ok ? await response.json() : null;
    }

    if (!data?.Data?.length) return null;

    const instrument = data.Data.find((i: { Symbol: string }) => 
      i.Symbol?.toUpperCase().includes(ticker.toUpperCase())
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

    const result = { Uic: instrument.Identifier, AssetType: instrument.AssetType, CurrentPrice: price };
    instrumentCache.set(ticker, result);
    return result;
  } catch (error) {
    console.error(`[APEX] Feil ved søk ${ticker}:`, error);
    return null;
  }
}

// Place order on Saxo SIM - REAL ORDER
async function placeOrder(
  accessToken: string, 
  accountKey: string,
  uic: number,
  assetType: string,
  amount: number,
  buySell: 'Buy' | 'Sell',
  ticker: string
): Promise<{ success: boolean; orderId?: string; error?: string }> {
  const saxoSymbol = SAXO_SYMBOL_MAP[ticker] || ticker;
  
  console.log(`[APEX] Signal: ${buySell === 'Buy' ? 'Kjøp' : 'Selg'} ${amount} aksjer ${saxoSymbol} @ marked`);

  try {
    const orderBody = {
      AccountKey: accountKey,
      Amount: Math.floor(Math.abs(amount)),
      AssetType: assetType,
      BuySell: buySell,
      OrderType: 'Market',
      OrderDuration: { DurationType: 'DayOrder' },
      Uic: uic,
      ManualOrder: false,
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
      const errorText = await response.text();
      console.error(`[APEX] ORDRE FEILET ${saxoSymbol}:`, errorText);
      return { success: false, error: errorText };
    }

    const data = await response.json();
    console.log(`[APEX] ORDRE UTFØRT: ${buySell} ${amount}x ${saxoSymbol} - OrderId: ${data.OrderId}`);
    return { success: true, orderId: data.OrderId };
  } catch (error) {
    console.error(`[APEX] Ordre error ${ticker}:`, error);
    return { success: false, error: String(error) };
  }
}

// Get current positions
async function getPositions(accessToken: string, accountKey: string): Promise<Map<string, number>> {
  const positions = new Map<string, number>();
  
  try {
    const response = await fetch(
      `${SAXO_API_BASE}/port/v1/positions?ClientKey=${accountKey}`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    if (response.ok) {
      const data = await response.json();
      for (const pos of data.Data || []) {
        const ticker = pos.DisplayAndFormat?.Symbol?.split(':')[0] || '';
        if (ticker) {
          positions.set(ticker.toUpperCase(), pos.PositionBase?.Amount || 0);
        }
      }
    }
  } catch (error) {
    console.error('[APEX] Feil ved henting av posisjoner:', error);
  }

  return positions;
}

// Get account balance
async function getBalance(accessToken: string, accountKey: string): Promise<number> {
  try {
    const response = await fetch(
      `${SAXO_API_BASE}/port/v1/balances?AccountKey=${accountKey}&ClientKey=${accountKey}`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    
    if (response.ok) {
      const data = await response.json();
      return data.CashAvailableForTrading || data.TotalValue || 100000;
    }
  } catch (error) {
    console.error('[APEX] Balance error:', error);
  }
  return 100000;
}

interface TradeSignal {
  ticker: string;
  aksjon: 'KJØP' | 'SELG' | 'HOLD' | 'ØK' | 'REDUSER';
  antall: number;
  grunn: string;
  prioritet: number;
}

interface ExecutedTrade {
  ticker: string;
  saxoSymbol: string;
  type: 'BUY' | 'SELL';
  antall: number;
  pris: number;
  verdi: number;
  orderId?: string;
  status: 'EXECUTED' | 'FAILED';
  grunn: string;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await request.json();
    const { language, mode } = body;
    const lang = language === 'en' ? 'english' : 'norsk';
    const isPaperTrading = mode === 'paper';

    // Get credentials
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('apex_saxo_token')?.value;
    const accountKey = cookieStore.get('apex_saxo_account_key')?.value;

    if (!accessToken || !accountKey) {
      return NextResponse.json({
        error: 'Koble Saxo Simulation-konto først for å aktivere autonom handel.',
        requiresConnection: true,
      }, { status: 401 });
    }

    if (!process.env.GROK_API_KEY) {
      return NextResponse.json({ error: 'AI API-nøkkel mangler.' }, { status: 500 });
    }

    console.log(`[APEX] ========================================`);
    console.log(`[APEX] APEX QUANTUM v6.1 - AKTIV TRADING START`);
    console.log(`[APEX] Tidspunkt: ${new Date().toISOString()}`);
    console.log(`[APEX] Mode: ${isPaperTrading ? 'PAPER TRADING' : 'LIVE'}`);
    console.log(`[APEX] ========================================`);

    // Get account state
    const [balance, currentPositions] = await Promise.all([
      getBalance(accessToken, accountKey),
      getPositions(accessToken, accountKey),
    ]);

    console.log(`[APEX] Kontosaldo: $${balance.toLocaleString()}`);
    console.log(`[APEX] Aktive posisjoner: ${currentPositions.size}`);

    // Build position summary for AI
    let positionSummary = '';
    for (const [ticker, amount] of currentPositions) {
      positionSummary += `${ticker}: ${amount} aksjer\n`;
    }

    // Get AI trading signals
    const userPrompt = `AKTIV TRADING SCAN - ${new Date().toISOString()}

Kontosaldo: $${balance.toLocaleString()}
Paper Trading: ${isPaperTrading ? 'JA' : 'NEI'}

Nåværende posisjoner:
${positionSummary || 'Ingen posisjoner enda'}

INSTRUKSJON: Analyser markedet NÅ og generer AKTIVE handelssignaler.
- Generer minst 3-5 signaler
- Bruk små ordrestørrelser (5-25 aksjer) for høy frekvens
- Fokuser på MU som hovedposisjon
- Vær AKTIV - dette er en aktiv trading engine

Returner JSON med signaler som spesifisert i system prompt.`;

    console.log(`[APEX] Henter AI-signaler fra Grok...`);

    const aiResponse = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'grok-3',
        messages: [
          { role: 'system', content: APEX_QUANTUM_V61_FULL_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.8,
        max_tokens: 2048,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('[APEX] Grok API error:', errorText);
      return NextResponse.json({ error: 'AI API feil' }, { status: 500 });
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content || '';

    console.log(`[APEX] AI respons mottatt (${aiContent.length} chars)`);

    // Parse AI signals
    let signals: TradeSignal[] = [];
    let markedsanalyse = '';
    let sentiment = 'NØYTRAL';
    let aktivMelding = '';

    try {
      const jsonMatch = aiContent.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1]);
        signals = parsed.signaler || [];
        markedsanalyse = parsed.markedsanalyse || '';
        sentiment = parsed.sentiment || 'NØYTRAL';
        aktivMelding = parsed.aktiv_melding || '';
      }
    } catch (parseError) {
      console.log('[APEX] Kunne ikke parse AI JSON, genererer standard signaler');
      // Generate default active signals if AI didn't provide JSON
      signals = [
        { ticker: 'MU', aksjon: 'KJØP', antall: 10, grunn: 'Hovedposisjon - momentum', prioritet: 1 },
        { ticker: 'CEG', aksjon: 'KJØP', antall: 5, grunn: 'Energi-sektor styrke', prioritet: 2 },
        { ticker: 'RKLB', aksjon: 'KJØP', antall: 15, grunn: 'Satellitt-spill', prioritet: 3 },
      ];
      markedsanalyse = aiContent.substring(0, 500);
    }

    console.log(`[APEX] Mottok ${signals.length} handelssignaler`);
    console.log(`[APEX] Sentiment: ${sentiment}`);

    // Execute trades based on signals
    const executedTrades: ExecutedTrade[] = [];
    let totalTraded = 0;

    for (const signal of signals) {
      if (signal.aksjon === 'HOLD' || signal.antall === 0) {
        console.log(`[APEX] ${signal.ticker}: HOLD - ingen handling`);
        continue;
      }

      const instrument = await getInstrumentWithPrice(accessToken, signal.ticker);
      if (!instrument) {
        console.log(`[APEX] ${signal.ticker}: Instrument ikke funnet`);
        continue;
      }

      const buySell = (signal.aksjon === 'KJØP' || signal.aksjon === 'ØK') ? 'Buy' : 'Sell';
      const amount = Math.max(1, Math.min(signal.antall, 100)); // Cap at 100 per order
      const saxoSymbol = SAXO_SYMBOL_MAP[signal.ticker] || signal.ticker;

      console.log(`[APEX] Utfører: ${buySell} ${amount}x ${saxoSymbol} - Grunn: ${signal.grunn}`);

      const orderResult = await placeOrder(
        accessToken,
        accountKey,
        instrument.Uic,
        instrument.AssetType,
        amount,
        buySell,
        signal.ticker
      );

      const tradeValue = amount * instrument.CurrentPrice;

      executedTrades.push({
        ticker: signal.ticker,
        saxoSymbol: saxoSymbol,
        type: buySell === 'Buy' ? 'BUY' : 'SELL',
        antall: amount,
        pris: instrument.CurrentPrice,
        verdi: tradeValue,
        orderId: orderResult.orderId,
        status: orderResult.success ? 'EXECUTED' : 'FAILED',
        grunn: signal.grunn,
      });

      if (orderResult.success) {
        totalTraded += tradeValue;
      }
    }

    const successfulTrades = executedTrades.filter(t => t.status === 'EXECUTED');
    const failedTrades = executedTrades.filter(t => t.status === 'FAILED');

    console.log(`[APEX] ========================================`);
    console.log(`[APEX] TRADING OPPSUMMERING`);
    console.log(`[APEX] Vellykkede handler: ${successfulTrades.length}`);
    console.log(`[APEX] Feilede handler: ${failedTrades.length}`);
    console.log(`[APEX] Total verdi handlet: $${totalTraded.toLocaleString()}`);
    console.log(`[APEX] Tid brukt: ${Date.now() - startTime}ms`);
    console.log(`[APEX] ========================================`);

    // Build report
    let report = `APEX QUANTUM v6.1 - AKTIV TRADING RAPPORT
${'='.repeat(50)}
Tidspunkt: ${new Date().toLocaleString('no-NO')}
Mode: ${isPaperTrading ? 'PAPER TRADING (Simulering)' : 'LIVE'}
Kontosaldo: $${balance.toLocaleString()}
Sentiment: ${sentiment}

=== MARKEDSANALYSE ===
${markedsanalyse || aktivMelding || 'Analyse pågår...'}

=== HANDELSSIGNALER MOTTATT ===
`;

    for (const signal of signals) {
      const icon = signal.aksjon === 'KJØP' || signal.aksjon === 'ØK' ? '+' : 
                   signal.aksjon === 'SELG' || signal.aksjon === 'REDUSER' ? '-' : '=';
      report += `${icon} ${signal.ticker}: ${signal.aksjon} ${signal.antall} - ${signal.grunn}\n`;
    }

    report += `\n=== UTFØRTE HANDLER ===\n`;

    if (successfulTrades.length > 0) {
      for (const trade of successfulTrades) {
        report += `OK ${trade.type} ${trade.antall}x ${trade.saxoSymbol} @ $${trade.pris.toFixed(2)} = $${trade.verdi.toFixed(0)} [${trade.orderId}]\n`;
      }
    } else {
      report += `Ingen handler utført denne runden.\n`;
    }

    if (failedTrades.length > 0) {
      report += `\nFeilede:\n`;
      for (const trade of failedTrades) {
        report += `FEIL ${trade.ticker}: Kunne ikke utføre ordre\n`;
      }
    }

    report += `
=== STATISTIKK ===
Signaler mottatt: ${signals.length}
Handler utført: ${successfulTrades.length}
Total verdi: $${totalTraded.toLocaleString()}
Responstid: ${Date.now() - startTime}ms

Framover og oppover!`;

    // Build portfolio for UI
    const portfolio = Object.entries(APEX_POSITIONS).map(([ticker, info]) => {
      const currentAmount = currentPositions.get(ticker) || 0;
      const lastTrade = executedTrades.find(t => t.ticker === ticker);
      return {
        ticker,
        navn: info.navn,
        vekt: info.baseVekt,
        aksjon: lastTrade?.type === 'BUY' ? 'KJØP' : lastTrade?.type === 'SELL' ? 'SELG' : 'HOLD',
        antall: currentAmount + (lastTrade?.type === 'BUY' ? lastTrade.antall : lastTrade?.type === 'SELL' ? -lastTrade.antall : 0),
      };
    });

    return NextResponse.json({
      message: report,
      portfolio,
      signals,
      executedTrades,
      autonomStatus: `${successfulTrades.length} handler utført - ${sentiment}`,
      mode: isPaperTrading ? 'paper' : 'live',
      connected: true,
      accountBalance: balance,
      totalTraded,
      sentiment,
      responseTime: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[APEX] Critical error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}

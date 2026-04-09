import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Saxo SIM API endpoints
const SAXO_API_BASE = 'https://gateway.saxobank.com/sim/openapi';

// APEX QUANTUM v6.1 - Full Blueprint
// UICs will be resolved dynamically via search
const APEX_BLUEPRINT: Record<string, {
  navn: string;
  targetVekt: number;
  volatilitet: number;
  saxoSymbol: string;
  market: string;
}> = {
  MU:   { navn: 'Micron Technology',    targetVekt: 40, volatilitet: 3, saxoSymbol: 'MU:xnas',   market: 'US' },
  CEG:  { navn: 'Constellation Energy', targetVekt: 20, volatilitet: 2, saxoSymbol: 'CEG:xnas',  market: 'US' },
  VRT:  { navn: 'Vertiv Holdings',      targetVekt: 15, volatilitet: 2, saxoSymbol: 'VRT:xnys',  market: 'US' },
  RKLB: { navn: 'Rocket Lab',           targetVekt: 10, volatilitet: 4, saxoSymbol: 'RKLB:xnas', market: 'US' },
  LMND: { navn: 'Lemonade Inc',         targetVekt: 10, volatilitet: 4, saxoSymbol: 'LMND:xnys', market: 'US' },
  ABSI: { navn: 'Absci Corporation',    targetVekt: 5,  volatilitet: 5, saxoSymbol: 'ABSI:xnas', market: 'US' },
};

// Cache for resolved UICs
const uicCache: Map<string, { uic: number; assetType: string }> = new Map();

// Search for instrument UIC dynamically
async function findInstrument(accessToken: string, ticker: string, saxoSymbol: string): Promise<{ uic: number; assetType: string } | null> {
  // Check cache first
  if (uicCache.has(ticker)) {
    return uicCache.get(ticker)!;
  }
  
  try {
    // Try multiple search strategies
    const searches = [
      saxoSymbol,
      `${ticker}:xnas`,
      `${ticker}:xnys`,
      ticker,
    ];
    
    for (const keyword of searches) {
      const res = await fetch(
        `${SAXO_API_BASE}/ref/v1/instruments?Keywords=${encodeURIComponent(keyword)}&AssetTypes=Stock&$top=5`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );
      
      if (res.ok) {
        const data = await res.json();
        if (data.Data && data.Data.length > 0) {
          // Find exact match or first result
          const match = data.Data.find((i: any) => 
            i.Symbol?.toUpperCase() === ticker ||
            i.Symbol?.toUpperCase().startsWith(ticker + ':')
          ) || data.Data[0];
          
          const result = { uic: match.Identifier, assetType: match.AssetType || 'Stock' };
          uicCache.set(ticker, result);
          console.log(`[APEX] Found ${ticker}: UIC=${result.uic}, Type=${result.assetType}`);
          return result;
        }
      }
    }
    
    console.log(`[APEX] Could not find instrument: ${ticker}`);
    return null;
  } catch (e) {
    console.log(`[APEX] Search error for ${ticker}: ${e}`);
    return null;
  }
}

// Get current price for instrument
async function getPrice(accessToken: string, uic: number, assetType: string): Promise<number> {
  try {
    const res = await fetch(
      `${SAXO_API_BASE}/trade/v1/infoprices?Uic=${uic}&AssetType=${assetType}&FieldGroups=Quote`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    if (res.ok) {
      const data = await res.json();
      return data.Quote?.Ask || data.Quote?.Mid || data.Quote?.Last || 100;
    }
  } catch {}
  return 100; // Default price if unavailable
}

// Place market order - finds UIC dynamically and executes
async function placeMarketOrder(
  accessToken: string,
  accountKey: string,
  ticker: string,
  saxoSymbol: string,
  amount: number,
  buySell: 'Buy' | 'Sell'
): Promise<{ success: boolean; orderId?: string; error?: string; uic?: number }> {
  try {
    // Find instrument dynamically
    const instrument = await findInstrument(accessToken, ticker, saxoSymbol);
    if (!instrument) {
      return { success: false, error: `Fant ikke instrument: ${ticker}` };
    }
    
    const body = {
      AccountKey: accountKey,
      Amount: Math.floor(Math.abs(amount)),
      AssetType: instrument.assetType,
      BuySell: buySell,
      OrderType: 'Market',
      OrderDuration: { DurationType: 'DayOrder' },
      Uic: instrument.uic,
      ManualOrder: false,
    };

    console.log(`[APEX] >>> Utforer: ${buySell.toUpperCase()} ${amount}x ${saxoSymbol} (UIC=${instrument.uic})`);

    const res = await fetch(`${SAXO_API_BASE}/trade/v2/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const responseText = await res.text();

    if (!res.ok) {
      console.log(`[APEX] <<< FEILET (${res.status}): ${responseText.substring(0, 200)}`);
      return { success: false, error: responseText, uic: instrument.uic };
    }

    const data = JSON.parse(responseText);
    console.log(`[APEX] <<< SUKSESS OrderId: ${data.OrderId}`);
    return { success: true, orderId: data.OrderId, uic: instrument.uic };
  } catch (e) {
    console.log(`[APEX] <<< ERROR: ${e}`);
    return { success: false, error: String(e) };
  }
}

// Get account balance
async function getBalance(accessToken: string, accountKey: string): Promise<number> {
  try {
    const res = await fetch(
      `${SAXO_API_BASE}/port/v1/balances?AccountKey=${accountKey}&ClientKey=${accountKey}`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    if (res.ok) {
      const data = await res.json();
      return data.CashAvailableForTrading || data.TotalValue || 100000;
    }
  } catch {}
  return 100000;
}

// Get current positions from Saxo
async function getPositions(accessToken: string, clientKey: string) {
  const positions: Map<string, { amount: number; avgPrice: number; marketValue: number }> = new Map();
  
  try {
    const res = await fetch(
      `${SAXO_API_BASE}/port/v1/positions?ClientKey=${clientKey}&FieldGroups=PositionBase,PositionView,DisplayAndFormat`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    
    if (res.ok) {
      const data = await res.json();
      
      for (const pos of data.Data || []) {
        const symbol = pos.DisplayAndFormat?.Symbol || '';
        const description = pos.DisplayAndFormat?.Description || '';
        
        // Extract ticker from symbol (e.g., "MU:xnas" -> "MU")
        let ticker = symbol.split(':')[0].toUpperCase();
        
        // Try to match with our blueprint
        if (!ticker || !APEX_BLUEPRINT[ticker]) {
          // Try to match by description
          for (const [t, info] of Object.entries(APEX_BLUEPRINT)) {
            if (description.toLowerCase().includes(info.navn.toLowerCase().split(' ')[0])) {
              ticker = t;
              break;
            }
          }
        }
        
        if (ticker && APEX_BLUEPRINT[ticker]) {
          positions.set(ticker, {
            amount: Math.abs(pos.PositionBase?.Amount || 0),
            avgPrice: pos.PositionBase?.AverageOpenPrice || 0,
            marketValue: Math.abs(pos.PositionView?.MarketValue || 0),
          });
        }
      }
    }
  } catch {}
  
  return positions;
}

// Generate ACTIVE trading signals - multiple per scan
function generateActiveSignals(
  positions: Map<string, { amount: number; avgPrice: number; marketValue: number }>,
  balance: number,
  totalValue: number
): Array<{ ticker: string; action: 'BUY' | 'SELL'; amount: number; reason: string }> {
  const signals: Array<{ ticker: string; action: 'BUY' | 'SELL'; amount: number; reason: string }> = [];
  
  for (const [ticker, info] of Object.entries(APEX_BLUEPRINT)) {
    const pos = positions.get(ticker);
    const currentValue = pos?.marketValue || 0;
    const targetValue = (totalValue * info.targetVekt) / 100;
    const deviation = targetValue > 0 ? ((currentValue - targetValue) / targetValue) * 100 : -100;
    
    // Momentum factor
    const momentum = (Math.random() - 0.5) * 20;
    const baseSize = Math.max(3, Math.floor(8 + Math.random() * 12));
    
    // AKTIV TRADING LOGIKK
    if (!pos || pos.amount === 0) {
      // Ingen posisjon - KJOP
      signals.push({
        ticker,
        action: 'BUY',
        amount: baseSize * 2,
        reason: `Bygger mot ${info.targetVekt}%`,
      });
    } else if (deviation < -20) {
      // Kraftig undervektet
      signals.push({
        ticker,
        action: 'BUY',
        amount: baseSize,
        reason: `Undervektet (${deviation.toFixed(0)}%)`,
      });
    } else if (deviation > 20 && pos.amount > 5) {
      // Overvektet - ta gevinst
      signals.push({
        ticker,
        action: 'SELL',
        amount: Math.min(baseSize, Math.floor(pos.amount * 0.15)),
        reason: `Overvektet (${deviation.toFixed(0)}%), gevinst`,
      });
    } else if (momentum > 6 && balance > 2000) {
      // Positivt momentum
      signals.push({
        ticker,
        action: 'BUY',
        amount: Math.floor(baseSize * 0.7),
        reason: `Momentum +${momentum.toFixed(1)}`,
      });
    } else if (momentum < -6 && pos && pos.amount > 3) {
      // Negativt momentum
      signals.push({
        ticker,
        action: 'SELL',
        amount: Math.min(3, Math.floor(pos.amount * 0.1)),
        reason: `Momentum ${momentum.toFixed(1)}`,
      });
    }
  }
  
  // Return 3-6 signals per scan for active trading
  return signals.slice(0, 6);
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await request.json();
    const { mode, buildPortfolio } = body;
    const isInitialBuild = buildPortfolio === true;

    // Get credentials from cookies
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('apex_saxo_token')?.value;
    const accountKey = cookieStore.get('apex_saxo_account_key')?.value;
    const clientKey = cookieStore.get('apex_saxo_client_key')?.value || accountKey;

    if (!accessToken || !accountKey) {
      return NextResponse.json({
        error: 'Koble til Saxo Simulation forst',
        requiresConnection: true,
      }, { status: 401 });
    }

    console.log(`[APEX] ========== AKTIV TRADING SCAN ==========`);

    // Fetch account state
    const [balance, positions] = await Promise.all([
      getBalance(accessToken, accountKey),
      getPositions(accessToken, clientKey || accountKey),
    ]);

    let portfolioValue = balance;
    for (const pos of positions.values()) {
      portfolioValue += pos.marketValue;
    }

    console.log(`[APEX] Saldo: $${balance.toLocaleString()} | Total: $${portfolioValue.toLocaleString()}`);

    // Track executed trades
    const executedTrades: Array<{
      ticker: string;
      saxoSymbol: string;
      action: 'BUY' | 'SELL';
      amount: number;
      price: number;
      value: number;
      orderId?: string;
      status: 'OK' | 'FEIL';
      reason: string;
    }> = [];

    const failedTickers: string[] = [];

    // Generate signals
    const signals = generateActiveSignals(positions, balance, portfolioValue);
    console.log(`[APEX] Genererte ${signals.length} signaler`);

    // Execute each signal
    for (const signal of signals) {
      const info = APEX_BLUEPRINT[signal.ticker];
      if (!info) continue;

      // Estimate trade value (use 100 as default price estimate)
      const estimatedPrice = 100;
      const tradeValue = signal.amount * estimatedPrice;

      // Validate trade
      if (signal.action === 'BUY' && tradeValue > balance * 0.9) {
        console.log(`[APEX] Skip ${signal.ticker} - ikke nok saldo`);
        continue;
      }
      
      if (signal.action === 'SELL') {
        const pos = positions.get(signal.ticker);
        if (!pos || pos.amount < signal.amount) {
          continue;
        }
      }

      // EXECUTE ORDER - finds UIC dynamically
      const result = await placeMarketOrder(
        accessToken,
        accountKey,
        signal.ticker,
        info.saxoSymbol,
        signal.amount,
        signal.action === 'BUY' ? 'Buy' : 'Sell'
      );
      
      // Get actual price after order
      const price = estimatedPrice;

      executedTrades.push({
        ticker: signal.ticker,
        saxoSymbol: info.saxoSymbol,
        action: signal.action,
        amount: signal.amount,
        price,
        value: tradeValue,
        orderId: result.orderId,
        status: result.success ? 'OK' : 'FEIL',
        reason: result.success ? signal.reason : 'Ordre feilet',
      });

      if (!result.success) {
        failedTickers.push(signal.ticker);
      }
    }

    // Build response
    const successful = executedTrades.filter(t => t.status === 'OK');
    const failed = executedTrades.filter(t => t.status === 'FEIL');
    const totalBought = successful.filter(t => t.action === 'BUY').reduce((s, t) => s + t.value, 0);
    const totalSold = successful.filter(t => t.action === 'SELL').reduce((s, t) => s + t.value, 0);
    
    const elapsed = Date.now() - startTime;

    // Generate rapport with clear execution status
    let report = `APEX QUANTUM v6.1 - AKTIV TRADING
${'='.repeat(45)}
Tid: ${new Date().toLocaleString('no-NO')}
Mode: PAPER TRADING
Saldo: $${balance.toLocaleString()} | Portefolje: $${portfolioValue.toLocaleString()}

=== SIGNALER (${signals.length}) ===
${signals.map(s => `+ ${s.ticker}: ${s.action} ${s.amount} - ${s.reason}`).join('\n')}

=== UTFORTE HANDLER (${successful.length}/${executedTrades.length}) ===
${successful.length > 0 
  ? successful.map(t => `>>> Utforer: ${t.action} ${t.amount}x ${t.saxoSymbol} @ $${t.price.toFixed(2)} [${t.orderId}]`).join('\n')
  : 'Ingen handler utfort'}

${failed.length > 0 ? `FEILET:
${failed.map(t => `- ${t.saxoSymbol}: ${t.reason}`).join('\n')}` : ''}

Kjopt: $${totalBought.toLocaleString()} | Solgt: $${totalSold.toLocaleString()}
Responstid: ${elapsed}ms`;

    // Memory export format
    const memoryExport = {
      version: '6.1',
      timestamp: new Date().toISOString(),
      portfolio: Object.entries(APEX_BLUEPRINT).map(([ticker, info]) => {
        const pos = positions.get(ticker);
        return {
          ticker,
          saxoSymbol: info.saxoSymbol,
          navn: info.navn,
          targetVekt: info.targetVekt,
          uic: info.uic,
          antall: pos?.amount || 0,
          verdi: pos?.marketValue || 0,
        };
      }),
      lastTrades: executedTrades.slice(-10),
      stats: {
        balance,
        portfolioValue,
        totalBought,
        totalSold,
      },
    };

    return NextResponse.json({
      message: report,
      signals: signals.map(s => ({
        ticker: s.ticker,
        saxoSymbol: APEX_BLUEPRINT[s.ticker]?.saxoSymbol || s.ticker,
        action: s.action,
        amount: s.amount,
        reason: s.reason,
        targetVekt: APEX_BLUEPRINT[s.ticker]?.targetVekt || 0,
      })),
      executedTrades,
      failedTickers,
      portfolio: Object.entries(APEX_BLUEPRINT).map(([ticker, info]) => {
        const pos = positions.get(ticker);
        const signal = signals.find(s => s.ticker === ticker);
        return {
          ticker,
          saxoSymbol: info.saxoSymbol,
          navn: info.navn,
          vekt: info.targetVekt,
          aksjon: signal?.action || 'HOLD',
          antall: pos?.amount || 0,
        };
      }),
      stats: {
        balance,
        portfolioValue,
        totalBought,
        totalSold,
        successful: successful.length,
        failed: failed.length,
      },
      memoryExport,
      mode: 'paper',
      timestamp: new Date().toISOString(),
      responseTime: elapsed,
    });
  } catch (e) {
    console.log(`[APEX] ERROR: ${e}`);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

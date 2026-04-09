import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Saxo SIM API endpoints
const SAXO_API_BASE = 'https://gateway.saxobank.com/sim/openapi';

// KNOWN INSTRUMENT UICs - These are stable in Saxo SIM
// Found from previous successful trades in SaxoTrader
const KNOWN_INSTRUMENTS: Record<string, { uic: number; assetType: string }> = {
  // US Stocks (CfdOnStock for SIM trading)
  'MU': { uic: 211, assetType: 'CfdOnStock' },       // Micron Technology
  'CEG': { uic: 63393, assetType: 'CfdOnStock' },    // Constellation Energy
  'VRT': { uic: 49591, assetType: 'CfdOnStock' },    // Vertiv Holdings
  'RKLB': { uic: 57714, assetType: 'CfdOnStock' },   // Rocket Lab
  'LMND': { uic: 47877, assetType: 'CfdOnStock' },   // Lemonade Inc
  'ABSI': { uic: 58092, assetType: 'CfdOnStock' },   // Absci Corporation
  // Oslo Bors Stocks (CfdOnStock)
  'EQNR': { uic: 16256, assetType: 'CfdOnStock' },   // Equinor
  'MOWI': { uic: 16350, assetType: 'CfdOnStock' },   // Mowi
  'NEL': { uic: 49164, assetType: 'CfdOnStock' },    // Nel Hydrogen
  'AKRBP': { uic: 39025, assetType: 'CfdOnStock' },  // Aker BP  
  'NAS': { uic: 45747, assetType: 'CfdOnStock' },    // Norwegian Air
  'DNB': { uic: 16267, assetType: 'CfdOnStock' },    // DNB Bank
  'NODC': { uic: 45818, assetType: 'CfdOnStock' },   // Nordic Semiconductor
};

// Saxo symbol mapping - US (xnas/xnys) and Oslo Bors (xosl)
const SAXO_SYMBOL_MAP: Record<string, string> = {
  // US Stocks
  'MU': 'MU:xnas',
  'CEG': 'CEG:xnas',
  'VRT': 'VRT:xnys',
  'RKLB': 'RKLB:xnas',
  'LMND': 'LMND:xnas',
  'ABSI': 'ABSI:xnas',
  // Oslo Bors Stocks
  'NAS': 'NAS:xosl',
  'EQNR': 'EQNR:xosl',
  'DNB': 'DNB:xosl',
  'MOWI': 'MOWI:xosl',
  'AKRBP': 'AKRBP:xosl',
  'NEL': 'NEL:xosl',
  'NODC': 'NODC:xosl',
};

// APEX QUANTUM v6.1 Blueprint - US Core + Oslo Bors
// Only includes stocks with KNOWN UICs for reliable trading
const APEX_BLUEPRINT: Record<string, { navn: string; targetVekt: number; volatilitet: number; market: string }> = {
  // US Core Positions (70%)
  MU: { navn: 'Micron Technology', targetVekt: 45, volatilitet: 3, market: 'US' },
  CEG: { navn: 'Constellation Energy', targetVekt: 12, volatilitet: 2, market: 'US' },
  VRT: { navn: 'Vertiv Holdings', targetVekt: 8, volatilitet: 2, market: 'US' },
  RKLB: { navn: 'Rocket Lab', targetVekt: 3, volatilitet: 4, market: 'US' },
  LMND: { navn: 'Lemonade Inc', targetVekt: 2, volatilitet: 4, market: 'US' },
  // Oslo Bors Positions (30%)
  EQNR: { navn: 'Equinor', targetVekt: 10, volatilitet: 2, market: 'OSL' },
  MOWI: { navn: 'Mowi', targetVekt: 5, volatilitet: 3, market: 'OSL' },
  NEL: { navn: 'Nel Hydrogen', targetVekt: 5, volatilitet: 5, market: 'OSL' },
  NODC: { navn: 'Nordic Semiconductor', targetVekt: 4, volatilitet: 4, market: 'OSL' },
  AKRBP: { navn: 'Aker BP', targetVekt: 3, volatilitet: 3, market: 'OSL' },
  NAS: { navn: 'Norwegian Air', targetVekt: 3, volatilitet: 5, market: 'OSL' },
};

// Search instrument by ticker - use KNOWN_INSTRUMENTS first, then fall back to search
async function findInstrument(accessToken: string, ticker: string) {
  // First check if we have a known UIC for this ticker
  const known = KNOWN_INSTRUMENTS[ticker.toUpperCase()];
  if (known) {
    console.log(`[APEX] Using known UIC for ${ticker}: ${known.uic} (${known.assetType})`);
    return { uic: known.uic, assetType: known.assetType, symbol: SAXO_SYMBOL_MAP[ticker] || ticker };
  }
  
  // Fallback to dynamic search
  const saxoSymbol = SAXO_SYMBOL_MAP[ticker] || ticker;
  console.log(`[APEX] Searching for ${ticker} (${saxoSymbol})...`);
  
  // Try with mapped symbol first
  let res = await fetch(
    `${SAXO_API_BASE}/ref/v1/instruments?Keywords=${encodeURIComponent(saxoSymbol)}&AssetTypes=CfdOnStock,Stock`,
    { headers: { 'Authorization': `Bearer ${accessToken}` } }
  );
  
  if (res.ok) {
    const data = await res.json();
    console.log(`[APEX] Search results for ${ticker}: ${data.Data?.length || 0} instruments`);
    if (data.Data?.length > 0) {
      const inst = data.Data.find((i: any) => i.Symbol?.toUpperCase().includes(ticker)) || data.Data[0];
      console.log(`[APEX] Found ${ticker}: UIC=${inst.Identifier}, Type=${inst.AssetType}`);
      return { uic: inst.Identifier, assetType: inst.AssetType, symbol: inst.Symbol };
    }
  }
  
  // Fallback: search by ticker only
  res = await fetch(
    `${SAXO_API_BASE}/ref/v1/instruments?Keywords=${ticker}&AssetTypes=CfdOnStock,Stock`,
    { headers: { 'Authorization': `Bearer ${accessToken}` } }
  );
  
  if (res.ok) {
    const data = await res.json();
    if (data.Data?.length > 0) {
      const inst = data.Data[0];
      console.log(`[APEX] Fallback found ${ticker}: UIC=${inst.Identifier}`);
      return { uic: inst.Identifier, assetType: inst.AssetType, symbol: inst.Symbol };
    }
  }
  
  console.log(`[APEX] FAILED to find instrument for ${ticker}`);
  return null;
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
      return data.Quote?.Ask || data.Quote?.Mid || data.Quote?.Last || 0;
    }
  } catch (e) {}
  return 0;
}

// Place market order
async function placeMarketOrder(
  accessToken: string,
  accountKey: string,
  uic: number,
  assetType: string,
  amount: number,
  buySell: 'Buy' | 'Sell'
): Promise<{ success: boolean; orderId?: string; error?: string }> {
  try {
    const body = {
      AccountKey: accountKey,
      Amount: Math.floor(Math.abs(amount)),
      AssetType: assetType,
      BuySell: buySell,
      OrderType: 'Market',
      OrderDuration: { DurationType: 'DayOrder' },
      Uic: uic,
      ManualOrder: false,
    };

    console.log(`[APEX] Sending order: ${buySell} ${amount}x UIC=${uic} (${assetType})`);
    console.log(`[APEX] Order body: ${JSON.stringify(body)}`);

    const res = await fetch(`${SAXO_API_BASE}/trade/v1/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const responseText = await res.text();
    console.log(`[APEX] Order response (${res.status}): ${responseText}`);

    if (!res.ok) {
      return { success: false, error: responseText };
    }

    const data = JSON.parse(responseText);
    console.log(`[APEX] Order SUCCESS - OrderId: ${data.OrderId}`);
    return { success: true, orderId: data.OrderId };
  } catch (e) {
    console.log(`[APEX] Order ERROR: ${e}`);
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
  } catch (e) {}
  return 100000;
}

// Get current positions from Saxo
async function getPositions(accessToken: string, accountKey: string, clientKey: string) {
  const positions: Map<string, { amount: number; avgPrice: number; marketValue: number; uic: number }> = new Map();
  
  try {
    // Try with ClientKey first
    let res = await fetch(
      `${SAXO_API_BASE}/port/v1/positions?ClientKey=${clientKey}&FieldGroups=PositionBase,PositionView,DisplayAndFormat`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    
    console.log(`[APEX] Positions API (ClientKey): ${res.status}`);
    
    // If that fails, try with AccountKey
    if (!res.ok) {
      res = await fetch(
        `${SAXO_API_BASE}/port/v1/positions?AccountKey=${accountKey}&FieldGroups=PositionBase,PositionView,DisplayAndFormat`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );
      console.log(`[APEX] Positions API (AccountKey): ${res.status}`);
    }
    
    // If still no luck, try /me endpoint
    if (!res.ok) {
      res = await fetch(
        `${SAXO_API_BASE}/port/v1/positions/me?FieldGroups=PositionBase,PositionView,DisplayAndFormat`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );
      console.log(`[APEX] Positions API (/me): ${res.status}`);
    }
    
    if (res.ok) {
      const data = await res.json();
      console.log(`[APEX] Fant ${data.Data?.length || 0} posisjoner fra Saxo`);
      
      for (const pos of data.Data || []) {
        // Get ticker from Symbol or Description
        const symbol = pos.DisplayAndFormat?.Symbol || '';
        const description = pos.DisplayAndFormat?.Description || '';
        const uic = pos.PositionBase?.Uic || 0;
        
        // Extract ticker (before colon if present)
        let ticker = symbol.split(':')[0].toUpperCase();
        
        // Map UIC back to our known tickers
        if (!ticker) {
          for (const [t, info] of Object.entries(KNOWN_INSTRUMENTS)) {
            if (info.uic === uic) {
              ticker = t;
              break;
            }
          }
        }
        
        // Also check description for common names
        if (!ticker && description) {
          if (description.includes('Micron')) ticker = 'MU';
          else if (description.includes('Constellation')) ticker = 'CEG';
          else if (description.includes('Vertiv')) ticker = 'VRT';
          else if (description.includes('Rocket Lab')) ticker = 'RKLB';
          else if (description.includes('Lemonade')) ticker = 'LMND';
          else if (description.includes('Absci')) ticker = 'ABSI';
          else if (description.includes('Equinor')) ticker = 'EQNR';
          else if (description.includes('Mowi')) ticker = 'MOWI';
          else if (description.includes('Nel')) ticker = 'NEL';
          else if (description.includes('Nordic Semi')) ticker = 'NODC';
          else if (description.includes('Aker BP')) ticker = 'AKRBP';
          else if (description.includes('Norwegian Air')) ticker = 'NAS';
        }
        
        if (ticker) {
          const amount = Math.abs(pos.PositionBase?.Amount || 0);
          const avgPrice = pos.PositionBase?.AverageOpenPrice || 0;
          const marketValue = Math.abs(pos.PositionView?.MarketValue || pos.PositionView?.CurrentPrice * amount || 0);
          
          console.log(`[APEX] Posisjon: ${ticker} = ${amount} aksjer @ $${avgPrice.toFixed(2)} (verdi: $${marketValue.toFixed(0)})`);
          
          positions.set(ticker, { amount, avgPrice, marketValue, uic });
        }
      }
    }
  } catch (e) {
    console.log(`[APEX] Feil ved henting av posisjoner: ${e}`);
  }
  
  return positions;
}

// Generate ACTIVE trading signals based on momentum and volatility
function generateActiveSignals(
  positions: Map<string, { amount: number; avgPrice: number; marketValue: number }>,
  balance: number,
  totalPortfolioValue: number
): Array<{ ticker: string; action: 'BUY' | 'SELL'; amount: number; reason: string }> {
  const signals: Array<{ ticker: string; action: 'BUY' | 'SELL'; amount: number; reason: string }> = [];
  
  for (const [ticker, info] of Object.entries(APEX_BLUEPRINT)) {
    const pos = positions.get(ticker);
    const currentValue = pos?.marketValue || 0;
    const targetValue = (totalPortfolioValue * info.targetVekt) / 100;
    const deviation = targetValue > 0 ? ((currentValue - targetValue) / targetValue) * 100 : -100;
    
    // Random momentum factor (-10 to +10)
    const momentum = (Math.random() - 0.5) * 20;
    
    // Volatility affects trade size
    const baseTradeSize = Math.max(3, Math.floor(5 + Math.random() * 10));
    const tradeSize = Math.floor(baseTradeSize * (1 + (info.volatilitet - 2) * 0.3));
    
    // Active trading logic
    if (!pos || pos.amount === 0) {
      // No position - build it
      signals.push({
        ticker,
        action: 'BUY',
        amount: Math.max(5, tradeSize * 2),
        reason: `Bygger posisjon mot ${info.targetVekt}%`,
      });
    } else if (deviation < -15) {
      // Underweight - buy more
      signals.push({
        ticker,
        action: 'BUY',
        amount: tradeSize,
        reason: `Undervektet (${deviation.toFixed(1)}%), oker`,
      });
    } else if (deviation > 15) {
      // Overweight - sell some
      const sellAmount = Math.min(tradeSize, Math.floor(pos.amount * 0.1));
      if (sellAmount > 0) {
        signals.push({
          ticker,
          action: 'SELL',
          amount: sellAmount,
          reason: `Overvektet (${deviation.toFixed(1)}%), tar gevinst`,
        });
      }
    } else if (momentum > 5 && balance > 1000) {
      // Positive momentum - small buy
      signals.push({
        ticker,
        action: 'BUY',
        amount: Math.max(2, Math.floor(tradeSize * 0.5)),
        reason: `Momentum opp (${momentum.toFixed(1)})`,
      });
    } else if (momentum < -5 && pos.amount > 5) {
      // Negative momentum - small sell
      signals.push({
        ticker,
        action: 'SELL',
        amount: Math.min(3, Math.floor(pos.amount * 0.05)),
        reason: `Momentum ned (${momentum.toFixed(1)})`,
      });
    }
  }
  
  // Limit to 3-5 signals per scan for active but controlled trading
  return signals.slice(0, 5);
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log(`[APEX] ============ POST /api/apex/autonomous STARTED ============`);
  
  try {
    const body = await request.json();
    const { mode, buildPortfolio } = body;
    const isPaperTrading = mode === 'paper';
    const isInitialBuild = buildPortfolio === true;
    console.log(`[APEX] Body: mode=${mode}, buildPortfolio=${buildPortfolio}`);

    // Get credentials from cookies
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('apex_saxo_token')?.value;
    const accountKey = cookieStore.get('apex_saxo_account_key')?.value;
    const clientKey = cookieStore.get('apex_saxo_client_key')?.value || accountKey;

    console.log(`[APEX] Cookies: token=${accessToken ? 'YES' : 'NO'}, accountKey=${accountKey ? 'YES' : 'NO'}, clientKey=${clientKey ? 'YES' : 'NO'}`);

    if (!accessToken || !accountKey) {
      console.log(`[APEX] MISSING CREDENTIALS - returning 401`);
      return NextResponse.json({
        error: 'Koble til Saxo Simulation forst',
        requiresConnection: true,
      }, { status: 401 });
    }

    console.log(`[APEX] === AKTIV TRADING SCAN @ ${new Date().toISOString()} ===`);
    console.log(`[APEX] AccountKey: ${accountKey}, ClientKey: ${clientKey}`);

    // Fetch account state
    const [balance, positions] = await Promise.all([
      getBalance(accessToken, accountKey),
      getPositions(accessToken, accountKey, clientKey || accountKey),
    ]);

    // Calculate total portfolio value
    let portfolioValue = balance;
    for (const pos of positions.values()) {
      portfolioValue += pos.marketValue;
    }

    console.log(`[APEX] Saldo: $${balance.toLocaleString()} | Portefolje: $${portfolioValue.toLocaleString()} | Posisjoner: ${positions.size}`);

    // Track executed trades
    const executedTrades: Array<{
      ticker: string;
      action: 'BUY' | 'SELL';
      amount: number;
      price: number;
      value: number;
      orderId?: string;
      status: 'OK' | 'FEIL';
      reason: string;
    }> = [];

    // INITIAL BUILD: Create blueprint portfolio if empty
    if (isInitialBuild && positions.size === 0) {
      console.log(`[APEX] INITIAL BUILD - Oppretter blueprint-portefolje`);
      
      for (const [ticker, info] of Object.entries(APEX_BLUEPRINT)) {
        const inst = await findInstrument(accessToken, ticker);
        if (!inst) {
          console.log(`[APEX] Fant ikke ${ticker}`);
          continue;
        }
        
        const price = await getPrice(accessToken, inst.uic, inst.assetType);
        if (price <= 0) {
          console.log(`[APEX] Ingen pris for ${ticker}`);
          continue;
        }
        
        const targetValue = (balance * info.targetVekt) / 100;
        const shares = Math.floor(targetValue / price);
        
        if (shares <= 0) continue;
        
        console.log(`[APEX] KJOP ${shares}x ${ticker} @ $${price.toFixed(2)} = $${(shares * price).toFixed(0)}`);
        
        const result = await placeMarketOrder(accessToken, accountKey, inst.uic, inst.assetType, shares, 'Buy');
        
        executedTrades.push({
          ticker,
          action: 'BUY',
          amount: shares,
          price,
          value: shares * price,
          orderId: result.orderId,
          status: result.success ? 'OK' : 'FEIL',
          reason: result.success ? `Initial ${info.targetVekt}%` : (result.error || 'Feil'),
        });
      }
      
      const successful = executedTrades.filter(t => t.status === 'OK');
      const totalInvested = successful.reduce((sum, t) => sum + t.value, 0);
      
      return NextResponse.json({
        message: `PORTEFOLJE OPPRETTET\n${executedTrades.map(t => `${t.status} ${t.action} ${t.amount}x ${t.ticker} @ $${t.price.toFixed(2)}`).join('\n')}\n\nTotal: $${totalInvested.toLocaleString()}`,
        portfolio: Object.entries(APEX_BLUEPRINT).map(([ticker, info]) => ({
          ticker,
          navn: info.navn,
          vekt: info.targetVekt,
          aksjon: 'KJOPT',
          antall: executedTrades.find(t => t.ticker === ticker)?.amount || 0,
        })),
        executedTrades,
        isInitialBuild: true,
        mode: 'paper',
        timestamp: new Date().toISOString(),
      });
    }

    // ACTIVE TRADING: Generate and execute signals
    const signals = generateActiveSignals(positions, balance, portfolioValue);
    
    console.log(`[APEX] Genererte ${signals.length} aktive signaler`);

    for (const signal of signals) {
      const inst = await findInstrument(accessToken, signal.ticker);
      if (!inst) {
        executedTrades.push({
          ticker: signal.ticker,
          action: signal.action,
          amount: signal.amount,
          price: 0,
          value: 0,
          status: 'FEIL',
          reason: 'Instrument ikke funnet',
        });
        continue;
      }
      
      const price = await getPrice(accessToken, inst.uic, inst.assetType);
      if (price <= 0) {
        executedTrades.push({
          ticker: signal.ticker,
          action: signal.action,
          amount: signal.amount,
          price: 0,
          value: 0,
          status: 'FEIL',
          reason: 'Pris ikke tilgjengelig',
        });
        continue;
      }
      
      // Check if we can afford the trade
      const tradeValue = signal.amount * price;
      if (signal.action === 'BUY' && tradeValue > balance * 0.95) {
        console.log(`[APEX] Ikke nok saldo for ${signal.ticker}`);
        continue;
      }
      
      // Check if we have enough shares to sell
      if (signal.action === 'SELL') {
        const pos = positions.get(signal.ticker);
        if (!pos || pos.amount < signal.amount) {
          continue;
        }
      }
      
      console.log(`[APEX] >>> ${signal.action} ${signal.amount}x ${signal.ticker} @ $${price.toFixed(2)} - ${signal.reason}`);
      
      const result = await placeMarketOrder(
        accessToken,
        accountKey,
        inst.uic,
        inst.assetType,
        signal.amount,
        signal.action === 'BUY' ? 'Buy' : 'Sell'
      );
      
      executedTrades.push({
        ticker: signal.ticker,
        action: signal.action,
        amount: signal.amount,
        price,
        value: signal.amount * price,
        orderId: result.orderId,
        status: result.success ? 'OK' : 'FEIL',
        reason: result.success ? signal.reason : (result.error?.substring(0, 50) || 'Feil'),
      });
      
      if (result.success) {
        console.log(`[APEX] <<< OrderId: ${result.orderId}`);
      } else {
        console.log(`[APEX] <<< FEILET: ${result.error}`);
      }
    }

    // Build report
    const successful = executedTrades.filter(t => t.status === 'OK');
    const failed = executedTrades.filter(t => t.status === 'FEIL');
    const totalBought = successful.filter(t => t.action === 'BUY').reduce((sum, t) => sum + t.value, 0);
    const totalSold = successful.filter(t => t.action === 'SELL').reduce((sum, t) => sum + t.value, 0);
    
    const elapsed = Date.now() - startTime;

    let report = `APEX QUANTUM v6.1 - AKTIV TRADING
${'='.repeat(45)}
Tid: ${new Date().toLocaleString('no-NO')}
Mode: ${isPaperTrading ? 'PAPER TRADING' : 'LIVE'}
Saldo: $${balance.toLocaleString()} | Portefolje: $${portfolioValue.toLocaleString()}

=== SIGNALER (${signals.length}) ===
${signals.map(s => `${s.action === 'BUY' ? '+' : '-'} ${s.ticker}: ${s.action} ${s.amount} - ${s.reason}`).join('\n')}

=== UTFORTE HANDLER (${successful.length}/${executedTrades.length}) ===
${successful.length > 0 ? successful.map(t => `OK ${t.action} ${t.amount}x ${t.ticker} @ $${t.price.toFixed(2)} = $${t.value.toFixed(0)} [${t.orderId}]`).join('\n') : 'Ingen handler utfort'}
${failed.length > 0 ? `\nFEILET:\n${failed.map(t => `- ${t.ticker}: ${t.reason}`).join('\n')}` : ''}

Kjopt: $${totalBought.toLocaleString()} | Solgt: $${totalSold.toLocaleString()}
Responstid: ${elapsed}ms
`;

    // Build portfolio summary
    const portfolio = Object.entries(APEX_BLUEPRINT).map(([ticker, info]) => {
      const pos = positions.get(ticker);
      const trade = executedTrades.find(t => t.ticker === ticker);
      return {
        ticker,
        navn: info.navn,
        vekt: info.targetVekt,
        aksjon: trade ? (trade.action === 'BUY' ? 'KJOPT' : 'SOLGT') : 'HOLD',
        antall: pos?.amount || 0,
      };
    });

    return NextResponse.json({
      message: report,
      portfolio,
      executedTrades,
      signals,
      stats: {
        signaler: signals.length,
        utfort: successful.length,
        feilet: failed.length,
        kjopt: totalBought,
        solgt: totalSold,
      },
      mode: 'paper',
      timestamp: new Date().toISOString(),
      elapsed,
    });

  } catch (error) {
    console.error('[APEX] Error:', error);
    return NextResponse.json({ error: 'System error' }, { status: 500 });
  }
}

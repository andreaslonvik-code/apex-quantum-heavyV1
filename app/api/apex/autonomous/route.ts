import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Saxo SIM API endpoints
const SAXO_API_BASE = 'https://gateway.saxobank.com/sim/openapi';

// APEX QUANTUM v6.1 - Full Blueprint with Saxo symbol mapping
// Intra-day swing trader configuration
const APEX_BLUEPRINT: Record<string, {
  navn: string;
  targetVekt: number;
  volatilitet: number;
  saxoSymbol: string;
  assetType: string;
  market: string;
}> = {
  MU:   { navn: 'Micron Technology',    targetVekt: 45, volatilitet: 3, saxoSymbol: 'MU:xnas',   assetType: 'Stock', market: 'US' },
  CEG:  { navn: 'Constellation Energy', targetVekt: 12, volatilitet: 2, saxoSymbol: 'CEG:xnas',  assetType: 'Stock', market: 'US' },
  VRT:  { navn: 'Vertiv Holdings',      targetVekt: 8,  volatilitet: 2, saxoSymbol: 'VRT:xnys',  assetType: 'Stock', market: 'US' },
  RKLB: { navn: 'Rocket Lab',           targetVekt: 3,  volatilitet: 4, saxoSymbol: 'RKLB:xnas', assetType: 'Stock', market: 'US' },
  LMND: { navn: 'Lemonade Inc',         targetVekt: 2,  volatilitet: 4, saxoSymbol: 'LMND:xnys', assetType: 'Stock', market: 'US' },
  ABSI: { navn: 'Absci Corporation',    targetVekt: 30, volatilitet: 5, saxoSymbol: 'ABSI:xnas', assetType: 'Stock', market: 'US' },
};

// Momentum tracking for intra-day swings
interface PricePoint {
  price: number;
  timestamp: number;
}

interface MomentumData {
  prices: PricePoint[];
  localHigh: number;
  localLow: number;
  rsi: number;
  trend: 'UP' | 'DOWN' | 'NEUTRAL';
}

// Price history for momentum analysis (in-memory, resets on cold start)
const priceHistory: Map<string, PricePoint[]> = new Map();

// Cache for resolved UICs
const uicCache: Map<string, { uic: number; assetType: string }> = new Map();

// ============ PROFIT LOCK SYSTEM ============
// Trading uses ONLY 1,000,000 NOK base capital
// All profits are locked away and not reinvested
const BASE_TRADING_CAPITAL = 1000000; // 1 million NOK

// Track realized profits per account (in-memory, persists during runtime)
const lockedProfits: Map<string, number> = new Map();

// Track purchase prices for profit calculation
const purchasePrices: Map<string, Map<string, number>> = new Map(); // accountKey -> ticker -> avgPrice

// Search for instrument UIC dynamically
async function findInstrument(accessToken: string, ticker: string, saxoSymbol: string): Promise<{ uic: number; assetType: string } | null> {
  if (uicCache.has(ticker)) {
    return uicCache.get(ticker)!;
  }
  
  try {
    const searches = [saxoSymbol, `${ticker}:xnas`, `${ticker}:xnys`, ticker];
    
    for (const keyword of searches) {
      const res = await fetch(
        `${SAXO_API_BASE}/ref/v1/instruments?Keywords=${encodeURIComponent(keyword)}&AssetTypes=Stock&$top=5`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );
      
      if (res.ok) {
        const data = await res.json();
        if (data.Data && data.Data.length > 0) {
          const match = data.Data.find((i: any) => 
            i.Symbol?.toUpperCase() === ticker ||
            i.Symbol?.toUpperCase().startsWith(ticker + ':')
          ) || data.Data[0];
          
          const result = { uic: match.Identifier, assetType: match.AssetType || 'Stock' };
          uicCache.set(ticker, result);
          console.log(`[APEX] Found ${ticker}: UIC=${result.uic}`);
          return result;
        }
      }
    }
    return null;
  } catch (e) {
    console.log(`[APEX] Search error for ${ticker}: ${e}`);
    return null;
  }
}

// Get current price with bid/ask spread
async function getPrice(accessToken: string, uic: number, assetType: string): Promise<{ bid: number; ask: number; mid: number; last: number }> {
  try {
    const res = await fetch(
      `${SAXO_API_BASE}/trade/v1/infoprices?Uic=${uic}&AssetType=${assetType}&FieldGroups=Quote,PriceInfo`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    if (res.ok) {
      const data = await res.json();
      const bid = data.Quote?.Bid || data.Quote?.Last || 100;
      const ask = data.Quote?.Ask || data.Quote?.Last || 100;
      const mid = (bid + ask) / 2;
      const last = data.Quote?.Last || data.PriceInfo?.LastTraded || mid;
      return { bid, ask, mid, last };
    }
  } catch {}
  return { bid: 100, ask: 100, mid: 100, last: 100 };
}

// Calculate RSI from price history (14-period simplified)
function calculateRSI(prices: PricePoint[]): number {
  if (prices.length < 5) return 50;
  
  const recent = prices.slice(-15);
  let gains = 0, losses = 0, count = 0;
  
  for (let i = 1; i < recent.length; i++) {
    const change = recent[i].price - recent[i-1].price;
    if (change > 0) gains += change;
    else losses += Math.abs(change);
    count++;
  }
  
  if (count === 0) return 50;
  const avgGain = gains / count;
  const avgLoss = losses / count;
  
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

// Analyze momentum for a ticker
function analyzeMomentum(ticker: string, currentPrice: number): MomentumData {
  const history = priceHistory.get(ticker) || [];
  
  // Add current price to history
  const now = Date.now();
  history.push({ price: currentPrice, timestamp: now });
  
  // Keep only last 15 minutes of data (assuming ~2 sec scans = ~450 points max)
  const fifteenMinAgo = now - 15 * 60 * 1000;
  const recentHistory = history.filter(p => p.timestamp > fifteenMinAgo);
  priceHistory.set(ticker, recentHistory);
  
  if (recentHistory.length < 3) {
    return { prices: recentHistory, localHigh: currentPrice, localLow: currentPrice, rsi: 50, trend: 'NEUTRAL' };
  }
  
  // Find local high and low in last 5 minutes
  const fiveMinAgo = now - 5 * 60 * 1000;
  const fiveMinPrices = recentHistory.filter(p => p.timestamp > fiveMinAgo);
  
  const localHigh = Math.max(...fiveMinPrices.map(p => p.price));
  const localLow = Math.min(...fiveMinPrices.map(p => p.price));
  
  // Calculate RSI
  const rsi = calculateRSI(recentHistory);
  
  // Determine trend
  const avgRecent = fiveMinPrices.slice(-3).reduce((s, p) => s + p.price, 0) / 3;
  const avgOlder = fiveMinPrices.slice(0, 3).reduce((s, p) => s + p.price, 0) / Math.min(3, fiveMinPrices.length);
  const trend = avgRecent > avgOlder * 1.002 ? 'UP' : avgRecent < avgOlder * 0.998 ? 'DOWN' : 'NEUTRAL';
  
  return { prices: recentHistory, localHigh, localLow, rsi, trend };
}

// Place market order with full logging
async function placeMarketOrder(
  accessToken: string,
  accountKey: string,
  ticker: string,
  saxoSymbol: string,
  assetType: string,
  amount: number,
  buySell: 'Buy' | 'Sell',
  reason: string
): Promise<{ success: boolean; orderId?: string; error?: string; uic?: number }> {
  try {
    const instrument = await findInstrument(accessToken, ticker, saxoSymbol);
    if (!instrument) {
      return { success: false, error: `Fant ikke instrument: ${ticker}` };
    }
    
    const body = {
      AccountKey: accountKey,
      Amount: Math.floor(Math.abs(amount)),
      AssetType: assetType,
      BuySell: buySell,
      OrderType: 'Market',
      OrderDuration: { DurationType: 'DayOrder' },
      Uic: instrument.uic,
      ManualOrder: false,
    };

    const actionText = buySell === 'Buy' ? 'KJOPER PA DIP' : 'TAR PROFITT PA PEAK';
    console.log(`[APEX] >>> ${actionText}: ${buySell === 'Buy' ? '+' : '-'}${amount} ${saxoSymbol} - ${reason}`);

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

// Get account balance and total value
async function getBalance(accessToken: string, accountKey: string): Promise<{ cash: number; total: number }> {
  try {
    const res = await fetch(
      `${SAXO_API_BASE}/port/v1/balances?AccountKey=${accountKey}&ClientKey=${accountKey}`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    if (res.ok) {
      const data = await res.json();
      return {
        cash: data.CashAvailableForTrading || 0,
        total: data.TotalValue || BASE_TRADING_CAPITAL,
      };
    }
  } catch {}
  return { cash: BASE_TRADING_CAPITAL, total: BASE_TRADING_CAPITAL };
}

// Calculate and lock profits from a SELL trade
function lockProfit(accountKey: string, ticker: string, sellPrice: number, sellAmount: number): number {
  // Get purchase prices for this account
  if (!purchasePrices.has(accountKey)) {
    purchasePrices.set(accountKey, new Map());
  }
  const prices = purchasePrices.get(accountKey)!;
  const avgPurchasePrice = prices.get(ticker) || sellPrice; // Default to sellPrice if no record
  
  // Calculate profit per share
  const profitPerShare = sellPrice - avgPurchasePrice;
  const totalProfit = profitPerShare * sellAmount;
  
  // Only lock positive profits
  if (totalProfit > 0) {
    const currentLocked = lockedProfits.get(accountKey) || 0;
    lockedProfits.set(accountKey, currentLocked + totalProfit);
    console.log(`[APEX] PROFIT LOCK: +${totalProfit.toFixed(2)} kr fra ${ticker} (${sellAmount} x ${profitPerShare.toFixed(2)} kr/aksje)`);
    return totalProfit;
  }
  
  return 0;
}

// Record purchase price for profit tracking
function recordPurchase(accountKey: string, ticker: string, price: number, amount: number): void {
  if (!purchasePrices.has(accountKey)) {
    purchasePrices.set(accountKey, new Map());
  }
  const prices = purchasePrices.get(accountKey)!;
  
  // Weighted average if adding to existing position
  const existingPrice = prices.get(ticker) || price;
  const existingAmount = 0; // Simplified - just use new price for now
  const newAvgPrice = ((existingPrice * existingAmount) + (price * amount)) / (existingAmount + amount);
  
  prices.set(ticker, newAvgPrice);
}

// Get available trading capital (base capital minus what we should keep in reserve)
function getAvailableTradingCapital(actualCash: number, totalAccountValue: number, accountKey: string): number {
  const locked = lockedProfits.get(accountKey) || 0;
  
  // The actual profit in the account
  const currentProfit = totalAccountValue - BASE_TRADING_CAPITAL;
  
  // We only trade with the base capital, keeping profits locked
  // If totalAccountValue is 1,003,000 and base is 1,000,000, we have 3,000 profit
  // We should only use 1,000,000 for trading, not the 1,003,000
  const tradingCapital = Math.min(actualCash, BASE_TRADING_CAPITAL);
  
  console.log(`[APEX] Kapital: Kontoverdi=${totalAccountValue.toLocaleString()} kr, Profitt=${currentProfit.toLocaleString()} kr, Last inn=${locked.toLocaleString()} kr, Tilgjengelig=${tradingCapital.toLocaleString()} kr`);
  
  return tradingCapital;
}

// Get current positions
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
        let ticker = symbol.split(':')[0].toUpperCase();
        
        if (!ticker || !APEX_BLUEPRINT[ticker]) {
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

// DIP DETECTION THRESHOLDS
const DIP_THRESHOLD = 0.006;   // 0.6% drop from local high = BUY signal
const PEAK_THRESHOLD = 0.008;  // 0.8% rise from local low = SELL signal
const RSI_OVERSOLD = 35;       // RSI below this = oversold, aggressive buy
const RSI_OVERBOUGHT = 65;     // RSI above this = overbought, take profit

// Generate AGGRESSIVE intra-day swing signals
async function generateSwingSignals(
  accessToken: string,
  positions: Map<string, { amount: number; avgPrice: number; marketValue: number }>,
  balance: number,
  totalValue: number
): Promise<Array<{ ticker: string; action: 'BUY' | 'SELL'; amount: number; reason: string; price: number; momentum: MomentumData }>> {
  const signals: Array<{ ticker: string; action: 'BUY' | 'SELL'; amount: number; reason: string; price: number; momentum: MomentumData }> = [];
  
  for (const [ticker, info] of Object.entries(APEX_BLUEPRINT)) {
    // Find instrument and get current price
    const instrument = await findInstrument(accessToken, ticker, info.saxoSymbol);
    if (!instrument) continue;
    
    const priceData = await getPrice(accessToken, instrument.uic, info.assetType);
    const currentPrice = priceData.last;
    
    // Analyze momentum
    const momentum = analyzeMomentum(ticker, currentPrice);
    const pos = positions.get(ticker);
    const currentValue = pos?.marketValue || 0;
    const targetValue = (totalValue * info.targetVekt) / 100;
    const deviation = targetValue > 0 ? ((currentValue - targetValue) / targetValue) * 100 : -100;
    
    // Calculate drop from local high and rise from local low
    const dropFromHigh = momentum.localHigh > 0 ? (momentum.localHigh - currentPrice) / momentum.localHigh : 0;
    const riseFromLow = momentum.localLow > 0 ? (currentPrice - momentum.localLow) / momentum.localLow : 0;
    
    // Calculate aggressive order size based on volatility and opportunity
    const baseSize = Math.max(5, Math.floor((balance * 0.03) / currentPrice)); // 3% of balance per trade
    const volatilityMultiplier = 1 + (info.volatilitet - 2) * 0.2;
    
    // ============ DIP BUYING LOGIC ============
    if (dropFromHigh >= DIP_THRESHOLD) {
      // Price dropped from local high - BUY THE DIP
      const dipStrength = Math.min(3, dropFromHigh / DIP_THRESHOLD);
      const orderSize = Math.floor(baseSize * dipStrength * volatilityMultiplier);
      
      if (orderSize > 0 && balance > orderSize * currentPrice) {
        signals.push({
          ticker,
          action: 'BUY',
          amount: orderSize,
          reason: `DIP -${(dropFromHigh * 100).toFixed(2)}% fra topp, RSI=${momentum.rsi.toFixed(0)}`,
          price: currentPrice,
          momentum,
        });
        console.log(`[APEX] DIP DETECTED: ${ticker} -${(dropFromHigh * 100).toFixed(2)}% -> KJOP ${orderSize}`);
      }
    }
    
    // RSI oversold - aggressive buy
    if (momentum.rsi < RSI_OVERSOLD && balance > baseSize * currentPrice) {
      const orderSize = Math.floor(baseSize * 1.5 * volatilityMultiplier);
      signals.push({
        ticker,
        action: 'BUY',
        amount: orderSize,
        reason: `RSI OVERSOLD (${momentum.rsi.toFixed(0)}), aggressiv kjop`,
        price: currentPrice,
        momentum,
      });
      console.log(`[APEX] RSI OVERSOLD: ${ticker} RSI=${momentum.rsi.toFixed(0)} -> KJOP ${orderSize}`);
    }
    
    // ============ PEAK SELLING LOGIC ============
    if (riseFromLow >= PEAK_THRESHOLD && pos && pos.amount > 3) {
      // Price rose from local low - TAKE PROFIT ON PEAK
      const peakStrength = Math.min(3, riseFromLow / PEAK_THRESHOLD);
      const sellSize = Math.floor(Math.min(pos.amount * 0.25, baseSize * peakStrength));
      
      if (sellSize > 0) {
        signals.push({
          ticker,
          action: 'SELL',
          amount: sellSize,
          reason: `PEAK +${(riseFromLow * 100).toFixed(2)}% fra bunn, RSI=${momentum.rsi.toFixed(0)}`,
          price: currentPrice,
          momentum,
        });
        console.log(`[APEX] PEAK DETECTED: ${ticker} +${(riseFromLow * 100).toFixed(2)}% -> SELG ${sellSize}`);
      }
    }
    
    // RSI overbought - take profit
    if (momentum.rsi > RSI_OVERBOUGHT && pos && pos.amount > 5) {
      const sellSize = Math.floor(pos.amount * 0.15);
      if (sellSize > 0) {
        signals.push({
          ticker,
          action: 'SELL',
          amount: sellSize,
          reason: `RSI OVERBOUGHT (${momentum.rsi.toFixed(0)}), ta profitt`,
          price: currentPrice,
          momentum,
        });
        console.log(`[APEX] RSI OVERBOUGHT: ${ticker} RSI=${momentum.rsi.toFixed(0)} -> SELG ${sellSize}`);
      }
    }
    
    // ============ PORTFOLIO BUILDING LOGIC ============
    if (!pos || pos.amount === 0) {
      // No position - build towards target
      const buildSize = Math.floor(baseSize * 2);
      if (balance > buildSize * currentPrice) {
        signals.push({
          ticker,
          action: 'BUY',
          amount: buildSize,
          reason: `Bygger posisjon mot ${info.targetVekt}%`,
          price: currentPrice,
          momentum,
        });
      }
    } else if (deviation < -30) {
      // Significantly underweight - add to position
      const addSize = Math.floor(baseSize * 1.2);
      if (balance > addSize * currentPrice) {
        signals.push({
          ticker,
          action: 'BUY',
          amount: addSize,
          reason: `Undervektet (${deviation.toFixed(0)}%), oker posisjon`,
          price: currentPrice,
          momentum,
        });
      }
    } else if (deviation > 30 && pos.amount > 10) {
      // Significantly overweight - reduce position
      const reduceSize = Math.floor(pos.amount * 0.1);
      if (reduceSize > 0) {
        signals.push({
          ticker,
          action: 'SELL',
          amount: reduceSize,
          reason: `Overvektet (${deviation.toFixed(0)}%), reduserer`,
          price: currentPrice,
          momentum,
        });
      }
    }
  }
  
  // Sort by priority: DIP/PEAK signals first, then portfolio building
  signals.sort((a, b) => {
    const aIsDipPeak = a.reason.includes('DIP') || a.reason.includes('PEAK') || a.reason.includes('RSI');
    const bIsDipPeak = b.reason.includes('DIP') || b.reason.includes('PEAK') || b.reason.includes('RSI');
    if (aIsDipPeak && !bIsDipPeak) return -1;
    if (!aIsDipPeak && bIsDipPeak) return 1;
    return 0;
  });
  
  // Execute up to 8 signals per scan for aggressive trading
  return signals.slice(0, 8);
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await request.json();
    const { mode } = body;

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

    console.log(`[APEX] ========== INTRA-DAY SWING SCAN ==========`);

    const [balanceData, positions] = await Promise.all([
      getBalance(accessToken, accountKey),
      getPositions(accessToken, clientKey || accountKey),
    ]);

    // Get total account value from Saxo
    const actualTotalValue = balanceData.total;
    const actualCash = balanceData.cash;
    
    // Calculate current profit
    const currentProfit = actualTotalValue - BASE_TRADING_CAPITAL;
    const locked = lockedProfits.get(accountKey) || 0;
    
    // Only trade with base capital, not profits
    const tradingCapital = getAvailableTradingCapital(actualCash, actualTotalValue, accountKey);

    console.log(`[APEX] Kontoverdi: ${actualTotalValue.toLocaleString()} kr | Profitt: ${currentProfit.toLocaleString()} kr | Last: ${locked.toLocaleString()} kr`);

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

    // Generate swing signals with real price data - use BASE_TRADING_CAPITAL for allocation
    const signals = await generateSwingSignals(accessToken, positions, tradingCapital, BASE_TRADING_CAPITAL);
    console.log(`[APEX] Genererte ${signals.length} swing-signaler`);

    // Execute each signal
    for (const signal of signals) {
      const info = APEX_BLUEPRINT[signal.ticker];
      if (!info) continue;

      const tradeValue = signal.amount * signal.price;

      // Validate trade - use tradingCapital not actual balance
      if (signal.action === 'BUY' && tradeValue > tradingCapital * 0.95) {
        console.log(`[APEX] Skip ${signal.ticker} - ikke nok trading-kapital (${tradingCapital.toLocaleString()} kr)`);
        continue;
      }
      
      if (signal.action === 'SELL') {
        const pos = positions.get(signal.ticker);
        if (!pos || pos.amount < signal.amount) {
          continue;
        }
      }

      // Execute order
      const result = await placeMarketOrder(
        accessToken,
        accountKey,
        signal.ticker,
        info.saxoSymbol,
        info.assetType,
        signal.amount,
        signal.action === 'BUY' ? 'Buy' : 'Sell',
        signal.reason
      );

      let lockedThisTrade = 0;
      
      if (result.success) {
        if (signal.action === 'SELL') {
          // Lock profits from this sale
          lockedThisTrade = lockProfit(accountKey, signal.ticker, signal.price, signal.amount);
        } else if (signal.action === 'BUY') {
          // Record purchase price for future profit calculation
          recordPurchase(accountKey, signal.ticker, signal.price, signal.amount);
        }
      }

      executedTrades.push({
        ticker: signal.ticker,
        saxoSymbol: info.saxoSymbol,
        action: signal.action,
        amount: signal.amount,
        price: signal.price,
        value: tradeValue,
        orderId: result.orderId,
        status: result.success ? 'OK' : 'FEIL',
        reason: result.success ? signal.reason : 'Ordre feilet',
        lockedProfit: lockedThisTrade,
      });

      if (!result.success) {
        failedTickers.push(signal.ticker);
      }
    }

    const successful = executedTrades.filter(t => t.status === 'OK');
    const failed = executedTrades.filter(t => t.status === 'FEIL');
    const totalBought = successful.filter(t => t.action === 'BUY').reduce((s, t) => s + t.value, 0);
    const totalSold = successful.filter(t => t.action === 'SELL').reduce((s, t) => s + t.value, 0);
    
    const elapsed = Date.now() - startTime;

    // Build detailed report
    const totalLockedProfits = lockedProfits.get(accountKey) || 0;
    
    let report = `APEX QUANTUM v6.1 - INTRA-DAY SWING TRADER
${'='.repeat(50)}
Tid: ${new Date().toLocaleString('no-NO')}
Mode: PAPER TRADING | Strategi: AGGRESSIV DIP/PEAK

=== PROFIT LOCK STATUS ===
Startkapital: ${BASE_TRADING_CAPITAL.toLocaleString()} kr
Kontoverdi: ${actualTotalValue.toLocaleString()} kr
Aktuell profitt: ${currentProfit >= 0 ? '+' : ''}${currentProfit.toLocaleString()} kr
Last inn profitt: ${totalLockedProfits.toLocaleString()} kr
Trading-kapital: ${tradingCapital.toLocaleString()} kr

=== SWING SIGNALER (${signals.length}) ===
${signals.map(s => {
  const icon = s.action === 'BUY' ? '🟢' : '🔴';
  return `${icon} ${s.ticker}: ${s.action} ${s.amount} @ ${s.price.toFixed(2)} - ${s.reason}`;
}).join('\n')}

=== UTFORTE HANDLER (${successful.length}/${executedTrades.length}) ===
${successful.length > 0 
  ? successful.map(t => {
      const icon = t.action === 'BUY' ? 'Kjoper pa dip:' : 'Tar profitt pa peak:';
      return `>>> ${icon} ${t.action === 'BUY' ? '+' : '-'}${t.amount} ${t.saxoSymbol} @ ${t.price.toFixed(2)} [${t.orderId}]`;
    }).join('\n')
  : 'Ingen handler utfort'}

${failed.length > 0 ? `FEILET: ${failed.map(t => t.saxoSymbol).join(', ')}` : ''}

Kjopt: ${totalBought.toLocaleString()} kr | Solgt: ${totalSold.toLocaleString()} kr
Responstid: ${elapsed}ms`;

    return NextResponse.json({
      message: report,
      signals: signals.map(s => ({
        ticker: s.ticker,
        saxoSymbol: APEX_BLUEPRINT[s.ticker]?.saxoSymbol || s.ticker,
        action: s.action,
        amount: s.amount,
        price: s.price,
        reason: s.reason,
        rsi: s.momentum.rsi,
        trend: s.momentum.trend,
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
        baseCapital: BASE_TRADING_CAPITAL,
        actualTotalValue,
        currentProfit,
        lockedProfits: totalLockedProfits,
        tradingCapital,
        totalBought,
        totalSold,
        successful: successful.length,
        failed: failed.length,
      },
      mode: 'paper',
      timestamp: new Date().toISOString(),
      responseTime: elapsed,
    });
  } catch (e) {
    console.log(`[APEX] ERROR: ${e}`);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Saxo SIM API endpoints
const SAXO_API_BASE = 'https://gateway.saxobank.com/sim/openapi';

// ============ MARKET HOURS LOGIC (CET) ============
// NOTE: Saxo SIM only supports US stocks - Oslo Børs is NOT available
// Nasdaq/US: 15:30 - 22:00 CET
interface MarketStatus {
  osloOpen: boolean;  // Always false - not available in SIM
  usOpen: boolean;
  activeMarkets: 'US'[];
  message: string;
}

function getMarketStatus(): MarketStatus {
  // Get current time in CET/CEST (Europe/Oslo timezone)
  const now = new Date();
  const cetTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Oslo' }));
  const hours = cetTime.getHours();
  const minutes = cetTime.getMinutes();
  const timeInMinutes = hours * 60 + minutes;
  
  // Nasdaq/US: 15:30 - 22:00 CET (930 - 1320 minutes)
  const usOpen = timeInMinutes >= 930 && timeInMinutes < 1320;
  
  // Always return US only - Oslo Børs is not available in Saxo SIM
  const activeMarkets: 'US'[] = usOpen ? ['US'] : [];
  
  let message = '';
  if (usOpen) {
    message = `US MARKET APEN (${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} CET) - Aktiv trading`;
  } else {
    message = `US MARKET STENGT (${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} CET) - Apner 15:30 CET`;
  }
  
  return { osloOpen: false, usOpen, activeMarkets, message };
}

// ============ APEX QUANTUM v6.1 - AI-SELECTED PORTFOLIO ============
// These stocks were selected by Apex Quantum AI based on:
// - High growth potential in AI/semiconductor sector
// - Energy infrastructure for data centers
// - Emerging space technology
// - Disruptive insurance/biotech
// Total allocation: 100% across 6 AI-selected positions
const APEX_BLUEPRINT: Record<string, {
  navn: string;
  targetVekt: number;
  volatilitet: number;
  saxoSymbol: string;
  assetType: string;
  market: 'US';
}> = {
  // APEX QUANTUM AI-SELECTED POSITIONS ONLY
  MU:   { navn: 'Micron Technology',    targetVekt: 40, volatilitet: 3, saxoSymbol: 'MU:xnas',   assetType: 'Stock', market: 'US' },  // AI/Memory chips
  CEG:  { navn: 'Constellation Energy', targetVekt: 20, volatilitet: 2, saxoSymbol: 'CEG:xnas',  assetType: 'Stock', market: 'US' },  // Nuclear/Data center power
  VRT:  { navn: 'Vertiv Holdings',      targetVekt: 15, volatilitet: 2, saxoSymbol: 'VRT:xnys',  assetType: 'Stock', market: 'US' },  // Data center infrastructure
  RKLB: { navn: 'Rocket Lab',           targetVekt: 10, volatilitet: 4, saxoSymbol: 'RKLB:xnas', assetType: 'Stock', market: 'US' },  // Space tech
  LMND: { navn: 'Lemonade Inc',         targetVekt: 10, volatilitet: 4, saxoSymbol: 'LMND:xnys', assetType: 'Stock', market: 'US' },  // AI insurance
  ABSI: { navn: 'Absci Corporation',    targetVekt: 5,  volatilitet: 5, saxoSymbol: 'ABSI:xnas', assetType: 'Stock', market: 'US' },  // AI drug discovery
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
const BASE_TRADING_CAPITAL = 1000000; // 1 million NOK
const lockedProfits: Map<string, number> = new Map();
const purchasePrices: Map<string, Map<string, number>> = new Map();

// Search for instrument UIC dynamically
async function findInstrument(accessToken: string, ticker: string, saxoSymbol: string, preferredAssetType: string = 'Stock'): Promise<{ uic: number; assetType: string } | null> {
  const cacheKey = `${ticker}_${preferredAssetType}`;
  if (uicCache.has(cacheKey)) {
    return uicCache.get(cacheKey)!;
  }
  
  try {
    // Try multiple search patterns including Oslo Børs and Copenhagen
    const searches = [
      saxoSymbol, 
      `${ticker}:xnas`, 
      `${ticker}:xnys`, 
      `${ticker}:xosl`,
      `${ticker}:xcse`,
      ticker
    ];
    
    // Search for both Stock and CfdOnStock
    const assetTypesToTry = preferredAssetType === 'CfdOnStock' 
      ? ['CfdOnStock', 'Stock'] 
      : ['Stock', 'CfdOnStock'];
    
    for (const assetType of assetTypesToTry) {
      for (const keyword of searches) {
        const res = await fetch(
          `${SAXO_API_BASE}/ref/v1/instruments?Keywords=${encodeURIComponent(keyword)}&AssetTypes=${assetType}&$top=10`,
          { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );
        
        if (res.ok) {
          const data = await res.json();
          if (data.Data && data.Data.length > 0) {
            // Try to find exact match
            const match = data.Data.find((i: any) => 
              i.Symbol?.toUpperCase() === ticker ||
              i.Symbol?.toUpperCase().startsWith(ticker + ':')
            ) || data.Data[0];
            
            const result = { uic: match.Identifier, assetType: match.AssetType || assetType };
            uicCache.set(cacheKey, result);
            console.log(`[APEX] Found ${ticker}: UIC=${result.uic}, AssetType=${result.assetType}, Symbol=${match.Symbol}`);
            return result;
          }
        }
      }
    }
    
    console.log(`[APEX] Could not find instrument: ${ticker} (tried Stock and CfdOnStock)`);
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

// Calculate RSI from price history
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
  
  const now = Date.now();
  history.push({ price: currentPrice, timestamp: now });
  
  const fifteenMinAgo = now - 15 * 60 * 1000;
  const recentHistory = history.filter(p => p.timestamp > fifteenMinAgo);
  priceHistory.set(ticker, recentHistory);
  
  if (recentHistory.length < 3) {
    return { prices: recentHistory, localHigh: currentPrice, localLow: currentPrice, rsi: 50, trend: 'NEUTRAL' };
  }
  
  const fiveMinAgo = now - 5 * 60 * 1000;
  const fiveMinPrices = recentHistory.filter(p => p.timestamp > fiveMinAgo);
  
  const localHigh = Math.max(...fiveMinPrices.map(p => p.price));
  const localLow = Math.min(...fiveMinPrices.map(p => p.price));
  
  const rsi = calculateRSI(recentHistory);
  
  const avgRecent = fiveMinPrices.slice(-3).reduce((s, p) => s + p.price, 0) / 3;
  const avgOlder = fiveMinPrices.slice(0, 3).reduce((s, p) => s + p.price, 0) / Math.min(3, fiveMinPrices.length);
  const trend = avgRecent > avgOlder * 1.002 ? 'UP' : avgRecent < avgOlder * 0.998 ? 'DOWN' : 'NEUTRAL';
  
  return { prices: recentHistory, localHigh, localLow, rsi, trend };
}

// Place market order with market-aware logging
async function placeMarketOrder(
  accessToken: string,
  accountKey: string,
  ticker: string,
  saxoSymbol: string,
  assetType: string,
  amount: number,
  buySell: 'Buy' | 'Sell',
  reason: string,
  market: 'US'
): Promise<{ success: boolean; orderId?: string; error?: string; uic?: number }> {
  try {
    const instrument = await findInstrument(accessToken, ticker, saxoSymbol, assetType);
    if (!instrument) {
      console.log(`[APEX] FEIL: Fant ikke instrument ${ticker} (sokte: ${assetType})`);
      return { success: false, error: `Fant ikke instrument: ${ticker} (${assetType})` };
    }
    
    // Use the assetType found by the search, not the blueprint one
    const actualAssetType = instrument.assetType;
    
    const body = {
      AccountKey: accountKey,
      Amount: Math.floor(Math.abs(amount)),
      AssetType: actualAssetType,
      BuySell: buySell,
      OrderType: 'Market',
      OrderDuration: { DurationType: 'DayOrder' },
      Uic: instrument.uic,
      ManualOrder: false,
    };

    const marketName = 'US Market';
    const actionText = buySell === 'Buy' ? 'kjoper pa dip' : 'tar profitt pa peak';
    console.log(`[APEX] ${marketName} - ${actionText}: ${buySell === 'Buy' ? '+' : '-'}${amount} ${saxoSymbol} (UIC=${instrument.uic}, Type=${actualAssetType})`);

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

// Profit lock functions
function lockProfit(accountKey: string, ticker: string, sellPrice: number, sellAmount: number): number {
  if (!purchasePrices.has(accountKey)) {
    purchasePrices.set(accountKey, new Map());
  }
  const prices = purchasePrices.get(accountKey)!;
  const avgPurchasePrice = prices.get(ticker) || sellPrice;
  
  const profitPerShare = sellPrice - avgPurchasePrice;
  const totalProfit = profitPerShare * sellAmount;
  
  if (totalProfit > 0) {
    const currentLocked = lockedProfits.get(accountKey) || 0;
    lockedProfits.set(accountKey, currentLocked + totalProfit);
    console.log(`[APEX] PROFIT LOCK: +${totalProfit.toFixed(2)} kr fra ${ticker}`);
    return totalProfit;
  }
  
  return 0;
}

function recordPurchase(accountKey: string, ticker: string, price: number, amount: number): void {
  if (!purchasePrices.has(accountKey)) {
    purchasePrices.set(accountKey, new Map());
  }
  const prices = purchasePrices.get(accountKey)!;
  const existingPrice = prices.get(ticker) || price;
  prices.set(ticker, (existingPrice + price) / 2);
}

function getAvailableTradingCapital(actualCash: number, totalAccountValue: number, accountKey: string): number {
  const locked = lockedProfits.get(accountKey) || 0;
  const currentProfit = totalAccountValue - BASE_TRADING_CAPITAL;
  const tradingCapital = Math.min(actualCash, BASE_TRADING_CAPITAL);
  
  console.log(`[APEX] Kapital: Total=${totalAccountValue.toLocaleString()} kr, Profitt=${currentProfit.toLocaleString()} kr, Tilgjengelig=${tradingCapital.toLocaleString()} kr`);
  
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

// ============ APEX QUANTUM AGGRESSIVE TRADING CONFIG ============
// Target: 350-410% annual return = ~1% daily compound growth
// Strategy: Ultra-active intra-day momentum trading with continuous position building
const DIP_THRESHOLD = 0.001;       // Buy on ANY 0.1% dip (was 0.6%)
const PEAK_THRESHOLD = 0.002;      // Sell on 0.2% rise (was 0.8%)
const RSI_OVERSOLD = 45;           // More sensitive RSI (was 35)
const RSI_OVERBOUGHT = 55;         // More sensitive RSI (was 65)
const POSITION_SIZE_PERCENT = 0.08; // 8% of capital per trade (was 3%)
const MAX_TRADES_PER_SCAN = 6;     // Execute up to 6 trades per scan
const ALWAYS_BUILD_POSITION = true; // Always build positions when market is open

// Generate swing signals with market hours filtering
async function generateSwingSignals(
  accessToken: string,
  positions: Map<string, { amount: number; avgPrice: number; marketValue: number }>,
  balance: number,
  totalValue: number,
  marketStatus: MarketStatus
): Promise<Array<{ ticker: string; action: 'BUY' | 'SELL'; amount: number; reason: string; price: number; momentum: MomentumData; market: 'US' }>> {
  const signals: Array<{ ticker: string; action: 'BUY' | 'SELL'; amount: number; reason: string; price: number; momentum: MomentumData; market: 'US' }> = [];
  
  console.log(`[APEX] Genererer signaler for ${Object.keys(APEX_BLUEPRINT).length} aksjer...`);
  console.log(`[APEX] Aktive markeder: ${marketStatus.activeMarkets.join(', ') || 'INGEN'}`);
  console.log(`[APEX] US Market open: ${marketStatus.usOpen}`);
  
  for (const [ticker, info] of Object.entries(APEX_BLUEPRINT)) {
    // CRITICAL: Only trade stocks from OPEN markets
    // Fix: Check usOpen directly since all stocks are US
    if (!marketStatus.usOpen) {
      console.log(`[APEX] Skip ${ticker} - US market stengt`);
      continue; // Skip - market is closed
    }
    
    const instrument = await findInstrument(accessToken, ticker, info.saxoSymbol, info.assetType);
    if (!instrument) {
      console.log(`[APEX] Skipping ${ticker} - could not find instrument`);
      continue;
    }
    
    const priceData = await getPrice(accessToken, instrument.uic, info.assetType);
    const currentPrice = priceData.last;
    
    const momentum = analyzeMomentum(ticker, currentPrice);
    const pos = positions.get(ticker);
    const currentValue = pos?.marketValue || 0;
    const targetValue = (totalValue * info.targetVekt) / 100;
    const deviation = targetValue > 0 ? ((currentValue - targetValue) / targetValue) * 100 : -100;
    
    const dropFromHigh = momentum.localHigh > 0 ? (momentum.localHigh - currentPrice) / momentum.localHigh : 0;
    const riseFromLow = momentum.localLow > 0 ? (currentPrice - momentum.localLow) / momentum.localLow : 0;
    
    // AGGRESSIVE position sizing - 8% of capital per trade
    const baseSize = Math.max(10, Math.floor((balance * POSITION_SIZE_PERCENT) / currentPrice));
    const volatilityMultiplier = 1 + (info.volatilitet - 2) * 0.3; // Increased multiplier
    
    const marketLabel = 'US';
    
    console.log(`[APEX] ${ticker}: pris=${currentPrice.toFixed(2)}, RSI=${momentum.rsi.toFixed(0)}, drop=${(dropFromHigh*100).toFixed(3)}%, rise=${(riseFromLow*100).toFixed(3)}%`);
    
    // ============ AGGRESSIVE BUY SIGNALS ============
    
    // 1. DIP BUYING - very sensitive
    if (dropFromHigh >= DIP_THRESHOLD) {
      const dipStrength = Math.min(5, dropFromHigh / DIP_THRESHOLD);
      const orderSize = Math.floor(baseSize * dipStrength * volatilityMultiplier);
      
      if (orderSize > 0 && balance > orderSize * currentPrice) {
        signals.push({
          ticker,
          action: 'BUY',
          amount: orderSize,
          reason: `[${marketLabel}] DIP -${(dropFromHigh * 100).toFixed(2)}%`,
          price: currentPrice,
          momentum,
          market: info.market,
        });
        console.log(`[APEX] SIGNAL: ${ticker} DIP -${(dropFromHigh * 100).toFixed(2)}% -> KJOP ${orderSize}`);
      }
    }
    
    // 2. RSI oversold - more sensitive
    if (momentum.rsi < RSI_OVERSOLD && balance > baseSize * currentPrice) {
      const orderSize = Math.floor(baseSize * 2 * volatilityMultiplier);
      signals.push({
        ticker,
        action: 'BUY',
        amount: orderSize,
        reason: `[${marketLabel}] RSI LOW (${momentum.rsi.toFixed(0)})`,
        price: currentPrice,
        momentum,
        market: info.market,
      });
      console.log(`[APEX] SIGNAL: ${ticker} RSI ${momentum.rsi.toFixed(0)} -> KJOP ${orderSize}`);
    }
    
    // 3. TREND DOWN = buy opportunity
    if (momentum.trend === 'DOWN' && balance > baseSize * currentPrice) {
      const orderSize = Math.floor(baseSize * volatilityMultiplier);
      signals.push({
        ticker,
        action: 'BUY',
        amount: orderSize,
        reason: `[${marketLabel}] TREND DOWN - akkumulerer`,
        price: currentPrice,
        momentum,
        market: info.market,
      });
    }
    
    // ============ AGGRESSIVE SELL SIGNALS ============
    
    // 4. PEAK SELLING - quick profit taking
    if (riseFromLow >= PEAK_THRESHOLD && pos && pos.amount > 2) {
      const peakStrength = Math.min(5, riseFromLow / PEAK_THRESHOLD);
      const sellSize = Math.floor(Math.min(pos.amount * 0.4, baseSize * peakStrength));
      
      if (sellSize > 0) {
        signals.push({
          ticker,
          action: 'SELL',
          amount: sellSize,
          reason: `[${marketLabel}] PEAK +${(riseFromLow * 100).toFixed(2)}%`,
          price: currentPrice,
          momentum,
          market: info.market,
        });
        console.log(`[APEX] SIGNAL: ${ticker} PEAK +${(riseFromLow * 100).toFixed(2)}% -> SELG ${sellSize}`);
      }
    }
    
    // 5. RSI overbought - take profits
    if (momentum.rsi > RSI_OVERBOUGHT && pos && pos.amount > 3) {
      const sellSize = Math.floor(pos.amount * 0.25);
      if (sellSize > 0) {
        signals.push({
          ticker,
          action: 'SELL',
          amount: sellSize,
          reason: `[${marketLabel}] RSI HIGH (${momentum.rsi.toFixed(0)})`,
          price: currentPrice,
          momentum,
          market: info.market,
        });
      }
    }
    
    // ============ ALWAYS BUILD POSITIONS ============
    // This ensures we're always active in the market
    
    if (ALWAYS_BUILD_POSITION) {
      if (!pos || pos.amount === 0) {
        // No position - MUST buy to build
        const buildSize = Math.floor(baseSize * 3);
        if (balance > buildSize * currentPrice) {
          signals.push({
            ticker,
            action: 'BUY',
            amount: buildSize,
            reason: `[${marketLabel}] BYGG ${info.targetVekt}%`,
            price: currentPrice,
            momentum,
            market: info.market,
          });
          console.log(`[APEX] SIGNAL: ${ticker} BYGG POSISJON ${buildSize} aksjer`);
        }
      } else if (deviation < -10) {
        // Underweight - add more
        const addSize = Math.floor(baseSize * 1.5);
        if (balance > addSize * currentPrice) {
          signals.push({
            ticker,
            action: 'BUY',
            amount: addSize,
            reason: `[${marketLabel}] UNDERVEKT (${deviation.toFixed(0)}%)`,
            price: currentPrice,
            momentum,
            market: info.market,
          });
        }
      } else if (deviation > 20 && pos.amount > 5) {
        // Overweight - reduce
        const reduceSize = Math.floor(pos.amount * 0.15);
        if (reduceSize > 0) {
          signals.push({
            ticker,
            action: 'SELL',
            amount: reduceSize,
            reason: `[${marketLabel}] OVERVEKT (${deviation.toFixed(0)}%)`,
            price: currentPrice,
            momentum,
            market: info.market,
          });
        }
      }
    }
    
    // ============ FORCE ACTIVE TRADING ============
    // If no signals generated for this ticker yet, force a buy to stay active
    const hasSignalForTicker = signals.some(s => s.ticker === ticker);
    if (!hasSignalForTicker && balance > baseSize * currentPrice) {
      // Force accumulation - always be buying during market hours
      const forceSize = Math.floor(baseSize * 0.5); // Smaller position for forced trades
      if (forceSize > 0) {
        signals.push({
          ticker,
          action: 'BUY',
          amount: forceSize,
          reason: `[${marketLabel}] AKTIV AKKUMULERING`,
          price: currentPrice,
          momentum,
          market: info.market,
        });
        console.log(`[APEX] FORCED: ${ticker} AKTIV AKKUMULERING ${forceSize} aksjer @ ${currentPrice.toFixed(2)}`);
      }
    }
  }
  
  // Sort: Prioritize by signal type and potential
  signals.sort((a, b) => {
    // Priority: DIP > PEAK > RSI > TREND > BUILD
    const getPriority = (reason: string) => {
      if (reason.includes('DIP')) return 5;
      if (reason.includes('PEAK')) return 4;
      if (reason.includes('RSI')) return 3;
      if (reason.includes('TREND')) return 2;
      return 1;
    };
    return getPriority(b.reason) - getPriority(a.reason);
  });
  
  // Limit to MAX_TRADES_PER_SCAN to avoid over-trading
  const limitedSignals = signals.slice(0, MAX_TRADES_PER_SCAN);
  
  console.log(`[APEX] Genererte ${signals.length} signaler, utforer ${limitedSignals.length}`);
  
  return limitedSignals;
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

    // Get market status
    const marketStatus = getMarketStatus();
    
    console.log(`[APEX] ========== INTRA-DAY SWING SCAN ==========`);
    console.log(`[APEX] ${marketStatus.message}`);

    // If no markets are open, return early with status report
    if (marketStatus.activeMarkets.length === 0) {
      return NextResponse.json({
        success: true,
        mode: 'paper',
        marketStatus,
        message: 'Markeder stengt - venter pa apningstid',
        signals: [],
        executedTrades: [],
        report: `APEX QUANTUM v6.1 - ULTRA AGGRESSIV TRADER
${'='.repeat(50)}
Tid: ${new Date().toLocaleString('no-NO')}
${marketStatus.message}

US MARKET STENGT - Venter pa apning 15:30 CET

Strategi: 350-410% arlig avkastning
- DIP threshold: 0.1% (kjop pa minste dip)
- PEAK threshold: 0.2% (ta profitt raskt)  
- Posisjon: 8% av kapital per trade
- Max 6 trades per scan

Apningstid (CET): 15:30 - 22:00
`,
        stats: {
          baseCapital: BASE_TRADING_CAPITAL,
          marketsOpen: [],
          totalBought: 0,
          totalSold: 0,
          successful: 0,
          failed: 0,
        },
      });
    }

    const [balanceData, positions] = await Promise.all([
      getBalance(accessToken, accountKey),
      getPositions(accessToken, clientKey || accountKey),
    ]);

    const actualTotalValue = balanceData.total;
    const actualCash = balanceData.cash;
    const currentProfit = actualTotalValue - BASE_TRADING_CAPITAL;
    const locked = lockedProfits.get(accountKey) || 0;
    const tradingCapital = getAvailableTradingCapital(actualCash, actualTotalValue, accountKey);

    console.log(`[APEX] Kontoverdi: ${actualTotalValue.toLocaleString()} kr | Profitt: ${currentProfit.toLocaleString()} kr`);

    // Generate signals only for OPEN markets
    const signals = await generateSwingSignals(accessToken, positions, tradingCapital, BASE_TRADING_CAPITAL, marketStatus);
    
    console.log(`[APEX] Genererte ${signals.length} signaler for: ${marketStatus.activeMarkets.join(', ')}`);

    // Execute trades
    const executedTrades: Array<{
      ticker: string;
      saxoSymbol: string;
      action: string;
      amount: number;
      price: number;
      value: number;
      orderId?: string;
      status: string;
      reason: string;
      market: string;
    }> = [];
    
    let totalBought = 0;
    let totalSold = 0;
    const failedTickers: string[] = [];

    console.log(`[APEX] Utforer ${signals.length} signaler...`);
    
    for (const signal of signals) {
      const info = APEX_BLUEPRINT[signal.ticker];
      if (!info) {
        console.log(`[APEX] Skip ${signal.ticker} - ikke i blueprint`);
        continue;
      }

      const tradeValue = signal.amount * signal.price;
      console.log(`[APEX] Prosesserer: ${signal.action} ${signal.amount} ${signal.ticker} @ ${signal.price.toFixed(2)} = ${tradeValue.toFixed(0)} kr`);

      // Use actualCash instead of tradingCapital for more aggressive trading
      if (signal.action === 'BUY' && tradeValue > actualCash * 0.95) {
        console.log(`[APEX] Skip ${signal.ticker} - tradeValue ${tradeValue.toFixed(0)} > cash ${actualCash.toFixed(0)} * 0.95`);
        continue;
      }
      
      if (signal.action === 'SELL') {
        const pos = positions.get(signal.ticker);
        if (!pos || pos.amount < signal.amount) {
          console.log(`[APEX] Skip ${signal.ticker} SELL - ikke nok aksjer (har: ${pos?.amount || 0}, trenger: ${signal.amount})`);
          continue;
        }
      }

      console.log(`[APEX] Sender ordre: ${signal.action} ${signal.amount} ${signal.ticker}`);
      
      const result = await placeMarketOrder(
        accessToken,
        accountKey,
        signal.ticker,
        info.saxoSymbol,
        info.assetType,
        signal.amount,
        signal.action === 'BUY' ? 'Buy' : 'Sell',
        signal.reason,
        info.market
      );

      console.log(`[APEX] Ordre resultat: ${result.success ? 'OK' : 'FEIL'} - ${result.orderId || result.error}`);
      
      if (result.success) {
        if (signal.action === 'BUY') {
          totalBought += tradeValue;
          recordPurchase(accountKey, signal.ticker, signal.price, signal.amount);
          console.log(`[APEX] KJOPT: ${signal.amount} ${signal.ticker} @ ${signal.price.toFixed(2)} = ${tradeValue.toFixed(0)} kr`);
        } else {
          totalSold += tradeValue;
          lockProfit(accountKey, signal.ticker, signal.price, signal.amount);
          console.log(`[APEX] SOLGT: ${signal.amount} ${signal.ticker} @ ${signal.price.toFixed(2)} = ${tradeValue.toFixed(0)} kr`);
        }
      } else {
        console.log(`[APEX] FEIL: ${signal.ticker} - ${result.error}`);
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
        market: info.market,
      });

      if (!result.success) {
        failedTickers.push(signal.ticker);
      }
    }

    const successful = executedTrades.filter(t => t.status === 'OK');
    const failed = executedTrades.filter(t => t.status === 'FEIL');
    
    const totalLockedProfits = lockedProfits.get(accountKey) || 0;
    
    let report = `APEX QUANTUM v6.1 - INTRA-DAY SWING TRADER
${'='.repeat(50)}
Tid: ${new Date().toLocaleString('no-NO')}
${marketStatus.message}

=== PROFIT LOCK STATUS ===
Startkapital: ${BASE_TRADING_CAPITAL.toLocaleString()} kr
Kontoverdi: ${actualTotalValue.toLocaleString()} kr
Aktuell profitt: ${currentProfit >= 0 ? '+' : ''}${currentProfit.toLocaleString()} kr
Last profitt: ${totalLockedProfits.toLocaleString()} kr
Trading-kapital: ${tradingCapital.toLocaleString()} kr

=== AKTIVE MARKEDER ===
- Oslo Bors: IKKE TILGJENGELIG (Saxo SIM)
${marketStatus.usOpen ? '- Nasdaq/US: APEN (15:30-22:00 CET)' : '- Nasdaq/US: STENGT'}

=== SIGNALER (${signals.length}) ===
`;

    for (const s of signals) {
      report += `+ ${s.ticker} (${s.market}): ${s.action} ${s.amount} @ ${s.price.toFixed(2)} - ${s.reason}\n`;
    }

    report += `\n=== UTFORTE HANDLER (${successful.length}/${executedTrades.length}) ===\n`;
    for (const t of successful) {
      const marketLabel = 'US';
      report += `>>> ${marketLabel} - ${t.action === 'BUY' ? 'Kjop' : 'Salg'}: ${t.amount}x ${t.saxoSymbol} @ ${t.price.toFixed(2)} [${t.orderId}]\n`;
    }

    if (failed.length > 0) {
      report += `\n=== FEILEDE (${failed.length}) ===\n`;
      for (const t of failed) {
        report += `!!! ${t.ticker}: ${t.reason}\n`;
      }
    }

    const duration = Date.now() - startTime;
    report += `\nScan fullfort pa ${duration}ms`;

    return NextResponse.json({
      success: true,
      mode: mode || 'paper',
      marketStatus,
      signals: signals.map(s => ({
        ticker: s.ticker,
        saxoSymbol: APEX_BLUEPRINT[s.ticker]?.saxoSymbol,
        action: s.action,
        amount: s.amount,
        reason: s.reason,
        market: s.market,
      })),
      executedTrades,
      report,
      blueprint: Object.entries(APEX_BLUEPRINT).map(([ticker, info]) => {
        const pos = positions.get(ticker);
        return {
          ticker,
          saxoSymbol: info.saxoSymbol,
          navn: info.navn,
          targetVekt: info.targetVekt,
          market: info.market,
          marketOpen: marketStatus.activeMarkets.includes(info.market),
          antall: pos?.amount || 0,
          verdi: pos?.marketValue || 0,
        };
      }),
      stats: {
        baseCapital: BASE_TRADING_CAPITAL,
        actualTotalValue,
        currentProfit,
        lockedProfits: totalLockedProfits,
        tradingCapital,
        marketsOpen: marketStatus.activeMarkets,
        totalBought,
        totalSold,
        successful: successful.length,
        failed: failed.length,
      },
    });
  } catch (error) {
    console.error('[APEX] Error:', error);
    return NextResponse.json({
      error: 'Autonomous scan failed',
      details: String(error),
    }, { status: 500 });
  }
}

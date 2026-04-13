// APEX QUANTUM v6.2 - TimesFM Hybrid AI + Extreme 10% Daily Mode
// Build fix: 2026-04-13 21:00 CET - Removed type:module from package.json
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

// FORCE TRADING MODE - Always allow trading for SIM account
const FORCE_TRADING_ALWAYS = true;

function getMarketStatus(): MarketStatus {
  // Get current time in CET/CEST (Europe/Oslo timezone)
  const now = new Date();
  const cetTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Oslo' }));
  const hours = cetTime.getHours();
  const minutes = cetTime.getMinutes();
  const timeInMinutes = hours * 60 + minutes;
  
  // Nasdaq/US: 15:30 - 22:00 CET (930 - 1320 minutes)
  const normalUsOpen = timeInMinutes >= 930 && timeInMinutes < 1320;
  
  // FORCE MODE: Always open for SIM testing
  const usOpen = FORCE_TRADING_ALWAYS || normalUsOpen;
  
  // Always return US as active for maximum trading
  const activeMarkets: 'US'[] = ['US'];
  
  let message = '';
  if (normalUsOpen) {
    message = `US MARKET APEN (${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} CET) - EKSTREM TRADING AKTIV`;
  } else if (FORCE_TRADING_ALWAYS) {
    message = `FORCE MODE (${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} CET) - SIM trading aktiv utenfor apningstid`;
  } else {
    message = `US MARKET STENGT (${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} CET) - Apner 15:30 CET`;
  }
  
  console.log(`[APEX] MarketStatus: usOpen=${usOpen}, normalUsOpen=${normalUsOpen}, FORCE=${FORCE_TRADING_ALWAYS}`);
  
  return { osloOpen: false, usOpen, activeMarkets, message };
}

// ============ APEX QUANTUM v6.2 - TIMESFM HYBRID AI ============
// AI-hybrid trading system combining:
// 1. TimesFM time-series forecasting (40% weight)
// 2. RSI momentum analysis (30% weight)  
// 3. Apex Quantum portfolio logic (30% weight)
// Target: 350-410% annual return through active intra-day trading
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

// ============ TIMESFM PREDICTION ENGINE ============
// TimesFM-inspired prediction using exponential smoothing + trend detection
function runTimesFMPrediction(prices: number[], horizonSteps: number = 5): { 
  predictions: number[]; 
  predictedReturn: number; 
  confidence: number;
  direction: 'UP' | 'DOWN' | 'NEUTRAL';
} {
  const n = prices.length;
  if (n < 3) {
    return { predictions: [], predictedReturn: 0, confidence: 50, direction: 'NEUTRAL' };
  }
  
  // Calculate trend using linear regression
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += prices[i];
    sumXY += i * prices[i];
    sumX2 += i * i;
  }
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  
  // Calculate volatility
  const mean = sumY / n;
  let variance = 0;
  for (let i = 0; i < n; i++) {
    variance += Math.pow(prices[i] - mean, 2);
  }
  const volatility = Math.sqrt(variance / n) / mean;
  
  // Exponential smoothing
  const alpha = 0.4;
  let smoothed = prices[n - 1];
  for (let i = Math.max(0, n - 10); i < n; i++) {
    smoothed = alpha * prices[i] + (1 - alpha) * smoothed;
  }
  
  // Generate predictions
  const predictions: number[] = [];
  let lastPrice = prices[n - 1];
  
  for (let i = 0; i < horizonSteps; i++) {
    const trendComponent = slope * 0.7;
    const meanReversionComponent = (smoothed - lastPrice) * 0.15;
    const nextPrice = lastPrice + trendComponent + meanReversionComponent;
    predictions.push(Math.max(0.01, nextPrice));
    lastPrice = nextPrice;
  }
  
  const currentPrice = prices[n - 1];
  const finalPrediction = predictions[predictions.length - 1];
  const predictedReturn = (finalPrediction - currentPrice) / currentPrice;
  
  // Confidence based on trend consistency and volatility
  const trendStrength = Math.abs(slope) / mean;
  const confidence = Math.min(95, Math.max(40, 60 + trendStrength * 500 - volatility * 100));
  
  const direction: 'UP' | 'DOWN' | 'NEUTRAL' = 
    predictedReturn > 0.005 ? 'UP' : predictedReturn < -0.005 ? 'DOWN' : 'NEUTRAL';
  
  return { predictions, predictedReturn, confidence, direction };
}

// Calculate TimesFM-enhanced score
function calculateTimesFMScore(
  priceHistory: number[],
  rsi: number,
  targetWeight: number
): { score: number; action: 'BUY' | 'SELL' | 'HOLD'; reason: string } {
  const tfm = runTimesFMPrediction(priceHistory);
  
  // TimesFM Score (40% weight)
  const timesfmScore = Math.min(100, Math.max(0, 50 + tfm.predictedReturn * 1000));
  
  // Momentum Score (30% weight) - RSI-based
  const momentumScore = Math.min(100, Math.max(0, 100 - rsi));
  
  // Apex Score (30% weight) - portfolio weight
  const apexScore = targetWeight * 2;
  
  // Combined Score
  const combinedScore = timesfmScore * 0.4 + momentumScore * 0.3 + apexScore * 0.3;
  
  let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
  let reason = '';
  
  if (combinedScore >= 55 && tfm.direction === 'UP') {
    action = 'BUY';
    reason = `TimesFM: ${tfm.direction} +${(tfm.predictedReturn * 100).toFixed(2)}% (${tfm.confidence.toFixed(0)}% conf)`;
  } else if (combinedScore >= 50 && rsi < 40) {
    action = 'BUY';
    reason = `RSI oversold (${rsi.toFixed(0)}) + TimesFM: ${(tfm.predictedReturn * 100).toFixed(2)}%`;
  } else if (combinedScore <= 45 && tfm.direction === 'DOWN') {
    action = 'SELL';
    reason = `TimesFM: ${tfm.direction} ${(tfm.predictedReturn * 100).toFixed(2)}%`;
  } else if (rsi > 65) {
    action = 'SELL';
    reason = `RSI overbought (${rsi.toFixed(0)}) - ta profitt`;
  }
  
  return { score: combinedScore, action, reason };
}

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

// ============ APEX QUANTUM EXTREME 10% DAILY CONFIG ============
// Target: 10% DAILY return through ultra-aggressive trading
// Strategy: Maximum position churn, scalping, continuous accumulation
const DIP_THRESHOLD = 0.0003;      // Buy on ANY 0.03% dip - ULTRA SENSITIVE
const PEAK_THRESHOLD = 0.0005;     // Sell on 0.05% rise - RAPID profit-taking
const RSI_OVERSOLD = 48;           // Almost always buying
const RSI_OVERBOUGHT = 52;         // Almost always selling profits
const POSITION_SIZE_PERCENT = 0.20; // 20% of capital per trade - MASSIVE positions
const MAX_TRADES_PER_SCAN = 15;    // Execute up to 15 trades per scan
const ALWAYS_BUILD_POSITION = true; // ALWAYS build positions
const FORCE_TRADE_EVERY_SCAN = true; // GUARANTEE trades every scan
const PROFIT_TAKE_THRESHOLD = 0.003; // Take profit at 0.3% gain
const SCALP_MODE = true;           // Enable scalping for micro-profits

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
    
    // ============ TIMESFM HYBRID SIGNAL ============
    // Get price array from momentum history
    const priceArray = momentum.prices.map(p => p.price);
    const tfmSignal = calculateTimesFMScore(priceArray, momentum.rsi, info.targetVekt);
    
    console.log(`[APEX] ${ticker}: pris=${currentPrice.toFixed(2)}, RSI=${momentum.rsi.toFixed(0)}, TimesFM=${tfmSignal.score.toFixed(0)} (${tfmSignal.action})`);
    
    // ============ TIMESFM-DRIVEN SIGNALS (PRIMARY) ============
    
    // TimesFM BUY signal - highest priority
    if (tfmSignal.action === 'BUY' && balance > baseSize * currentPrice * 2) {
      const tfmSize = Math.floor(baseSize * 2 * volatilityMultiplier);
      signals.push({
        ticker,
        action: 'BUY',
        amount: tfmSize,
        reason: `[TIMESFM] ${tfmSignal.reason}`,
        price: currentPrice,
        momentum,
        market: info.market,
      });
      console.log(`[APEX] TIMESFM SIGNAL: KJOP ${tfmSize} ${ticker} - ${tfmSignal.reason}`);
    }
    
    // TimesFM SELL signal
    if (tfmSignal.action === 'SELL' && pos && pos.amount > 5) {
      const tfmSellSize = Math.floor(pos.amount * 0.3);
      if (tfmSellSize > 0) {
        signals.push({
          ticker,
          action: 'SELL',
          amount: tfmSellSize,
          reason: `[TIMESFM] ${tfmSignal.reason}`,
          price: currentPrice,
          momentum,
          market: info.market,
        });
        console.log(`[APEX] TIMESFM SIGNAL: SELG ${tfmSellSize} ${ticker} - ${tfmSignal.reason}`);
      }
    }
    
    // ============ MOMENTUM-BASED SIGNALS (SECONDARY) ============
    
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
    
    // ============ EXTREME GUARANTEED TRADE - 10% DAILY TARGET ============
    // ALWAYS force trades to reach 10% daily target
    // SCALP MODE: Lock in any profits immediately
    
    if (SCALP_MODE && pos && pos.amount > 0 && pos.avgPrice > 0) {
      const profitPercent = (currentPrice - pos.avgPrice) / pos.avgPrice;
      
      // Take ANY profit above threshold
      if (profitPercent >= PROFIT_TAKE_THRESHOLD) {
        const scalpSize = Math.max(1, Math.floor(pos.amount * 0.5)); // Sell 50% to lock profit
        signals.push({
          ticker,
          action: 'SELL',
          amount: scalpSize,
          reason: `[SCALP] PROFITT +${(profitPercent * 100).toFixed(2)}% - SELGER`,
          price: currentPrice,
          momentum,
          market: info.market,
        });
        console.log(`[APEX] SCALP: SELG ${scalpSize} ${ticker} @ +${(profitPercent * 100).toFixed(2)}% profitt`);
      }
      
      // DCA on dips
      if (profitPercent < -0.002 && balance > baseSize * currentPrice) {
        const dcaSize = Math.floor(baseSize * 1.5);
        signals.push({
          ticker,
          action: 'BUY',
          amount: dcaSize,
          reason: `[DCA] Ned ${(profitPercent * 100).toFixed(2)}% - akkumulerer`,
          price: currentPrice,
          momentum,
          market: info.market,
        });
        console.log(`[APEX] DCA: KJOP ${dcaSize} ${ticker} @ ${(profitPercent * 100).toFixed(2)}%`);
      }
    }
    
    // FORCE_TRADE: Always add position if we have cash
    if (FORCE_TRADE_EVERY_SCAN && balance > baseSize * currentPrice * 0.5) {
      const forceSize = Math.max(10, Math.floor(baseSize * 1.2));
      signals.push({
        ticker,
        action: 'BUY',
        amount: forceSize,
        reason: `[FORCE] EKSTREM AKKUMULERING`,
        price: currentPrice,
        momentum,
        market: info.market,
      });
      console.log(`[APEX] FORCE: KJOP ${forceSize} ${ticker} @ ${currentPrice.toFixed(2)}`);
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
  const body = await request.json().catch(() => ({}));
  const mode = body.mode || 'paper';
  
  console.log(`[APEX] ====================================================`);
  console.log(`[APEX] AUTONOMOUS SCAN TRIGGERED - mode: ${mode}`);
  console.log(`[APEX] Time: ${new Date().toISOString()}`);
  console.log(`[APEX] FORCE_TRADING_ALWAYS: ${FORCE_TRADING_ALWAYS}`);
  console.log(`[APEX] ====================================================`);
  
  // Get credentials from cookies
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('apex_saxo_token')?.value;
  const accountKey = cookieStore.get('apex_saxo_account_key')?.value;
  const clientKey = cookieStore.get('apex_saxo_client_key')?.value;

  console.log(`[APEX] Credentials check: token=${!!accessToken}, accountKey=${!!accountKey}, clientKey=${!!clientKey}`);

  if (!accessToken || !accountKey) {
    console.log(`[APEX] ERROR: Missing credentials - cannot trade`);
    return NextResponse.json(
      { error: 'Ikke tilkoblet Saxo Bank. Vennligst koble til forst.' },
      { status: 401 }
    );
  }
  
  console.log(`[APEX] Credentials OK - proceeding with trading`);

  try {
    // Get market status
    const marketStatus = getMarketStatus();
    
    console.log(`[APEX] ========== INTRA-DAY SWING SCAN ==========`);
    console.log(`[APEX] ${marketStatus.message}`);

    // With FORCE_TRADING_ALWAYS, we never return early
    // Markets are always "open" for SIM trading
    console.log(`[APEX] Active markets: ${marketStatus.activeMarkets.join(', ')} | Force mode: ${FORCE_TRADING_ALWAYS}`);

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
    console.log(`[APEX] Kaller generateSwingSignals med balance=${tradingCapital}, total=${BASE_TRADING_CAPITAL}`);
    const signals = await generateSwingSignals(accessToken, positions, tradingCapital, BASE_TRADING_CAPITAL, marketStatus);
    
    console.log(`[APEX] ===== SIGNAL RESULTAT =====`);
    console.log(`[APEX] Genererte ${signals.length} signaler for: ${marketStatus.activeMarkets.join(', ')}`);
    signals.forEach((s, i) => {
      console.log(`[APEX] Signal ${i+1}: ${s.action} ${s.amount} ${s.ticker} @ ${s.price.toFixed(2)} - ${s.reason}`);
    });
    console.log(`[APEX] ===== STARTER UTFORELSE =====`);

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
    
    let report = `APEX QUANTUM v6.2 - EKSTREM 10% DAGLIG MODUS
${'='.repeat(50)}
Tid: ${new Date().toLocaleString('no-NO')}
${marketStatus.message}
FORCE TRADING: AKTIV (24/7 SIM)

=== PROFIT STATUS ===
Startkapital: ${BASE_TRADING_CAPITAL.toLocaleString()} kr
Kontoverdi: ${actualTotalValue.toLocaleString()} kr
Aktuell profitt: ${currentProfit >= 0 ? '+' : ''}${currentProfit.toLocaleString()} kr
Last profitt: ${totalLockedProfits.toLocaleString()} kr
Trading-kapital: ${tradingCapital.toLocaleString()} kr

=== TRADING CONFIG ===
- SCALP MODE: AKTIV (profitt ved +0.3%)
- DCA MODE: AKTIV (kjop ved -0.2%)
- Max trades per scan: 15

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

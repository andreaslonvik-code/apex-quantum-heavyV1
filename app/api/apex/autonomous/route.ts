// APEX QUANTUM v7 - Autonomous Trading Engine
// Multi-exchange support: US (XNAS/XNYS), Oslo (XOSL), Germany (XETR), China/HK (XHKG/XSHG)
// Self-cleaning: auto-purge every 10 seconds
// Day-trading: 10-12% daily target with aggressive scalping

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  safeSaxoFetch,
  findInstrument,
  getPrice,
  getBalance,
  getPositions,
  getDebugLog,
  clearDebugLog,
  isLiveMode,
  startAutoPurge,
  type SaxoPosition,
  type SaxoPrice,
} from '@/lib/saxo';

// ============ APEX QUANTUM v7 BLUEPRINT ============
// Full multi-exchange support with aggressive day-trading
const APEX_BLUEPRINT: Record<string, {
  navn: string;
  targetVekt: number;
  volatilitet: number;
  saxoSymbol: string;
  assetType: string;
  exchange: 'XNAS' | 'XNYS' | 'XOSL' | 'XETR' | 'XHKG';
  market: 'US' | 'OSLO' | 'GERMANY' | 'CHINA';
}> = {
  // US Markets - NASDAQ/NYSE (60% allocation)
  MU:   { navn: 'Micron Technology',    targetVekt: 30, volatilitet: 3, saxoSymbol: 'MU:xnas',   assetType: 'Stock', exchange: 'XNAS', market: 'US' },
  CEG:  { navn: 'Constellation Energy', targetVekt: 12, volatilitet: 2, saxoSymbol: 'CEG:xnas',  assetType: 'Stock', exchange: 'XNAS', market: 'US' },
  VRT:  { navn: 'Vertiv Holdings',      targetVekt: 10, volatilitet: 2, saxoSymbol: 'VRT:xnys',  assetType: 'Stock', exchange: 'XNYS', market: 'US' },
  RKLB: { navn: 'Rocket Lab',           targetVekt: 8,  volatilitet: 4, saxoSymbol: 'RKLB:xnas', assetType: 'Stock', exchange: 'XNAS', market: 'US' },
  LMND: { navn: 'Lemonade Inc',         targetVekt: 6,  volatilitet: 4, saxoSymbol: 'LMND:xnys', assetType: 'Stock', exchange: 'XNYS', market: 'US' },
  ABSI: { navn: 'Absci Corporation',    targetVekt: 4,  volatilitet: 5, saxoSymbol: 'ABSI:xnas', assetType: 'Stock', exchange: 'XNAS', market: 'US' },
};

// ============ AGGRESSIVE DAY-TRADING CONFIG ============
const CONFIG = {
  DIP_THRESHOLD: 0.0003,        // Buy on 0.03% dip - ULTRA SENSITIVE
  PEAK_THRESHOLD: 0.0005,       // Sell on 0.05% rise
  RSI_OVERSOLD: 48,             // Almost always buying
  RSI_OVERBOUGHT: 52,           // Almost always selling
  PROFIT_TAKE_THRESHOLD: 0.003, // Take profit at 0.3%
  STOP_LOSS_THRESHOLD: -0.02,   // Stop loss at -2%
  POSITION_SIZE_PERCENT: 0.20,  // 20% of capital per trade
  MAX_TRADES_PER_SCAN: 15,      // Max 15 trades per scan
  FORCE_TRADING_ALWAYS: true,   // SIM mode always active
  BASE_TRADING_CAPITAL: 1000000,
  PURGE_INTERVAL_MS: 10000,     // Auto-purge every 10s
};

// ============ MARKET HOURS (CET) ============
interface MarketStatus {
  usOpen: boolean;
  osloOpen: boolean;
  germanyOpen: boolean;
  chinaOpen: boolean;
  activeMarkets: string[];
  cetTime: string;
  message: string;
}

function getMarketStatus(): MarketStatus {
  const now = new Date();
  const cetTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Oslo' }));
  const hours = cetTime.getHours();
  const minutes = cetTime.getMinutes();
  const dayOfWeek = cetTime.getDay();
  const timeInMinutes = hours * 60 + minutes;
  
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  
  // Market hours (CET)
  const normalUsOpen = !isWeekend && timeInMinutes >= 930 && timeInMinutes < 1320;  // 15:30-22:00
  const osloOpen = !isWeekend && timeInMinutes >= 540 && timeInMinutes < 985;       // 09:00-16:25
  const germanyOpen = !isWeekend && timeInMinutes >= 540 && timeInMinutes < 1050;   // 09:00-17:30
  const chinaOpen = !isWeekend && timeInMinutes >= 150 && timeInMinutes < 540;      // 02:30-09:00
  
  // Force mode for SIM
  const usOpen = CONFIG.FORCE_TRADING_ALWAYS || normalUsOpen;
  
  const activeMarkets: string[] = [];
  if (usOpen) activeMarkets.push('US');
  if (osloOpen) activeMarkets.push('OSLO');
  if (germanyOpen) activeMarkets.push('GERMANY');
  if (chinaOpen) activeMarkets.push('CHINA');
  
  const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} CET`;
  
  let message = '';
  if (normalUsOpen) {
    message = `US MARKET APEN (${timeStr}) - EKSTREM TRADING AKTIV`;
  } else if (CONFIG.FORCE_TRADING_ALWAYS) {
    message = `FORCE MODE (${timeStr}) - SIM trading aktiv 24/7`;
  } else {
    message = `US MARKET STENGT (${timeStr}) - Apner 15:30 CET`;
  }
  
  return { usOpen, osloOpen, germanyOpen, chinaOpen, activeMarkets, cetTime: timeStr, message };
}

// ============ MOMENTUM TRACKING ============
interface PricePoint {
  price: number;
  timestamp: number;
}

const priceHistory: Map<string, PricePoint[]> = new Map();
const purchasePrices: Map<string, Map<string, number>> = new Map();
const lockedProfits: Map<string, number> = new Map();

// UIC cache for performance
const uicCache: Map<string, { uic: number; assetType: string }> = new Map();

function calculateRSI(prices: PricePoint[]): number {
  if (prices.length < 5) return 50;
  
  const recent = prices.slice(-15);
  let gains = 0, losses = 0, count = 0;
  
  for (let i = 1; i < recent.length; i++) {
    const change = recent[i].price - recent[i - 1].price;
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

function analyzeMomentum(ticker: string, currentPrice: number): {
  rsi: number;
  localHigh: number;
  localLow: number;
  trend: 'UP' | 'DOWN' | 'NEUTRAL';
  prices: PricePoint[];
} {
  const history = priceHistory.get(ticker) || [];
  const now = Date.now();
  
  history.push({ price: currentPrice, timestamp: now });
  
  // Keep only last 15 minutes
  const fifteenMinAgo = now - 15 * 60 * 1000;
  const recentHistory = history.filter(p => p.timestamp > fifteenMinAgo);
  priceHistory.set(ticker, recentHistory);
  
  if (recentHistory.length < 3) {
    return { rsi: 50, localHigh: currentPrice, localLow: currentPrice, trend: 'NEUTRAL', prices: recentHistory };
  }
  
  const fiveMinAgo = now - 5 * 60 * 1000;
  const fiveMinPrices = recentHistory.filter(p => p.timestamp > fiveMinAgo);
  
  const localHigh = Math.max(...fiveMinPrices.map(p => p.price));
  const localLow = Math.min(...fiveMinPrices.map(p => p.price));
  const rsi = calculateRSI(recentHistory);
  
  const avgRecent = fiveMinPrices.slice(-3).reduce((s, p) => s + p.price, 0) / 3;
  const avgOlder = fiveMinPrices.slice(0, 3).reduce((s, p) => s + p.price, 0) / Math.min(3, fiveMinPrices.length);
  const trend = avgRecent > avgOlder * 1.002 ? 'UP' : avgRecent < avgOlder * 0.998 ? 'DOWN' : 'NEUTRAL';
  
  return { rsi, localHigh, localLow, trend, prices: recentHistory };
}

// ============ ORDER PLACEMENT ============
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
  // Find instrument
  const instrumentResult = await findInstrument(accessToken, ticker, saxoSymbol.split(':')[1]);
  if (!instrumentResult.success || !instrumentResult.data) {
    console.log(`[APEX] Could not find instrument ${ticker}: ${instrumentResult.error}`);
    return { success: false, error: instrumentResult.error || `Instrument not found: ${ticker}` };
  }
  
  const instrument = instrumentResult.data;
  
  const payload = {
    AccountKey: accountKey,
    Amount: Math.floor(Math.abs(amount)),
    AssetType: instrument.assetType,
    BuySell: buySell,
    OrderType: 'Market',
    OrderDuration: { DurationType: 'DayOrder' },
    Uic: instrument.uic,
    ManualOrder: false,
  };
  
  console.log(`[APEX] Placing ${buySell} ${amount}x ${saxoSymbol} (UIC: ${instrument.uic})`);
  
  const result = await safeSaxoFetch<{ OrderId: string; OrderStatus?: string }>(
    '/trade/v2/orders',
    {
      method: 'POST',
      accessToken,
      body: JSON.stringify(payload),
    }
  );
  
  if (!result.success) {
    console.log(`[APEX] Order FAILED: ${result.error}`);
    return { success: false, error: result.error, uic: instrument.uic };
  }
  
  console.log(`[APEX] Order SUCCESS: ${result.data?.OrderId}`);
  return { success: true, orderId: result.data?.OrderId, uic: instrument.uic };
}

// ============ SIGNAL GENERATION ============
interface TradingSignal {
  ticker: string;
  action: 'BUY' | 'SELL';
  amount: number;
  reason: string;
  price: number;
  market: string;
}

async function generateSignals(
  accessToken: string,
  positions: Map<string, SaxoPosition>,
  cash: number,
  totalValue: number,
  marketStatus: MarketStatus
): Promise<TradingSignal[]> {
  const signals: TradingSignal[] = [];
  
  console.log(`[APEX] Generating signals for ${Object.keys(APEX_BLUEPRINT).length} instruments...`);
  console.log(`[APEX] Active markets: ${marketStatus.activeMarkets.join(', ') || 'NONE'}`);
  
  for (const [ticker, info] of Object.entries(APEX_BLUEPRINT)) {
    // Check market hours
    const marketOpen = 
      (info.market === 'US' && marketStatus.usOpen) ||
      (info.market === 'OSLO' && marketStatus.osloOpen) ||
      (info.market === 'GERMANY' && marketStatus.germanyOpen) ||
      (info.market === 'CHINA' && marketStatus.chinaOpen);
    
    if (!marketOpen && !CONFIG.FORCE_TRADING_ALWAYS) {
      console.log(`[APEX] Skip ${ticker} - market closed`);
      continue;
    }
    
    // Find instrument
    const instrumentResult = await findInstrument(accessToken, ticker, info.exchange.toLowerCase());
    if (!instrumentResult.success || !instrumentResult.data) {
      console.log(`[APEX] Skip ${ticker} - instrument not found`);
      continue;
    }
    
    // Get price
    const priceResult = await getPrice(accessToken, instrumentResult.data.uic, info.assetType);
    if (!priceResult.success || !priceResult.data) {
      console.log(`[APEX] Skip ${ticker} - price unavailable`);
      continue;
    }
    
    const currentPrice = priceResult.data.last;
    const momentum = analyzeMomentum(ticker, currentPrice);
    
    const pos = positions.get(ticker);
    const posAmount = pos?.amount || 0;
    const posAvgPrice = pos?.avgPrice || 0;
    const posValue = pos?.marketValue || 0;
    
    // Position sizing
    const baseSize = Math.max(5, Math.floor((cash * CONFIG.POSITION_SIZE_PERCENT) / currentPrice));
    const volatilityMultiplier = 1 + (info.volatilitet - 2) * 0.25;
    
    // Target allocation
    const targetValue = (totalValue * info.targetVekt) / 100;
    const deviation = targetValue > 0 ? ((posValue - targetValue) / targetValue) * 100 : -100;
    
    // Price movement
    const dropFromHigh = momentum.localHigh > 0 ? (momentum.localHigh - currentPrice) / momentum.localHigh : 0;
    const riseFromLow = momentum.localLow > 0 ? (currentPrice - momentum.localLow) / momentum.localLow : 0;
    
    console.log(`[APEX] ${ticker}: price=${currentPrice.toFixed(2)}, RSI=${momentum.rsi.toFixed(0)}, trend=${momentum.trend}`);
    
    // ============ BUY SIGNALS ============
    
    // DIP buying
    if (dropFromHigh >= CONFIG.DIP_THRESHOLD && cash > baseSize * currentPrice) {
      const dipStrength = Math.min(5, dropFromHigh / CONFIG.DIP_THRESHOLD);
      const orderSize = Math.floor(baseSize * dipStrength * volatilityMultiplier);
      signals.push({
        ticker,
        action: 'BUY',
        amount: orderSize,
        reason: `[${info.market}] DIP -${(dropFromHigh * 100).toFixed(2)}%`,
        price: currentPrice,
        market: info.market,
      });
    }
    
    // RSI oversold
    if (momentum.rsi < CONFIG.RSI_OVERSOLD && cash > baseSize * currentPrice) {
      signals.push({
        ticker,
        action: 'BUY',
        amount: Math.floor(baseSize * 2 * volatilityMultiplier),
        reason: `[${info.market}] RSI LOW (${momentum.rsi.toFixed(0)})`,
        price: currentPrice,
        market: info.market,
      });
    }
    
    // Build position if none
    if (posAmount === 0 && cash > baseSize * currentPrice * 2) {
      signals.push({
        ticker,
        action: 'BUY',
        amount: Math.floor(baseSize * 3),
        reason: `[${info.market}] BYGG ${info.targetVekt}%`,
        price: currentPrice,
        market: info.market,
      });
    }
    
    // Underweight
    if (deviation < -10 && cash > baseSize * currentPrice) {
      signals.push({
        ticker,
        action: 'BUY',
        amount: Math.floor(baseSize * 1.5),
        reason: `[${info.market}] UNDERVEKT (${deviation.toFixed(0)}%)`,
        price: currentPrice,
        market: info.market,
      });
    }
    
    // Force accumulation
    if (CONFIG.FORCE_TRADING_ALWAYS && cash > baseSize * currentPrice * 0.5) {
      signals.push({
        ticker,
        action: 'BUY',
        amount: Math.max(10, Math.floor(baseSize * 1.2)),
        reason: `[FORCE] EKSTREM AKKUMULERING`,
        price: currentPrice,
        market: info.market,
      });
    }
    
    // ============ SELL SIGNALS ============
    
    // Peak selling
    if (riseFromLow >= CONFIG.PEAK_THRESHOLD && posAmount > 2) {
      const peakStrength = Math.min(5, riseFromLow / CONFIG.PEAK_THRESHOLD);
      const sellSize = Math.floor(Math.min(posAmount * 0.4, baseSize * peakStrength));
      if (sellSize > 0) {
        signals.push({
          ticker,
          action: 'SELL',
          amount: sellSize,
          reason: `[${info.market}] PEAK +${(riseFromLow * 100).toFixed(2)}%`,
          price: currentPrice,
          market: info.market,
        });
      }
    }
    
    // RSI overbought
    if (momentum.rsi > CONFIG.RSI_OVERBOUGHT && posAmount > 3) {
      signals.push({
        ticker,
        action: 'SELL',
        amount: Math.floor(posAmount * 0.25),
        reason: `[${info.market}] RSI HIGH (${momentum.rsi.toFixed(0)})`,
        price: currentPrice,
        market: info.market,
      });
    }
    
    // Profit taking / Scalp mode
    if (posAmount > 0 && posAvgPrice > 0) {
      const profitPercent = (currentPrice - posAvgPrice) / posAvgPrice;
      
      if (profitPercent >= CONFIG.PROFIT_TAKE_THRESHOLD) {
        signals.push({
          ticker,
          action: 'SELL',
          amount: Math.max(1, Math.floor(posAmount * 0.5)),
          reason: `[SCALP] PROFITT +${(profitPercent * 100).toFixed(2)}%`,
          price: currentPrice,
          market: info.market,
        });
      }
      
      // Stop loss
      if (profitPercent <= CONFIG.STOP_LOSS_THRESHOLD) {
        signals.push({
          ticker,
          action: 'SELL',
          amount: Math.floor(posAmount * 0.5),
          reason: `[STOPLOSS] ${(profitPercent * 100).toFixed(2)}%`,
          price: currentPrice,
          market: info.market,
        });
      }
    }
    
    // Overweight reduction
    if (deviation > 20 && posAmount > 5) {
      signals.push({
        ticker,
        action: 'SELL',
        amount: Math.floor(posAmount * 0.15),
        reason: `[${info.market}] OVERVEKT (+${deviation.toFixed(0)}%)`,
        price: currentPrice,
        market: info.market,
      });
    }
  }
  
  // Sort by priority and limit
  signals.sort((a, b) => {
    const getPriority = (reason: string) => {
      if (reason.includes('STOPLOSS')) return 6;
      if (reason.includes('DIP')) return 5;
      if (reason.includes('PEAK') || reason.includes('SCALP')) return 4;
      if (reason.includes('RSI')) return 3;
      if (reason.includes('FORCE')) return 2;
      return 1;
    };
    return getPriority(b.reason) - getPriority(a.reason);
  });
  
  const limited = signals.slice(0, CONFIG.MAX_TRADES_PER_SCAN);
  console.log(`[APEX] Generated ${signals.length} signals, executing ${limited.length}`);
  
  return limited;
}

// ============ MAIN HANDLER ============
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const mode = body.mode || 'sim';
  
  console.log(`[APEX] ========== APEX QUANTUM v7 SCAN ==========`);
  console.log(`[APEX] Mode: ${mode.toUpperCase()} | Time: ${new Date().toISOString()}`);
  console.log(`[APEX] Live: ${isLiveMode()} | Force: ${CONFIG.FORCE_TRADING_ALWAYS}`);
  
  // Start auto-purge (self-cleaning)
  startAutoPurge(CONFIG.PURGE_INTERVAL_MS);
  
  // Get credentials
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('apex_saxo_token')?.value;
  const accountKey = cookieStore.get('apex_saxo_account_key')?.value;
  const clientKey = cookieStore.get('apex_saxo_client_key')?.value || accountKey;
  
  if (!accessToken || !accountKey) {
    console.log(`[APEX] ERROR: Missing credentials`);
    return NextResponse.json(
      { error: 'Ikke tilkoblet Saxo Bank. Vennligst koble til forst.' },
      { status: 401 }
    );
  }
  
  try {
    const startTime = Date.now();
    const marketStatus = getMarketStatus();
    
    console.log(`[APEX] ${marketStatus.message}`);
    
    // Get balance
    const balanceResult = await getBalance(accessToken, accountKey);
    if (!balanceResult.success || !balanceResult.data) {
      console.log(`[APEX] Balance error: ${balanceResult.error}`);
      return NextResponse.json({ error: balanceResult.error }, { status: 500 });
    }
    
    const cash = balanceResult.data.cash;
    const totalValue = balanceResult.data.total || CONFIG.BASE_TRADING_CAPITAL;
    const currentProfit = totalValue - CONFIG.BASE_TRADING_CAPITAL;
    
    console.log(`[APEX] Balance: cash=${cash.toFixed(0)}, total=${totalValue.toFixed(0)}, P/L=${currentProfit.toFixed(0)}`);
    
    // Get positions
    const positionsResult = await getPositions(accessToken, clientKey);
    const positionsMap = new Map<string, SaxoPosition>();
    
    if (positionsResult.success && positionsResult.data) {
      for (const pos of positionsResult.data) {
        if (pos.ticker) {
          positionsMap.set(pos.ticker.toUpperCase(), pos);
        }
      }
    }
    
    // Generate signals
    const signals = await generateSignals(accessToken, positionsMap, cash, totalValue, marketStatus);
    
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
    let actualCash = cash;
    
    for (const signal of signals) {
      const info = APEX_BLUEPRINT[signal.ticker];
      if (!info) continue;
      
      const tradeValue = signal.amount * signal.price;
      
      // Check cash for buys
      if (signal.action === 'BUY' && tradeValue > actualCash * 0.95) {
        console.log(`[APEX] Skip ${signal.ticker}: insufficient cash`);
        continue;
      }
      
      // Check position for sells
      if (signal.action === 'SELL') {
        const pos = positionsMap.get(signal.ticker);
        if (!pos || pos.amount < signal.amount) {
          console.log(`[APEX] Skip ${signal.ticker}: insufficient shares`);
          continue;
        }
      }
      
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
      
      if (result.success) {
        if (signal.action === 'BUY') {
          totalBought += tradeValue;
          actualCash -= tradeValue;
        } else {
          totalSold += tradeValue;
          actualCash += tradeValue;
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
        reason: result.success ? signal.reason : (result.error || 'Unknown error'),
        market: info.market,
      });
    }
    
    const successful = executedTrades.filter(t => t.status === 'OK');
    const failed = executedTrades.filter(t => t.status === 'FEIL');
    const duration = Date.now() - startTime;
    
    const totalLocked = lockedProfits.get(accountKey) || 0;
    
    // Build report
    const report = `APEX QUANTUM v7 - MULTI-EXCHANGE DAY-TRADING
${'='.repeat(50)}
Tid: ${new Date().toLocaleString('no-NO')}
${marketStatus.message}
Mode: ${mode.toUpperCase()} | Force: ${CONFIG.FORCE_TRADING_ALWAYS ? 'AKTIV' : 'INAKTIV'}

=== PROFIT STATUS ===
Startkapital: ${CONFIG.BASE_TRADING_CAPITAL.toLocaleString()} kr
Kontoverdi: ${totalValue.toLocaleString()} kr
P/L: ${currentProfit >= 0 ? '+' : ''}${currentProfit.toLocaleString()} kr
Locked: ${totalLocked.toLocaleString()} kr

=== TRADES ===
Executed: ${successful.length}/${executedTrades.length}
Bought: ${totalBought.toLocaleString()} kr
Sold: ${totalSold.toLocaleString()} kr

Scan completed in ${duration}ms`;
    
    console.log(`[APEX] ========== SCAN COMPLETE (${duration}ms) ==========`);
    
    return NextResponse.json({
      success: true,
      mode,
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
      portfolio: Object.entries(APEX_BLUEPRINT).map(([ticker, info]) => {
        const pos = positionsMap.get(ticker);
        return {
          ticker,
          saxoSymbol: info.saxoSymbol,
          navn: info.navn,
          vekt: info.targetVekt,
          aksjon: signals.find(s => s.ticker === ticker)?.action || 'HOLD',
          antall: pos?.amount || 0,
        };
      }),
      stats: {
        baseCapital: CONFIG.BASE_TRADING_CAPITAL,
        actualTotalValue: totalValue,
        currentProfit,
        lockedProfits: totalLocked,
        tradingCapital: cash,
        marketsOpen: marketStatus.activeMarkets,
        totalBought,
        totalSold,
        successful: successful.length,
        failed: failed.length,
      },
      debug: {
        log: getDebugLog().slice(0, 20),
        duration,
      },
    });
    
  } catch (error) {
    console.error('[APEX] Error:', error);
    return NextResponse.json({
      error: 'Autonomous scan failed',
      details: String(error),
      debug: getDebugLog().slice(0, 10),
    }, { status: 500 });
  }
}

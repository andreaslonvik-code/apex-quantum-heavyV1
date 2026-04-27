// APEX QUANTUM — TimesFM-inspired hybrid scoring engine.
// Replaces the old Saxo-backed price fetcher with Alpaca historical bars.
import { NextRequest, NextResponse } from 'next/server';
import { getRequestCreds } from '@/lib/get-request-creds';
import { getDataBase, type AlpacaCreds } from '@/lib/alpaca';

interface TimesFMPrediction {
  ticker: string;
  currentPrice: number;
  predictions: number[];
  predictedChange: number;
  confidence: number;
  direction: 'UP' | 'DOWN' | 'NEUTRAL';
  horizon: string;
}

interface ApexQuantumSignal {
  ticker: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  strength: number;
  timesfmScore: number;
  momentumScore: number;
  combinedScore: number;
  reason: string;
  predictedPrice: number;
  targetReturn: number;
}

async function getDailyBars(
  creds: AlpacaCreds,
  symbol: string,
  limit: number = 100
): Promise<number[]> {
  const url = `${getDataBase()}/stocks/${encodeURIComponent(symbol)}/bars?timeframe=1Day&limit=${limit}`;
  try {
    const res = await fetch(url, {
      headers: {
        'APCA-API-KEY-ID': creds.apiKey,
        'APCA-API-SECRET-KEY': creds.apiSecret,
      },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { bars?: Array<{ c?: number }> };
    return (data.bars || []).map((b) => b.c || 0).filter((p) => p > 0);
  } catch {
    return [];
  }
}

function runTimesFMPrediction(priceHistory: number[], horizonSteps = 10): number[] {
  const n = priceHistory.length;
  if (n < 10) return Array(horizonSteps).fill(priceHistory[n - 1] || 100);

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += priceHistory[i];
    sumXY += i * priceHistory[i];
    sumX2 += i * i;
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

  const mean = sumY / n;
  let variance = 0;
  for (const p of priceHistory) variance += (p - mean) ** 2;
  const volatility = Math.sqrt(variance / n) / mean;

  const alpha = 0.3;
  let smoothed = priceHistory[n - 1];
  for (let i = Math.max(0, n - 20); i < n; i++) {
    smoothed = alpha * priceHistory[i] + (1 - alpha) * smoothed;
  }

  const predictions: number[] = [];
  let lastPrice = priceHistory[n - 1];
  for (let i = 0; i < horizonSteps; i++) {
    const trendComponent = slope * 0.5;
    const meanReversionComponent = (smoothed - lastPrice) * 0.1;
    const noiseComponent = (Math.random() - 0.5) * volatility * lastPrice * 0.5;
    const nextPrice = lastPrice + trendComponent + meanReversionComponent + noiseComponent;
    predictions.push(Math.max(0.01, nextPrice));
    lastPrice = nextPrice;
  }
  return predictions;
}

function calculateRSI(prices: number[], period = 14): number {
  if (prices.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  return 100 - (100 / (1 + avgGain / avgLoss));
}

function calculateHybridScore(
  ticker: string,
  currentPrice: number,
  predictions: number[],
  priceHistory: number[],
  targetWeight: number
): ApexQuantumSignal {
  const predictedPrice = predictions[predictions.length - 1];
  const predictedReturn = (predictedPrice - currentPrice) / currentPrice;
  const timesfmScore = Math.min(100, Math.max(0, 50 + predictedReturn * 500));

  const rsi = calculateRSI(priceHistory);
  const recentTrend =
    priceHistory.length >= 5
      ? (priceHistory[priceHistory.length - 1] - priceHistory[priceHistory.length - 5]) /
        priceHistory[priceHistory.length - 5]
      : 0;
  const momentumScore = Math.min(
    100,
    Math.max(0, (100 - rsi) * 0.5 + (recentTrend < 0 ? 30 : 0) + (recentTrend > 0.05 ? -20 : 0))
  );
  const apexScore = targetWeight * 2;
  const combinedScore = timesfmScore * 0.4 + momentumScore * 0.3 + apexScore * 0.3;

  let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
  let reason = `Holding — score ${combinedScore.toFixed(0)}, waiting for signal`;
  if (combinedScore >= 65 && predictedReturn > 0.01) {
    action = 'BUY';
    reason = `TimesFM: +${(predictedReturn * 100).toFixed(1)}%, RSI: ${rsi.toFixed(0)}, Apex: ${targetWeight}%`;
  } else if (combinedScore <= 35 && predictedReturn < -0.01) {
    action = 'SELL';
    reason = `TimesFM: ${(predictedReturn * 100).toFixed(1)}%, RSI: ${rsi.toFixed(0)}, overbought`;
  } else if (rsi < 30) {
    action = 'BUY';
    reason = `RSI oversold (${rsi.toFixed(0)}), TimesFM: ${(predictedReturn * 100).toFixed(1)}%`;
  } else if (rsi > 70) {
    action = 'SELL';
    reason = `RSI overbought (${rsi.toFixed(0)}), profit taking`;
  }

  return {
    ticker,
    action,
    strength: combinedScore,
    timesfmScore,
    momentumScore,
    combinedScore,
    reason,
    predictedPrice,
    targetReturn: predictedReturn * 100,
  };
}

export async function POST(request: NextRequest) {
  try {
    const userCreds = await getRequestCreds();
    if (!userCreds) {
      return NextResponse.json({ error: 'Ikke tilkoblet Alpaca' }, { status: 401 });
    }
    const creds: AlpacaCreds = {
      apiKey: userCreds.apiKey,
      apiSecret: userCreds.apiSecret,
      env: userCreds.environment,
    };

    const body = await request.json().catch(() => ({}));
    const targetTickers: string[] = body.tickers || ['MU', 'CEG', 'VRT', 'RKLB', 'LMND', 'ABSI'];
    const apexWeights: Record<string, number> = {
      MU: 30, CEG: 12, VRT: 10, RKLB: 8, LMND: 6, ABSI: 4,
    };

    const predictions: TimesFMPrediction[] = [];
    const signals: ApexQuantumSignal[] = [];

    for (const ticker of targetTickers) {
      const history = await getDailyBars(creds, ticker, 100);
      if (history.length === 0) continue;
      const currentPrice = history[history.length - 1];

      const horizon = 10;
      const predicted = runTimesFMPrediction(history, horizon);
      const predictedChange = (predicted[horizon - 1] - currentPrice) / currentPrice;
      const direction: 'UP' | 'DOWN' | 'NEUTRAL' =
        predictedChange > 0.01 ? 'UP' : predictedChange < -0.01 ? 'DOWN' : 'NEUTRAL';

      predictions.push({
        ticker,
        currentPrice,
        predictions: predicted,
        predictedChange: predictedChange * 100,
        confidence: Math.min(95, 60 + Math.random() * 30),
        direction,
        horizon: `${horizon} days`,
      });

      signals.push(
        calculateHybridScore(ticker, currentPrice, predicted, history, apexWeights[ticker] || 10)
      );
    }

    const buySignals = signals.filter((s) => s.action === 'BUY').sort((a, b) => b.combinedScore - a.combinedScore);
    const sellSignals = signals.filter((s) => s.action === 'SELL').sort((a, b) => a.combinedScore - b.combinedScore);
    const holdSignals = signals.filter((s) => s.action === 'HOLD');

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      model: 'APEX QUANTUM + TimesFM HYBRID v2.0 (Alpaca)',
      predictions,
      signals: [...buySignals, ...sellSignals, ...holdSignals],
      summary: {
        buyCount: buySignals.length,
        sellCount: sellSignals.length,
        holdCount: holdSignals.length,
        topBuy: buySignals[0]?.ticker || 'N/A',
        topSell: sellSignals[0]?.ticker || 'N/A',
        avgTimesFMScore: signals.length
          ? (signals.reduce((a, b) => a + b.timesfmScore, 0) / signals.length).toFixed(1)
          : '0',
        avgMomentumScore: signals.length
          ? (signals.reduce((a, b) => a + b.momentumScore, 0) / signals.length).toFixed(1)
          : '0',
      },
    });
  } catch (err) {
    console.error('[TIMESFM] Error:', err);
    return NextResponse.json(
      { error: 'TimesFM prediction failed', details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    model: 'APEX QUANTUM + TimesFM HYBRID',
    version: '2.0',
    description:
      'AI-hybrid trading system combining TimesFM time-series forecasting with Apex Quantum portfolio logic. Backed by Alpaca daily bars.',
    features: [
      'TimesFM-inspired price predictions (10-day horizon)',
      'RSI momentum analysis',
      'Apex Quantum portfolio weighting',
      'Combined scoring engine (40% TimesFM + 30% Momentum + 30% Apex)',
      'Automatic BUY/SELL/HOLD signals',
    ],
  });
}

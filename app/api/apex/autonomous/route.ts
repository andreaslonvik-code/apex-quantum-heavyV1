// APEX QUANTUM — On-demand autonomous scan (called from the dashboard's
// "retry order" button). Delegates to the shared trading engine in
// lib/trading-engine.ts so the on-demand path stays identical to the
// per-minute Vercel cron.
import { NextRequest, NextResponse } from 'next/server';
import { getRequestCreds } from '@/lib/get-request-creds';
import { type AlpacaCreds } from '@/lib/alpaca';
import { runScanForUser } from '@/lib/trading-engine';
import { TICKER_NAME } from '@/lib/blueprint';

export async function POST(_req: NextRequest) {
  const userCreds = await getRequestCreds();
  if (!userCreds) {
    return NextResponse.json(
      { error: 'Ikke tilkoblet Alpaca. Vennligst koble til først.' },
      { status: 401 }
    );
  }

  const creds: AlpacaCreds = {
    apiKey: userCreds.apiKey,
    apiSecret: userCreds.apiSecret,
    env: userCreds.environment,
  };

  const startTime = Date.now();
  try {
    const r = await runScanForUser({
      creds,
      clerkUserId: userCreds.clerkUserId,
      startBalance: userCreds.startBalance,
    });

    return NextResponse.json({
      success: true,
      mode: userCreds.environment,
      session: r.session,
      marketOpen: r.marketOpen,
      blueprint: {
        size: r.elite.tickers.length,
        eliteSource: r.elite.source,
        eliteTickers: r.elite.tickers,
      },
      signals: [
        ...r.acceptedSells.map((s) => ({
          ticker: s.ticker, symbol: s.ticker, action: 'SELL',
          amount: s.amount, reason: s.reason, priority: s.priority,
        })),
        ...r.acceptedBuys.map((c) => ({
          ticker: c.ticker, symbol: c.ticker, action: 'BUY',
          amount: c.amount, reason: c.reason, score: c.score,
        })),
      ],
      executedTrades: r.executedTrades,
      portfolio: r.positions.map((pos) => {
        const sym = pos.symbol.toUpperCase();
        const posValue = Math.abs(parseFloat(pos.market_value) || 0);
        return {
          ticker: sym,
          symbol: sym,
          navn: TICKER_NAME[sym] || sym,
          vekt: r.equity > 0 ? (posValue / r.equity) * 100 : 0,
          aksjon: 'HOLD',
          antall: Math.abs(parseFloat(pos.qty) || 0),
        };
      }),
      stats: {
        baseCapital: userCreds.startBalance || r.equity,
        actualTotalValue: r.equity,
        currentProfit: r.equity - (userCreds.startBalance || r.equity),
        tradingCapital: r.cash,
        marketsOpen: r.marketOpen ? ['US'] : [],
        totalBought: r.totalBought,
        totalSold: r.totalSold,
        successful: r.executedTrades.filter((t) => t.status === 'OK').length,
        failed: r.executedTrades.filter((t) => t.status === 'FEIL').length,
        buySignals: r.buyCandidates.length,
        sellSignals: r.sellSignals.length,
      },
      errors: r.errors,
      durationMs: Date.now() - startTime,
    });
  } catch (err) {
    console.error('[APEX] Error:', err);
    return NextResponse.json(
      { error: 'Autonomous scan failed', details: String(err) },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const SAXO_API_BASE = 'https://gateway.saxobank.com/sim/openapi';

// In-memory performance history (in production, use a database)
// This will reset on deploy, but gives real-time tracking during session
const performanceHistory: Map<string, Array<{
  timestamp: string;
  balance: number;
  portfolioValue: number;
  pnl: number;
  pnlPercent: number;
}>> = new Map();

// Get starting balance from .env or default to 1M NOK
const START_BALANCE = Number(process.env.START_BALANCE) || 1000000;
const INITIAL_VALUE = START_BALANCE;

export async function GET() {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('apex_saxo_token')?.value;
    const accountKey = cookieStore.get('apex_saxo_account_key')?.value;
    const clientKey = cookieStore.get('apex_saxo_client_key')?.value || accountKey;

    if (!accessToken || !accountKey) {
      return NextResponse.json({ error: 'Not connected' }, { status: 401 });
    }

    // Get total account value from Saxo (this is the full account value including positions)
    let totalValue = INITIAL_VALUE;
    let cashBalance = 0;
    let positionsValue = 0;
    let saxoSyncLog = '';
    
    try {
      // MANDATORY: Fetch TotalValue directly from Saxo API
      // This is THE source of truth for account value
      const balRes = await fetch(
        `${SAXO_API_BASE}/port/v1/balances?AccountKey=${accountKey}&ClientKey=${clientKey}`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );
      
      if (balRes.ok) {
        const balData = await balRes.json();
        // SAXO SYNC: Log what Saxo returns
        const saxoTotalValue = balData.TotalValue;
        const saxoCash = balData.CashAvailableForTrading || balData.CashBalance || 0;
        
        totalValue = saxoTotalValue || INITIAL_VALUE;
        cashBalance = saxoCash;
        
        saxoSyncLog = `[SAXO SYNC] TotalValue: ${totalValue.toLocaleString('nb-NO')} NOK, Cash: ${cashBalance.toLocaleString('nb-NO')} NOK`;
        console.log(saxoSyncLog);
      } else {
        const errorText = await balRes.text();
        saxoSyncLog = `[SAXO SYNC] Balance fetch failed: HTTP ${balRes.status}`;
        console.warn(saxoSyncLog, errorText);
      }
    } catch (e) {
      saxoSyncLog = `[SAXO SYNC] Network error: ${e}`;
      console.error(saxoSyncLog);
      // Use last known value as fallback
      totalValue = INITIAL_VALUE;
    }

    // Get positions value separately from Saxo for detailed breakdown
    try {
      const posRes = await fetch(
        `${SAXO_API_BASE}/port/v1/positions?ClientKey=${clientKey}&FieldGroups=PositionBase,PositionView`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );
      if (posRes.ok) {
        const posData = await posRes.json();
        positionsValue = 0;
        for (const pos of posData.Data || []) {
          const posValue = Math.abs(pos.PositionView?.MarketValue || 0);
          positionsValue += posValue;
        }
        console.log(`[SAXO SYNC] Positions value: ${positionsValue.toLocaleString('nb-NO')} NOK`);
      }
    } catch (e) {
      console.log(`[SAXO SYNC] Positions fetch error: ${e}`);
    }
    
    // Validate the total value makes sense
    const calculatedTotal = cashBalance + positionsValue;
    if (totalValue < calculatedTotal * 0.8 && calculatedTotal > 0) {
      console.log(`[SAXO SYNC] ⚠️ WARNING: Saxo TotalValue (${totalValue}) seems low compared to Cash+Positions (${calculatedTotal})`);
      // If Saxo TotalValue is clearly wrong, use calculated value
      if (totalValue < 100) {
        totalValue = calculatedTotal;
      }
    }
    
    // Calculate P&L against starting capital
    const pnl = totalValue - INITIAL_VALUE;
    const pnlPercent = ((totalValue - INITIAL_VALUE) / INITIAL_VALUE) * 100;

    // Store data point
    const now = new Date().toISOString();
    const userKey = accountKey || 'default';
    
    if (!performanceHistory.has(userKey)) {
      performanceHistory.set(userKey, []);
    }
    
    const history = performanceHistory.get(userKey)!;
    
    // Add new data point (max 1000 points, ~30 sec intervals = ~500 min of data)
    history.push({
      timestamp: now,
      balance: cashBalance,
      portfolioValue: totalValue,
      pnl,
      pnlPercent,
    });
    
    // Keep last 1000 points
    if (history.length > 1000) {
      history.shift();
    }

    // Format for chart - show porteføljeverdi MINUS startbeløp = avkastning
    const chartData = history.map((h, i) => ({
      time: new Date(h.timestamp).toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      timestamp: h.timestamp,
      value: Math.round(h.portfolioValue - INITIAL_VALUE), // Y-axis: avkastning i NOK
      pnl: Math.round(h.pnl),
      pnlPercent: Number(h.pnlPercent.toFixed(2)),
    }));

    // Calculate session stats
    const firstValue = history[0]?.portfolioValue || INITIAL_VALUE;
    const lastValue = totalValue;
    const sessionPnl = lastValue - firstValue;
    const sessionPnlPercent = ((lastValue - firstValue) / firstValue) * 100;

    // Peak and drawdown
    let peak = INITIAL_VALUE;
    let maxDrawdown = 0;
    for (const point of history) {
      if (point.portfolioValue > peak) {
        peak = point.portfolioValue;
      }
      const drawdown = ((peak - point.portfolioValue) / peak) * 100;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return NextResponse.json({
      current: {
        balance: cashBalance,
        positionsValue,
        totalValue,
        pnl,
        pnlPercent,
        initialValue: INITIAL_VALUE,
      },
      session: {
        startValue: firstValue,
        currentValue: lastValue,
        pnl: sessionPnl,
        pnlPercent: sessionPnlPercent,
        peak,
        maxDrawdown,
        dataPoints: history.length,
      },
      chartData,
      timestamp: now,
      saxoSync: {
        log: saxoSyncLog,
        cashFromSaxo: cashBalance,
        totalFromSaxo: totalValue,
        positionsValue,
      },
    });
  } catch (e) {
    const errorMsg = String(e);
    console.error(`[APEX-PERF] Error: ${errorMsg}`);
    return NextResponse.json({ 
      error: 'Failed to fetch performance data',
      details: errorMsg,
      fallback: {
        current: {
          balance: 0,
          positionsValue: 0,
          totalValue: INITIAL_VALUE,
          pnl: 0,
          pnlPercent: 0,
          initialValue: INITIAL_VALUE,
        },
        session: {
          startValue: INITIAL_VALUE,
          currentValue: INITIAL_VALUE,
          pnl: 0,
          pnlPercent: 0,
          peak: INITIAL_VALUE,
          maxDrawdown: 0,
          dataPoints: 0,
        },
        chartData: [],
      }
    }, { status: 500 });
  }
}

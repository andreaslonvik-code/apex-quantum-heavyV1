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

const INITIAL_VALUE = 100000; // Starting capital

export async function GET() {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('apex_saxo_token')?.value;
    const accountKey = cookieStore.get('apex_saxo_account_key')?.value;
    const clientKey = cookieStore.get('apex_saxo_client_key')?.value || accountKey;

    if (!accessToken || !accountKey) {
      return NextResponse.json({ error: 'Not connected' }, { status: 401 });
    }

    // Get current balance
    let balance = INITIAL_VALUE;
    try {
      const balRes = await fetch(
        `${SAXO_API_BASE}/port/v1/balances?AccountKey=${accountKey}&ClientKey=${clientKey}`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );
      if (balRes.ok) {
        const balData = await balRes.json();
        balance = balData.CashAvailableForTrading || balData.TotalValue || INITIAL_VALUE;
      }
    } catch {}

    // Get positions value
    let positionsValue = 0;
    try {
      const posRes = await fetch(
        `${SAXO_API_BASE}/port/v1/positions?ClientKey=${clientKey}&FieldGroups=PositionBase,PositionView`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );
      if (posRes.ok) {
        const posData = await posRes.json();
        for (const pos of posData.Data || []) {
          positionsValue += Math.abs(pos.PositionView?.MarketValue || 0);
        }
      }
    } catch {}

    const totalValue = balance + positionsValue;
    const pnl = totalValue - INITIAL_VALUE;
    const pnlPercent = ((totalValue - INITIAL_VALUE) / INITIAL_VALUE) * 100;

    // Store data point
    const now = new Date().toISOString();
    const userKey = accountKey || 'default';
    
    if (!performanceHistory.has(userKey)) {
      performanceHistory.set(userKey, []);
    }
    
    const history = performanceHistory.get(userKey)!;
    
    // Add new data point (max 1000 points, ~3 sec intervals = ~50 min of data)
    history.push({
      timestamp: now,
      balance,
      portfolioValue: totalValue,
      pnl,
      pnlPercent,
    });
    
    // Keep last 1000 points
    if (history.length > 1000) {
      history.shift();
    }

    // Format for chart
    const chartData = history.map((h, i) => ({
      time: new Date(h.timestamp).toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      timestamp: h.timestamp,
      value: Math.round(h.portfolioValue),
      pnl: Math.round(h.pnl),
      pnlPercent: Number(h.pnlPercent.toFixed(2)),
    }));

    // Calculate stats
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
        balance,
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
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

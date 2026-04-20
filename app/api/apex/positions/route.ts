import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const SAXO_API_BASE = 'https://gateway.saxobank.com/sim/openapi';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('apex_saxo_token')?.value;
    const clientKey = cookieStore.get('apex_saxo_client_key')?.value;
    const accountKey = cookieStore.get('apex_saxo_account_key')?.value;

    if (!accessToken || !clientKey) {
      return NextResponse.json({ error: 'Not connected' }, { status: 401 });
    }

    // MANDATORY: Fetch positions directly from Saxo API
    // GET /port/v1/positions - Returns all open positions
    const posRes = await fetch(
      `${SAXO_API_BASE}/port/v1/positions?ClientKey=${clientKey}&FieldGroups=PositionBase,PositionView,DisplayAndFormat`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    if (!posRes.ok) {
      const errorText = await posRes.text();
      console.log(`[POSITIONS] Saxo API error: HTTP ${posRes.status}`, errorText);
      return NextResponse.json({ error: 'Failed to fetch positions', details: errorText }, { status: posRes.status });
    }

    const posData = await posRes.json();
    const positions = (posData.Data || []).map((pos: any) => {
      const ticker = pos.DisplayAndFormat?.Symbol?.split(':')[0] || 'UNKNOWN';
      const amount = Math.abs(pos.PositionBase?.Amount || 0);
      const avgPrice = pos.PositionBase?.AverageOpenPrice || 0;
      const marketValue = Math.abs(pos.PositionView?.MarketValue || 0);
      const pnl = pos.PositionView?.ProfitLossOnTrade || 0;
      const pnlPercent = pos.PositionView?.ProfitLossOnTradeInPercentage || 0;
      const currentPrice = amount > 0 ? marketValue / amount : avgPrice;

      return {
        ticker,
        navn: pos.DisplayAndFormat?.Description || '',
        antall: amount,
        vekt: 0, // Will be calculated based on portfolio value
        aksjon: '',
        avgPrice,
        currentPrice,
        marketValue,
        pnl,
        pnlPercent,
        uic: pos.PositionBase?.Uic || 0,
        exchange: pos.DisplayAndFormat?.Symbol?.split(':')[1]?.toUpperCase() || 'UNKNOWN',
      };
    });

    // Get portfolio value for weight calculation
    let totalValue = 0;
    try {
      const balRes = await fetch(
        `${SAXO_API_BASE}/port/v1/balances?AccountKey=${accountKey}&ClientKey=${clientKey}`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );
      if (balRes.ok) {
        const balData = await balRes.json();
        totalValue = balData.TotalValue || 1000000;
      }
    } catch (e) {
      console.log(`[POSITIONS] Balance fetch failed:`, e);
    }

    // Calculate weights
    const positionsWithWeights = positions.map((pos: any) => ({
      ...pos,
      vekt: totalValue > 0 ? (pos.marketValue / totalValue) * 100 : 0,
    }));

    console.log(`[POSITIONS] Fetched ${positionsWithWeights.length} open positions from Saxo`);

    return NextResponse.json({
      success: true,
      positions: positionsWithWeights,
      totalValue,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.error(`[POSITIONS] Error:`, e);
    return NextResponse.json(
      { error: 'Failed to fetch positions', details: String(e) },
      { status: 500 }
    );
  }
}

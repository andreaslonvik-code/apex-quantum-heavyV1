import { NextResponse } from 'next/server';
import { getRequestCreds } from '@/lib/get-request-creds';
import { getAccount, getPositions } from '@/lib/alpaca';

export async function GET() {
  try {
    const userCreds = await getRequestCreds();
    if (!userCreds) {
      return NextResponse.json({ error: 'Not connected' }, { status: 401 });
    }
    const creds = {
      apiKey: userCreds.apiKey,
      apiSecret: userCreds.apiSecret,
      env: userCreds.environment,
    };

    const [positionsRes, accountRes] = await Promise.all([
      getPositions(creds),
      getAccount(creds),
    ]);

    if (!positionsRes.success) {
      return NextResponse.json(
        { error: 'Failed to fetch positions', details: positionsRes.error },
        { status: positionsRes.status || 500 }
      );
    }

    const totalValue = accountRes.success
      ? parseFloat(accountRes.data.equity) || parseFloat(accountRes.data.portfolio_value) || 0
      : 0;

    const positions = positionsRes.data.map((pos) => {
      const qty = Math.abs(parseFloat(pos.qty) || 0);
      const avgPrice = parseFloat(pos.avg_entry_price) || 0;
      const marketValue = Math.abs(parseFloat(pos.market_value) || 0);
      const currentPrice = parseFloat(pos.current_price) || (qty > 0 ? marketValue / qty : avgPrice);
      const pnl = parseFloat(pos.unrealized_pl) || 0;
      const pnlPercent = (parseFloat(pos.unrealized_plpc) || 0) * 100;

      return {
        ticker: pos.symbol,
        symbol: pos.symbol,
        navn: pos.symbol,
        antall: qty,
        vekt: totalValue > 0 ? (marketValue / totalValue) * 100 : 0,
        aksjon: '',
        avgPrice,
        currentPrice,
        marketValue,
        pnl,
        pnlPercent,
        exchange: pos.exchange,
      };
    });

    return NextResponse.json({
      success: true,
      positions,
      totalValue,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[POSITIONS] Error:', e);
    return NextResponse.json(
      { error: 'Failed to fetch positions', details: String(e) },
      { status: 500 }
    );
  }
}

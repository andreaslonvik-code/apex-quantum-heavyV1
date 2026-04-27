import { NextResponse } from 'next/server';
import { getRequestCreds } from '@/lib/get-request-creds';
import { getPositions } from '@/lib/alpaca';

export async function GET() {
  try {
    const userCreds = await getRequestCreds();
    if (!userCreds) {
      return NextResponse.json(
        { error: 'Ikke tilkoblet Alpaca', positions: [] },
        { status: 401 }
      );
    }

    const result = await getPositions({
      apiKey: userCreds.apiKey,
      apiSecret: userCreds.apiSecret,
      env: userCreds.environment,
    });

    if (!result.success) {
      return NextResponse.json({
        positions: [],
        message: result.error || 'Ingen eksisterende posisjoner',
      });
    }

    const positions = result.data.map((p) => ({
      ticker: p.symbol.toUpperCase(),
      amount: parseFloat(p.qty) || 0,
      marketValue: parseFloat(p.market_value) || 0,
      currentPrice: parseFloat(p.current_price) || 0,
      assetType: p.asset_class,
    }));

    return NextResponse.json({
      positions,
      totalValue: positions.reduce((s, p) => s + Math.abs(p.marketValue), 0),
      positionCount: positions.length,
    });
  } catch (err) {
    console.error('[get-positions] Error:', err);
    return NextResponse.json(
      { error: 'Feil ved henting av posisjoner', positions: [] },
      { status: 500 }
    );
  }
}

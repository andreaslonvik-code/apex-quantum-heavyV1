import { NextResponse } from 'next/server';
import { getRequestCreds } from '@/lib/get-request-creds';
import { getSaxoBase } from '@/lib/saxo';

interface Position {
  ticker: string;
  amount: number;
  marketValue: number;
  currentPrice: number;
  assetType: string;
}

export async function GET() {
  try {
    const creds = await getRequestCreds();
    if (!creds) {
      return NextResponse.json({
        error: 'Ikke tilkoblet Saxo',
        positions: [],
      }, { status: 401 });
    }
    const { accessToken, clientKey, environment } = creds;
    const SAXO_API_BASE = getSaxoBase(environment);

    // Get positions from Saxo
    const response = await fetch(
      `${SAXO_API_BASE}/port/v1/positions?ClientKey=${clientKey}`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    if (!response.ok) {
      console.log('[APEX] Ingen posisjoner eller feil ved henting');
      return NextResponse.json({
        positions: [],
        message: 'Ingen eksisterende posisjoner',
      });
    }

    const data = await response.json();
    const positions: Position[] = [];

    for (const pos of data.Data || []) {
      const ticker = pos.DisplayAndFormat?.Symbol?.split(':')[0] || 
                     pos.PositionBase?.Uic?.toString() || '';
      
      positions.push({
        ticker: ticker.toUpperCase(),
        amount: pos.PositionBase?.Amount || 0,
        marketValue: pos.PositionView?.MarketValue || 0,
        currentPrice: pos.PositionView?.CurrentPrice || 0,
        assetType: pos.PositionBase?.AssetType || 'Stock',
      });
    }

    console.log(`[APEX] Hentet ${positions.length} posisjoner fra Saxo`);

    return NextResponse.json({
      positions,
      totalValue: positions.reduce((sum, p) => sum + p.marketValue, 0),
      positionCount: positions.length,
    });

  } catch (error) {
    console.error('[APEX] Feil ved henting av posisjoner:', error);
    return NextResponse.json({
      error: 'Feil ved henting av posisjoner',
      positions: [],
    }, { status: 500 });
  }
}

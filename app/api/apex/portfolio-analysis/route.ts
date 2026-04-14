import { streamText } from 'ai';
import { xai } from '@ai-sdk/xai';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const SAXO_API_BASE = 'https://gateway.saxobank.com/sim/openapi';

async function getPositions(accessToken: string, clientKey: string) {
  const res = await fetch(
    `${SAXO_API_BASE}/port/v1/positions?ClientKey=${clientKey}&FieldGroups=PositionBase,PositionView,DisplayAndFormat`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  
  if (!res.ok) return [];
  
  const data = await res.json();
  return data.Data || [];
}

async function getBalance(accessToken: string, accountKey: string) {
  const res = await fetch(
    `${SAXO_API_BASE}/port/v1/balances?AccountKey=${accountKey}&FieldGroups=CalculateCashForTrading`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  
  if (!res.ok) return null;
  return res.json();
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('saxo_access_token')?.value;
    const accountKey = cookieStore.get('saxo_account_key')?.value;
    const clientKey = cookieStore.get('saxo_client_key')?.value || accountKey;

    if (!accessToken || !accountKey) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Fetch portfolio data from Saxo
    const [positions, balance] = await Promise.all([
      getPositions(accessToken, clientKey || accountKey),
      getBalance(accessToken, accountKey),
    ]);

    if (positions.length === 0) {
      return NextResponse.json({
        analysis: 'Ingen posisjoner i porteføljen. Start trading for å bygge opp porteføljen din.',
      });
    }

    // Format positions for Grok analysis
    const portfolioSummary = positions.map((pos: any) => {
      const pnl = pos.PositionView?.ProfitLossOnTrade || 0;
      const pnlPercent = pos.PositionView?.ProfitLossOnTradeInPercentage || 0;
      const currentPrice = pos.PositionView?.CurrentPrice || 0;
      const avgPrice = pos.PositionBase?.AverageOpenPrice || 0;
      
      return {
        ticker: pos.DisplayAndFormat?.Symbol || pos.PositionBase?.AssetType,
        name: pos.DisplayAndFormat?.Description || 'Unknown',
        amount: pos.PositionBase?.Amount || 0,
        avgPrice: avgPrice,
        currentPrice: currentPrice,
        marketValue: pos.PositionView?.MarketValue || 0,
        pnl: pnl,
        pnlPercent: pnlPercent,
        currency: pos.DisplayAndFormat?.Currency || 'USD',
      };
    });

    const totalValue = balance?.TotalValue || 0;
    const cashBalance = balance?.CashBalance || 0;
    const totalPnL = portfolioSummary.reduce((sum: number, p: any) => sum + p.pnl, 0);

    const prompt = `Du er APEX QUANTUM, en avansert AI trading-assistent. Analyser denne porteføljen og gi en kortfattet rapport på norsk.

PORTEFØLJE DATA:
- Total verdi: ${totalValue.toLocaleString('no-NO')} NOK
- Kontanter: ${cashBalance.toLocaleString('no-NO')} NOK
- Total urealisert P/L: ${totalPnL.toLocaleString('no-NO')} NOK

POSISJONER:
${portfolioSummary.map((p: any) => 
  `- ${p.ticker} (${p.name}): ${p.amount} aksjer @ ${p.avgPrice.toFixed(2)} avg → ${p.currentPrice.toFixed(2)} nå | P/L: ${p.pnl >= 0 ? '+' : ''}${p.pnl.toFixed(0)} (${p.pnlPercent >= 0 ? '+' : ''}${p.pnlPercent.toFixed(1)}%)`
).join('\n')}

Gi en analyse som inkluderer:
1. PORTEFØLJEOVERSIKT: Kort oppsummering av total ytelse
2. STERKESTE POSISJONER: Hvilke aksjer presterer best og hvorfor
3. SVAKESTE POSISJONER: Hvilke aksjer underpresterer og anbefalt handling
4. RISIKOVURDERING: Kort vurdering av diversifisering og risikoeksponering
5. ANBEFALING: 1-2 konkrete handlinger for å optimalisere porteføljen

Hold analysen konsis men innsiktsfull. Maks 300 ord.`;

    const result = streamText({
      model: xai('grok-3-fast'),
      prompt: prompt,
      system: 'Du er APEX QUANTUM, en profesjonell AI trading-assistent som gir presise og handlingsrettede porteføljeanalyser på norsk. Bruk finansterminologi men hold det forståelig.',
    });

    return result.toTextStreamResponse();

  } catch (error) {
    console.error('[APEX] Portfolio analysis error:', error);
    return NextResponse.json(
      { error: 'Kunne ikke generere porteføljeanalyse' },
      { status: 500 }
    );
  }
}

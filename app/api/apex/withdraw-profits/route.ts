// APEX QUANTUM — Withdraw Profits (Alpaca).
// Sells enough open positions to extract profit above the user's startBalance.
import { NextResponse } from 'next/server';
import { getRequestCreds } from '@/lib/get-request-creds';
import { getAccount, getPositions, placeOrder, type AlpacaCreds } from '@/lib/alpaca';

export async function POST() {
  const userCreds = await getRequestCreds();
  if (!userCreds) {
    return NextResponse.json({ error: 'Ikke tilkoblet Alpaca' }, { status: 401 });
  }

  const creds: AlpacaCreds = {
    apiKey: userCreds.apiKey,
    apiSecret: userCreds.apiSecret,
    env: userCreds.environment,
  };

  try {
    const accountRes = await getAccount(creds);
    if (!accountRes.success) {
      return NextResponse.json({ error: accountRes.error }, { status: 500 });
    }

    const totalValue = parseFloat(accountRes.data.equity) || 0;
    const baseCapital = userCreds.startBalance || totalValue;
    const profit = totalValue - baseCapital;

    if (profit <= 0) {
      return NextResponse.json({
        success: false,
        message:
          'Ingen avkastning å hente ut. Kontoverdi er under eller lik startkapital.',
        currentValue: totalValue,
        startingCapital: baseCapital,
        profit,
      });
    }

    const positionsRes = await getPositions(creds);
    if (!positionsRes.success) {
      return NextResponse.json(
        { error: 'Kunne ikke hente posisjoner', details: positionsRes.error },
        { status: 500 }
      );
    }

    const positions = [...positionsRes.data].sort(
      (a, b) =>
        Math.abs(parseFloat(b.market_value) || 0) - Math.abs(parseFloat(a.market_value) || 0)
    );

    if (positions.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Ingen posisjoner å selge. Avkastningen er allerede i kontanter.',
        currentValue: totalValue,
        cashBalance: parseFloat(accountRes.data.cash) || 0,
        profit,
      });
    }

    let amountToSell = profit;
    const sellOrders: Array<{
      symbol: string;
      amount: number;
      value: number;
      success: boolean;
      error?: string;
    }> = [];

    for (const pos of positions) {
      if (amountToSell <= 0) break;
      const positionValue = Math.abs(parseFloat(pos.market_value) || 0);
      const positionQty = Math.abs(parseFloat(pos.qty) || 0);
      const currentPrice = parseFloat(pos.current_price) || 0;
      if (positionQty <= 0 || currentPrice <= 0) continue;

      let sharesToSell: number;
      if (positionValue <= amountToSell) {
        sharesToSell = positionQty;
      } else {
        sharesToSell = Math.ceil(amountToSell / currentPrice);
        sharesToSell = Math.min(sharesToSell, positionQty);
      }

      if (sharesToSell <= 0) continue;
      const sellValue = sharesToSell * currentPrice;

      const orderRes = await placeOrder(creds, {
        symbol: pos.symbol,
        qty: sharesToSell,
        side: 'sell',
        type: 'market',
        time_in_force: 'day',
      });

      sellOrders.push({
        symbol: pos.symbol,
        amount: sharesToSell,
        value: sellValue,
        success: orderRes.success,
        error: orderRes.success ? undefined : orderRes.error,
      });

      if (orderRes.success) amountToSell -= sellValue;
    }

    const successful = sellOrders.filter((o) => o.success);
    const totalSold = successful.reduce((s, o) => s + o.value, 0);

    return NextResponse.json({
      success: true,
      message: `Hentet ut $${totalSold.toLocaleString('en-US', { maximumFractionDigits: 0 })} i avkastning`,
      profit,
      totalSold,
      remainingProfit: profit - totalSold,
      orders: sellOrders,
      newTargetCapital: baseCapital,
    });
  } catch (err) {
    console.error('[withdraw-profits] error:', err);
    return NextResponse.json(
      { error: 'Kunne ikke hente ut avkastning', details: String(err) },
      { status: 500 }
    );
  }
}

export async function GET() {
  const userCreds = await getRequestCreds();
  if (!userCreds) {
    return NextResponse.json({ error: 'Ikke tilkoblet' }, { status: 401 });
  }

  try {
    const result = await getAccount({
      apiKey: userCreds.apiKey,
      apiSecret: userCreds.apiSecret,
      env: userCreds.environment,
    });
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    const totalValue = parseFloat(result.data.equity) || 0;
    const baseCapital = userCreds.startBalance || totalValue;
    const profit = totalValue - baseCapital;

    return NextResponse.json({
      totalValue,
      startingCapital: baseCapital,
      profit,
      profitPercent: baseCapital > 0 ? (profit / baseCapital) * 100 : 0,
      canWithdraw: profit > 0,
    });
  } catch {
    return NextResponse.json({ error: 'Kunne ikke hente kontostatus' }, { status: 500 });
  }
}

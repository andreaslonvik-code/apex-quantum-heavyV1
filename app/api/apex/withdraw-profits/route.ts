// APEX QUANTUM - Withdraw Profits API
// Sells enough positions to extract profit and continue trading with starting capital
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSaxoBase } from '@/lib/saxo';

const BASE_TRADING_CAPITAL = 1000000; // 1 million NOK starting capital

interface Position {
  PositionId: string;
  PositionBase: {
    AccountId: string;
    Amount: number;
    AssetType: string;
    CanBeClosed: boolean;
  };
  PositionView: {
    CurrentPrice: number;
    MarketValue: number;
    ProfitLossOnTrade: number;
    Exposure: number;
  };
  DisplayAndFormat?: {
    Symbol: string;
    Description: string;
  };
}

async function getAccountValue(accessToken: string, accountKey: string): Promise<{
  totalValue: number;
  cashBalance: number;
  positionsValue: number;
}> {
  const SAXO_API_URL = getSaxoBase();
  const balanceRes = await fetch(
    `${SAXO_API_URL}/port/v1/balances?AccountKey=${accountKey}&ClientKey=${accountKey}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  
  if (!balanceRes.ok) {
    throw new Error('Failed to fetch balance');
  }
  
  const balance = await balanceRes.json();
  
  return {
    totalValue: balance.TotalValue || 0,
    cashBalance: balance.CashBalance || 0,
    positionsValue: balance.UnrealizedPositionsValue || 0,
  };
}

async function getPositions(accessToken: string, clientKey: string): Promise<Position[]> {
  const SAXO_API_URL = getSaxoBase();
  const res = await fetch(
    `${SAXO_API_URL}/port/v1/positions?ClientKey=${clientKey}&FieldGroups=PositionBase,PositionView,DisplayAndFormat`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  
  if (!res.ok) {
    return [];
  }
  
  const data = await res.json();
  return data.Data || [];
}

async function sellPosition(
  accessToken: string,
  accountKey: string,
  position: Position,
  amount: number
): Promise<{ success: boolean; orderId?: string; error?: string }> {
  const SAXO_API_URL = getSaxoBase();
  const orderData = {
    AccountKey: accountKey,
    Amount: amount,
    AssetType: position.PositionBase.AssetType,
    BuySell: 'Sell',
    OrderType: 'Market',
    OrderDuration: { DurationType: 'DayOrder' },
    Uic: parseInt(position.PositionId.split('-')[0]) || 0,
    ManualOrder: false,
  };
  
  // Get UIC from position
  const posRes = await fetch(
    `${SAXO_API_URL}/port/v1/positions/${position.PositionId}?ClientKey=${accountKey}&FieldGroups=PositionBase,PositionView,DisplayAndFormat,ExchangeInfo`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  
  if (posRes.ok) {
    const posData = await posRes.json();
    if (posData.PositionBase?.Uic) {
      orderData.Uic = posData.PositionBase.Uic;
    }
  }
  
  const orderRes = await fetch(`${SAXO_API_URL}/trade/v2/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(orderData),
  });
  
  if (!orderRes.ok) {
    const errorData = await orderRes.json().catch(() => ({}));
    return { 
      success: false, 
      error: errorData.ErrorInfo?.Message || `HTTP ${orderRes.status}` 
    };
  }
  
  const result = await orderRes.json();
  return { success: true, orderId: result.OrderId };
}

export async function POST(request: NextRequest) {
  console.log(`[APEX] ====== WITHDRAW PROFITS INITIATED ======`);
  
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('apex_saxo_token')?.value;
  const accountKey = cookieStore.get('apex_saxo_account_key')?.value;
  const clientKey = cookieStore.get('apex_saxo_client_key')?.value;

  if (!accessToken || !accountKey) {
    return NextResponse.json(
      { error: 'Ikke tilkoblet Saxo Bank' },
      { status: 401 }
    );
  }

  try {
    // Get current account value
    const accountValue = await getAccountValue(accessToken, accountKey);
    const profit = accountValue.totalValue - BASE_TRADING_CAPITAL;
    
    console.log(`[APEX] Total value: ${accountValue.totalValue.toLocaleString()} kr`);
    console.log(`[APEX] Starting capital: ${BASE_TRADING_CAPITAL.toLocaleString()} kr`);
    console.log(`[APEX] Profit to withdraw: ${profit.toLocaleString()} kr`);
    
    if (profit <= 0) {
      return NextResponse.json({
        success: false,
        message: 'Ingen avkastning å hente ut. Kontoverdi er under eller lik startkapital.',
        currentValue: accountValue.totalValue,
        startingCapital: BASE_TRADING_CAPITAL,
        profit: profit,
      });
    }
    
    // Get all positions
    const positions = await getPositions(accessToken, clientKey || accountKey);
    
    if (positions.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Ingen posisjoner å selge. Avkastningen er allerede i kontanter.',
        currentValue: accountValue.totalValue,
        cashBalance: accountValue.cashBalance,
        profit: profit,
      });
    }
    
    // Calculate how much we need to sell to extract profit
    let amountToSell = profit;
    const sellOrders: { symbol: string; amount: number; value: number; success: boolean; error?: string }[] = [];
    
    // Sort positions by value (largest first)
    const sortedPositions = positions.sort((a, b) => 
      (b.PositionView?.MarketValue || 0) - (a.PositionView?.MarketValue || 0)
    );
    
    for (const position of sortedPositions) {
      if (amountToSell <= 0) break;
      
      const positionValue = position.PositionView?.MarketValue || 0;
      const positionAmount = position.PositionBase?.Amount || 0;
      const currentPrice = position.PositionView?.CurrentPrice || 0;
      const symbol = position.DisplayAndFormat?.Symbol || 'Unknown';
      
      if (positionAmount <= 0 || currentPrice <= 0) continue;
      
      // Calculate how many shares to sell
      let sharesToSell: number;
      
      if (positionValue <= amountToSell) {
        // Sell entire position
        sharesToSell = positionAmount;
      } else {
        // Sell partial position
        sharesToSell = Math.ceil(amountToSell / currentPrice);
        sharesToSell = Math.min(sharesToSell, positionAmount);
      }
      
      if (sharesToSell > 0) {
        const sellValue = sharesToSell * currentPrice;
        
        console.log(`[APEX] Selling ${sharesToSell} ${symbol} @ ${currentPrice.toFixed(2)} = ${sellValue.toFixed(0)} kr`);
        
        const result = await sellPosition(accessToken, accountKey, position, sharesToSell);
        
        sellOrders.push({
          symbol,
          amount: sharesToSell,
          value: sellValue,
          success: result.success,
          error: result.error,
        });
        
        if (result.success) {
          amountToSell -= sellValue;
        }
      }
    }
    
    const successfulSells = sellOrders.filter(o => o.success);
    const totalSold = successfulSells.reduce((sum, o) => sum + o.value, 0);
    
    return NextResponse.json({
      success: true,
      message: `Hentet ut ${totalSold.toLocaleString()} kr i avkastning`,
      profit: profit,
      totalSold: totalSold,
      remainingProfit: profit - totalSold,
      orders: sellOrders,
      newTargetCapital: BASE_TRADING_CAPITAL,
    });
    
  } catch (error) {
    console.error('[APEX] Withdraw profits error:', error);
    return NextResponse.json(
      { error: 'Kunne ikke hente ut avkastning', details: String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('apex_saxo_token')?.value;
  const accountKey = cookieStore.get('apex_saxo_account_key')?.value;

  if (!accessToken || !accountKey) {
    return NextResponse.json({ error: 'Ikke tilkoblet' }, { status: 401 });
  }

  try {
    const accountValue = await getAccountValue(accessToken, accountKey);
    const profit = accountValue.totalValue - BASE_TRADING_CAPITAL;
    
    return NextResponse.json({
      totalValue: accountValue.totalValue,
      startingCapital: BASE_TRADING_CAPITAL,
      profit: profit,
      profitPercent: (profit / BASE_TRADING_CAPITAL) * 100,
      canWithdraw: profit > 0,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Kunne ikke hente kontostatus' },
      { status: 500 }
    );
  }
}

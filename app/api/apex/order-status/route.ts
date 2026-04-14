// APEX QUANTUM v6.2 - Order Status API
// Returns the last order status and order history for dashboard display

import { NextRequest, NextResponse } from 'next/server';
import { getOrderHistory, getLastOrderStatus, getSystemStatus, getDeadLetterQueue } from '@/lib/saxo';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const type = url.searchParams.get('type') || 'last';
    
    if (type === 'history') {
      // Return full order history
      const history = getOrderHistory();
      return NextResponse.json({
        success: true,
        orders: history,
        count: history.length,
      });
    }
    
    if (type === 'system') {
      // Return system status including circuit breaker
      const status = getSystemStatus();
      return NextResponse.json({
        success: true,
        ...status,
      });
    }
    
    if (type === 'deadletter') {
      // Return dead letter queue
      const dlq = getDeadLetterQueue();
      return NextResponse.json({
        success: true,
        deadLetterQueue: dlq,
        count: dlq.length,
      });
    }
    
    // Default: return last order status
    const lastOrder = getLastOrderStatus();
    const systemStatus = getSystemStatus();
    
    return NextResponse.json({
      success: true,
      lastOrder,
      circuitBreaker: systemStatus.circuitBreaker,
      orderHistoryCount: systemStatus.orderHistoryCount,
      deadLetterQueueCount: systemStatus.deadLetterQueueCount,
    });
    
  } catch (error) {
    console.error('[ORDER-STATUS] Error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

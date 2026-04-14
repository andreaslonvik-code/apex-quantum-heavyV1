// APEX QUANTUM v6.2 - Order Status API
import { NextResponse } from 'next/server';

// Simple in-memory storage for last order
let lastOrderResult: {
  success: boolean;
  orderId?: string;
  ticker?: string;
  action?: string;
  amount?: number;
  price?: number;
  error?: string;
  timestamp: string;
} | null = null;

export function setLastOrder(order: typeof lastOrderResult) {
  lastOrderResult = order;
}

export async function GET() {
  return NextResponse.json({
    success: true,
    lastOrder: lastOrderResult,
    timestamp: new Date().toISOString(),
  });
}

// APEX QUANTUM v6.2 - Manual Inngest Tick Trigger
// Allows manual triggering of trading tick for testing and emergency use

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const SAXO_SIM_BASE = 'https://gateway.saxobank.com/sim/openapi';

// In-memory tick tracking
let lastTickTime: number = 0;
let tickCount: number = 0;
let tickStatus: 'RUNNING' | 'PAUSED' | 'RATE_LIMITED' | 'ERROR' = 'PAUSED';
let lastError: string | null = null;
let grokRateLimited: boolean = false;
let grokRateLimitUntil: number = 0;

export interface TickStatus {
  lastTickTime: string;
  tickCount: number;
  status: typeof tickStatus;
  lastError: string | null;
  grokRateLimited: boolean;
  secondsSinceLastTick: number;
}

export async function GET() {
  const now = Date.now();
  const secondsSinceLastTick = lastTickTime ? Math.floor((now - lastTickTime) / 1000) : -1;
  
  // Check if Grok rate limit has expired
  if (grokRateLimited && now > grokRateLimitUntil) {
    grokRateLimited = false;
  }
  
  return NextResponse.json({
    lastTickTime: lastTickTime ? new Date(lastTickTime).toISOString() : null,
    tickCount,
    status: tickStatus,
    lastError,
    grokRateLimited,
    secondsSinceLastTick,
    grokRateLimitExpiresIn: grokRateLimited ? Math.floor((grokRateLimitUntil - now) / 1000) : 0,
  });
}

export async function POST() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('saxo_access_token')?.value;
  const accountKey = cookieStore.get('saxo_account_key')?.value;
  
  if (!accessToken || !accountKey) {
    return NextResponse.json({
      success: false,
      error: 'Not authenticated with Saxo',
    }, { status: 401 });
  }
  
  // Check Grok rate limit
  if (grokRateLimited && Date.now() < grokRateLimitUntil) {
    const waitSeconds = Math.ceil((grokRateLimitUntil - Date.now()) / 1000);
    return NextResponse.json({
      success: false,
      error: `Grok rate limited. Wait ${waitSeconds}s`,
      status: 'RATE_LIMITED',
    }, { status: 429 });
  }
  
  tickStatus = 'RUNNING';
  lastError = null;
  
  try {
    // Call the autonomous endpoint to execute a tick
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3000';
    
    const response = await fetch(`${baseUrl}/api/apex/autonomous`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `saxo_access_token=${accessToken}; saxo_account_key=${accountKey}`,
      },
    });
    
    const data = await response.json();
    
    // Check for Grok rate limit in response
    if (data.error?.includes('429') || data.error?.includes('rate limit')) {
      grokRateLimited = true;
      grokRateLimitUntil = Date.now() + 60000; // 60 second cooldown
      tickStatus = 'RATE_LIMITED';
      lastError = 'Grok API rate limited - waiting 60s';
      
      return NextResponse.json({
        success: false,
        error: lastError,
        status: tickStatus,
        nextTickIn: 60,
      });
    }
    
    lastTickTime = Date.now();
    tickCount++;
    tickStatus = 'RUNNING';
    
    return NextResponse.json({
      success: true,
      tickCount,
      lastTickTime: new Date(lastTickTime).toISOString(),
      data,
    });
    
  } catch (error) {
    tickStatus = 'ERROR';
    lastError = String(error);
    
    return NextResponse.json({
      success: false,
      error: lastError,
      status: tickStatus,
    }, { status: 500 });
  }
}

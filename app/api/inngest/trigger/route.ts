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
  
  // Check token status from env
  const envToken = process.env.SAXO_ACCESS_TOKEN;
  const envAccountKey = process.env.SAXO_ACCOUNT_KEY;
  const tokenPreview = envToken ? `${envToken.substring(0, 20)}...` : null;
  
  let tokenStatus: 'VALID' | 'MISSING' | 'CHECKING' = 'CHECKING';
  let tokenValidUntil: string | null = null;
  
  if (!envToken) {
    tokenStatus = 'MISSING';
  } else {
    // Quick token validation
    try {
      const res = await fetch(`${SAXO_SIM_BASE}/port/v1/accounts/me`, {
        headers: { 'Authorization': `Bearer ${envToken}` }
      });
      tokenStatus = res.ok ? 'VALID' : 'MISSING';
    } catch {
      tokenStatus = 'MISSING';
    }
  }
  
  return NextResponse.json({
    lastTickTime: lastTickTime ? new Date(lastTickTime).toISOString() : null,
    tickCount,
    status: tickStatus,
    lastError,
    grokRateLimited,
    secondsSinceLastTick,
    grokRateLimitExpiresIn: grokRateLimited ? Math.floor((grokRateLimitUntil - now) / 1000) : 0,
    // Token info
    tokenStatus,
    tokenPreview,
    hasEnvToken: !!envToken,
    hasEnvAccountKey: !!envAccountKey,
  });
}

export async function POST() {
  // Token from Vercel env, AccountKey from cookies (personal per customer)
  const envToken = process.env.SAXO_ACCESS_TOKEN;
  const cookieStore = await cookies();
  
  // Token: ENV first, then cookie fallback
  const accessToken = envToken || cookieStore.get('apex_saxo_token')?.value;
  const tokenSource = envToken ? 'ENV' : 'COOKIE';
  const tokenPreview = accessToken ? `${accessToken.substring(0, 20)}...` : 'NONE';
  
  console.log(`[APEX TICK] Token source: ${tokenSource} | Preview: ${tokenPreview}`);
  
  if (!accessToken) {
    return NextResponse.json({
      success: false,
      error: 'Add SAXO_ACCESS_TOKEN to Vercel Environment Variables',
      tokenSource,
      hasToken: false,
    }, { status: 401 });
  }
  
  // Validate token AND fetch accountKey from Saxo API
  console.log(`[APEX TICK] Validating token and fetching account info...`);
  const validateRes = await fetch(`${SAXO_SIM_BASE}/port/v1/accounts/me`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  
  const validateText = await validateRes.text();
  
  if (!validateRes.ok) {
    console.log(`[APEX TICK] Token invalid (${validateRes.status}): ${validateText.substring(0, 100)}`);
    return NextResponse.json({
      success: false,
      error: 'Token expired - get new 24h token from developer.saxo',
      tokenStatus: 'EXPIRED',
      httpStatus: validateRes.status,
    }, { status: 401 });
  }
  
  // Parse account data
  let accountsData;
  try {
    accountsData = JSON.parse(validateText);
  } catch {
    return NextResponse.json({
      success: false,
      error: 'Saxo returned non-JSON response',
    }, { status: 500 });
  }
  
  const accounts = accountsData.Data || [accountsData];
  if (accounts.length === 0) {
    return NextResponse.json({
      success: false,
      error: 'No trading accounts found',
    }, { status: 401 });
  }
  
  const accountKey = accounts[0].AccountKey;
  console.log(`[APEX TICK] Token valid! AccountKey: ${accountKey}`);
  
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

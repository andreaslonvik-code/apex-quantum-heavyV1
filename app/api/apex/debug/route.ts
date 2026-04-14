// APEX QUANTUM v6.2 - Debug API for troubleshooting
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const SAXO_SIM_BASE = 'https://gateway.saxobank.com/sim/openapi';

// Track last API calls for debugging
interface ApiCallLog {
  url: string;
  method: string;
  status: number;
  responseType: 'json' | 'html' | 'error';
  rawBody: string;
  error?: string;
  timestamp: string;
}

const apiCallLogs: ApiCallLog[] = [];
const MAX_LOGS = 20;

function addLog(log: ApiCallLog) {
  apiCallLogs.push(log);
  if (apiCallLogs.length > MAX_LOGS) {
    apiCallLogs.shift();
  }
}

export async function GET() {
  const cookieStore = await cookies();
  
  // Get token from env and cookies
  const envToken = process.env.SAXO_ACCESS_TOKEN;
  const cookieToken = cookieStore.get('apex_saxo_token')?.value;
  const accountKey = cookieStore.get('apex_saxo_account_key')?.value;
  
  const accessToken = envToken || cookieToken;
  const tokenSource = envToken ? 'ENV' : (cookieToken ? 'COOKIE' : 'NONE');
  const tokenPreview = accessToken ? `${accessToken.substring(0, 30)}...` : 'MISSING';
  
  // Test token with Saxo API
  let tokenStatus = 'UNKNOWN';
  let tokenTestResponse = '';
  let tokenTestError = '';
  
  if (accessToken) {
    try {
      const res = await fetch(`${SAXO_SIM_BASE}/port/v1/accounts/me`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      
      const rawBody = await res.text();
      const isHtml = rawBody.trim().startsWith('<');
      
      addLog({
        url: `${SAXO_SIM_BASE}/port/v1/accounts/me`,
        method: 'GET',
        status: res.status,
        responseType: isHtml ? 'html' : 'json',
        rawBody: rawBody.substring(0, 800),
        timestamp: new Date().toISOString(),
      });
      
      if (res.ok && !isHtml) {
        tokenStatus = 'VALID';
        tokenTestResponse = rawBody.substring(0, 500);
      } else if (res.status === 401) {
        tokenStatus = 'EXPIRED';
        tokenTestError = `401 Unauthorized. Response: ${rawBody.substring(0, 300)}`;
      } else {
        tokenStatus = 'ERROR';
        tokenTestError = `Status ${res.status}. ${isHtml ? 'HTML Response' : 'JSON Error'}: ${rawBody.substring(0, 300)}`;
      }
    } catch (e) {
      tokenStatus = 'NETWORK_ERROR';
      tokenTestError = `Network error: ${e}`;
    }
  } else {
    tokenStatus = 'MISSING';
    tokenTestError = 'No token found in ENV or cookies';
  }
  
  return NextResponse.json({
    timestamp: new Date().toISOString(),
    token: {
      source: tokenSource,
      preview: tokenPreview,
      status: tokenStatus,
      testResponse: tokenTestResponse,
      testError: tokenTestError,
    },
    accountKey: {
      present: !!accountKey,
      preview: accountKey ? `${accountKey.substring(0, 10)}...` : 'MISSING',
    },
    environment: {
      SAXO_ENV: process.env.SAXO_ENV || 'NOT_SET',
      hasEnvToken: !!envToken,
      hasCookieToken: !!cookieToken,
    },
    recentApiCalls: apiCallLogs.slice(-10),
    instructions: tokenStatus !== 'VALID' ? {
      step1: 'Go to Vercel Dashboard > Project Settings > Environment Variables',
      step2: 'Update SAXO_ACCESS_TOKEN with a fresh 24-hour token from Saxo Developer Portal',
      step3: 'Redeploy the project for the new token to take effect',
      step4: 'Make sure you are logged in with Saxo OAuth to set accountKey cookie',
    } : null,
  });
}

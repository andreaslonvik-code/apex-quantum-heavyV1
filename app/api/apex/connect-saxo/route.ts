import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Saxo Bank SIM API endpoints
const SAXO_SIM_API_URL = 'https://gateway.saxobank.com/sim/openapi';

interface SaxoAccountResponse {
  Data: Array<{
    AccountId: string;
    AccountKey: string;
    ClientKey: string;
    AccountType: string;
    Currency: string;
  }>;
}

interface SaxoBalanceResponse {
  CashBalance: number;
  Currency: string;
  TotalValue: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accessToken } = body;

    // Validate input
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Access token er pakrevd' },
        { status: 400 }
      );
    }

    // Step 1: Get account information using the access token
    const accountsResponse = await fetch(`${SAXO_SIM_API_URL}/port/v1/accounts/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!accountsResponse.ok) {
      const errorText = await accountsResponse.text();
      console.error('Saxo accounts error:', errorText);
      return NextResponse.json(
        { error: 'Kunne ikke hente kontoinformasjon fra Saxo. Sjekk at tilkoblingen er gyldig.' },
        { status: 401 }
      );
    }

    const accountsData: SaxoAccountResponse = await accountsResponse.json();
    
    if (!accountsData.Data || accountsData.Data.length === 0) {
      return NextResponse.json(
        { error: 'Ingen kontoer funnet pa denne Saxo-kontoen' },
        { status: 404 }
      );
    }

    const primaryAccount = accountsData.Data[0];

    // Step 2: Get balance for the primary account
    const balanceResponse = await fetch(
      `${SAXO_SIM_API_URL}/port/v1/balances?AccountKey=${primaryAccount.AccountKey}&ClientKey=${primaryAccount.ClientKey}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    let balance = 1000000;
    let currency = 'NOK';

    if (balanceResponse.ok) {
      const balanceData: SaxoBalanceResponse = await balanceResponse.json();
      // Use TotalValue which is the complete account value (Kontoverdi in SaxoTrader)
      balance = balanceData.TotalValue || balanceData.CashBalance || 1000000;
      currency = balanceData.Currency || primaryAccount.Currency || 'NOK';
      console.log(`[APEX] Balance data: TotalValue=${balanceData.TotalValue}, CashBalance=${balanceData.CashBalance}`);
    }

    // Store access token in secure HTTP-only cookie
    const cookieStore = await cookies();
    
    console.log(`[APEX] Storing cookies - AccountKey: ${primaryAccount.AccountKey}, ClientKey: ${primaryAccount.ClientKey}`);
    
    cookieStore.set('apex_saxo_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', // Allow cross-site for OAuth redirects
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/',
    });

    // Store account key for trading
    cookieStore.set('apex_saxo_account_key', primaryAccount.AccountKey, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24,
      path: '/',
    });

    cookieStore.set('apex_saxo_client_key', primaryAccount.ClientKey, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24,
      path: '/',
    });

    return NextResponse.json({
      success: true,
      message: 'Tilkobling vellykket',
      accountInfo: {
        accountId: primaryAccount.AccountId,
        accountKey: primaryAccount.AccountKey,
        balance,
        currency,
        simulationMode: true,
      },
    });

  } catch (error) {
    console.error('Connect Saxo error:', error);
    return NextResponse.json(
      { error: 'En uventet feil oppstod. Vennligst prov igjen.' },
      { status: 500 }
    );
  }
}

// GET endpoint to check connection status
export async function GET() {
  try {
    const cookieStore = await cookies();
    const cookieToken = cookieStore.get('apex_saxo_token');
    const accountKey = cookieStore.get('apex_saxo_account_key');
    const clientKey = cookieStore.get('apex_saxo_client_key');
    
    // Use env token if available, otherwise cookie token
    const envToken = process.env.SAXO_ACCESS_TOKEN;
    const token = envToken || cookieToken?.value;
    const tokenSource = envToken ? 'ENV' : 'COOKIE';

    if (!token || !accountKey) {
      return NextResponse.json({ 
        connected: false,
        reason: !token ? 'No token (add SAXO_ACCESS_TOKEN to Vercel env)' : 'No accountKey (user must login)',
        tokenSource,
        hasEnvToken: !!envToken,
      });
    }

    // Verify token is still valid by making a simple API call
    const response = await fetch(`${SAXO_SIM_API_URL}/port/v1/accounts/me`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[APEX] Token validation failed:', response.status, errorText.substring(0, 200));
      return NextResponse.json({ 
        connected: false,
        reason: `Token invalid (${response.status})`,
        tokenSource,
      });
    }

    // ALWAYS get text first, then parse JSON
    const responseText = await response.text();
    let accountsData;
    try {
      accountsData = JSON.parse(responseText);
    } catch {
      console.error('[APEX] Saxo returned non-JSON:', responseText.substring(0, 200));
      return NextResponse.json({ 
        connected: false, 
        reason: 'Saxo returned non-JSON response',
        rawResponse: responseText.substring(0, 200),
      });
    }
    const account = accountsData.Data?.[0] || accountsData;

    // Get balance
    let balance = 100000;
    let currency = 'USD';

    try {
      const balanceResponse = await fetch(
        `${SAXO_SIM_API_URL}/port/v1/balances?AccountKey=${accountKey.value}&ClientKey=${clientKey?.value || 'me'}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      if (balanceResponse.ok) {
        const balanceText = await balanceResponse.text();
        try {
          const balanceData = JSON.parse(balanceText);
          balance = balanceData.TotalValue || balanceData.CashBalance || 100000;
          currency = balanceData.Currency || 'USD';
        } catch {
          console.error('[APEX] Balance response non-JSON:', balanceText.substring(0, 100));
        }
      }
    } catch {
      // Use defaults
    }

    return NextResponse.json({ 
      connected: true,
      accountKey: accountKey.value,
      tokenSource,
      accountInfo: {
        accountId: account.AccountId || account.AccountKey || accountKey.value,
        accountKey: accountKey.value,
        balance,
        currency,
      },
    });
  } catch (err) {
    console.error('[APEX] connect-saxo GET error:', err);
    return NextResponse.json({ connected: false, error: String(err) });
  }
}

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

    let balance = 100000;
    let currency = 'USD';

    if (balanceResponse.ok) {
      const balanceData: SaxoBalanceResponse = await balanceResponse.json();
      balance = balanceData.TotalValue || balanceData.CashBalance || 100000;
      currency = balanceData.Currency || primaryAccount.Currency || 'USD';
    }

    // Store access token in secure HTTP-only cookie
    const cookieStore = await cookies();
    cookieStore.set('apex_saxo_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/',
    });

    // Store account key for trading
    cookieStore.set('apex_saxo_account_key', primaryAccount.AccountKey, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24,
      path: '/',
    });

    cookieStore.set('apex_saxo_client_key', primaryAccount.ClientKey, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
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
    const token = cookieStore.get('apex_saxo_token');
    const accountKey = cookieStore.get('apex_saxo_account_key');

    if (!token || !accountKey) {
      return NextResponse.json({ connected: false });
    }

    // Verify token is still valid by making a simple API call
    const response = await fetch(`${SAXO_SIM_API_URL}/port/v1/accounts/me`, {
      headers: { 'Authorization': `Bearer ${token.value}` },
    });

    if (!response.ok) {
      return NextResponse.json({ connected: false });
    }

    return NextResponse.json({ 
      connected: true,
      accountKey: accountKey.value,
    });
  } catch {
    return NextResponse.json({ connected: false });
  }
}

import { NextRequest, NextResponse } from 'next/server';

// Saxo Bank SIM API endpoints
const SAXO_SIM_AUTH_URL = 'https://sim.logonvalidation.net/token';
const SAXO_SIM_API_URL = 'https://gateway.saxobank.com/sim/openapi';

interface SaxoTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
}

interface SaxoAccountResponse {
  Data: Array<{
    AccountId: string;
    AccountKey: string;
    AccountType: string;
    Currency: string;
    Balance?: number;
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
    const { clientId, clientSecret, simulationMode } = body;

    // Validate input
    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: 'Client ID og Client Secret er påkrevd' },
        { status: 400 }
      );
    }

    if (!simulationMode) {
      return NextResponse.json(
        { error: 'Kun simuleringsmodus er støttet for øyeblikket' },
        { status: 400 }
      );
    }

    // Step 1: Get access token from Saxo SIM
    const tokenResponse = await fetch(SAXO_SIM_AUTH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Saxo token error:', errorText);
      return NextResponse.json(
        { error: 'Kunne ikke autentisere med Saxo. Sjekk at Client ID og Client Secret er korrekte.' },
        { status: 401 }
      );
    }

    const tokenData: SaxoTokenResponse = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Step 2: Get account information
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
        { error: 'Kunne ikke hente kontoinformasjon fra Saxo' },
        { status: 500 }
      );
    }

    const accountsData: SaxoAccountResponse = await accountsResponse.json();
    
    if (!accountsData.Data || accountsData.Data.length === 0) {
      return NextResponse.json(
        { error: 'Ingen kontoer funnet på denne Saxo-kontoen' },
        { status: 404 }
      );
    }

    const primaryAccount = accountsData.Data[0];

    // Step 3: Get balance for the primary account
    const balanceResponse = await fetch(
      `${SAXO_SIM_API_URL}/port/v1/balances?AccountKey=${primaryAccount.AccountKey}&ClientKey=${primaryAccount.AccountKey}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    let balance = '100,000.00';
    let currency = 'NOK';

    if (balanceResponse.ok) {
      const balanceData: SaxoBalanceResponse = await balanceResponse.json();
      balance = balanceData.TotalValue?.toLocaleString('no-NO', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
      }) || '100,000.00';
      currency = balanceData.Currency || primaryAccount.Currency || 'NOK';
    }

    // Store credentials securely (in production, use a proper secrets manager)
    // For now, we'll just validate the connection
    // In a real app, you'd store these encrypted in a database

    return NextResponse.json({
      success: true,
      message: 'Tilkobling vellykket',
      accountInfo: {
        accountId: primaryAccount.AccountId,
        balance,
        currency,
        simulationMode: true,
      },
    });

  } catch (error) {
    console.error('Connect Saxo error:', error);
    return NextResponse.json(
      { error: 'En uventet feil oppstod. Vennligst prøv igjen.' },
      { status: 500 }
    );
  }
}

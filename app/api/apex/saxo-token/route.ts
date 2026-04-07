import { NextRequest, NextResponse } from 'next/server';

// Saxo SIM OAuth2 endpoints
const SAXO_TOKEN_URL = 'https://sim.logonvalidation.net/token';
const SAXO_API_BASE = 'https://gateway.saxobank.com/sim/openapi';

// App credentials - in production these should be environment variables
const CLIENT_ID = '036e1c50316b4589b899db41f61563a7';
const CLIENT_SECRET = '11188e12641c4328aab1833982e060c7';
const REDIRECT_URI = process.env.SAXO_REDIRECT_URI || 'https://apex-quantum.com/callback';

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json();

    if (!code) {
      return NextResponse.json(
        { error: 'Autorisasjonskode mangler' },
        { status: 400 }
      );
    }

    // Exchange authorization code for access token
    const tokenResponse = await fetch(SAXO_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Saxo token error:', errorText);
      return NextResponse.json(
        { error: 'Kunne ikke autentisere med Saxo. Prøv igjen.' },
        { status: 401 }
      );
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Get account information
    const accountsResponse = await fetch(`${SAXO_API_BASE}/port/v1/accounts/me`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!accountsResponse.ok) {
      console.error('Failed to fetch accounts:', await accountsResponse.text());
      return NextResponse.json(
        { error: 'Kunne ikke hente kontoinformasjon' },
        { status: 500 }
      );
    }

    const accountsData = await accountsResponse.json();
    const account = accountsData.Data?.[0] || accountsData;

    // Get account balance
    const balanceResponse = await fetch(
      `${SAXO_API_BASE}/port/v1/balances?ClientKey=${account.ClientKey || 'me'}&AccountKey=${account.AccountKey || 'me'}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    let balance = 100000; // Default for simulation
    let currency = 'USD';

    if (balanceResponse.ok) {
      const balanceData = await balanceResponse.json();
      balance = balanceData.CashBalance || balanceData.TotalValue || 100000;
      currency = balanceData.Currency || 'USD';
    }

    // Store the token securely (in production, use a database)
    // For now, we'll return success with account info
    // TODO: Store accessToken and refreshToken securely

    return NextResponse.json({
      success: true,
      accessToken: accessToken,
      accountId: account.AccountId || account.AccountKey || 'TRIAL_22114134',
      balance: balance,
      currency: currency,
      message: 'Tilkobling vellykket! Apex Quantum er nå koblet til din Saxo Simulation-konto.',
    });

  } catch (error) {
    console.error('Token exchange error:', error);
    return NextResponse.json(
      { error: 'En uventet feil oppstod. Prøv igjen.' },
      { status: 500 }
    );
  }
}

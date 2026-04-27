/**
 * POST  /api/apex/alpaca/connect
 *   Body: { apiKey, apiSecret, environment: 'paper' | 'live' }
 *   - Validates the keys against Alpaca /v2/account
 *   - Encrypts and stores per-user via lib/user-alpaca
 *   - Returns sanitized account info (no secrets)
 *
 * GET   /api/apex/alpaca/connect
 *   - Returns { connected: boolean, accountInfo? } for the current Clerk user.
 *   - Refreshes account snapshot from Alpaca on every call.
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { validateCreds, type AlpacaEnv } from '@/lib/alpaca';
import { saveUserAlpacaCreds, getUserAlpacaCreds } from '@/lib/user-alpaca';
import { mask } from '@/lib/crypto';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Du må være logget inn.' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const apiKey: string = String(body.apiKey || '').trim();
    const apiSecret: string = String(body.apiSecret || '').trim();
    const environment: AlpacaEnv = body.environment === 'live' ? 'live' : 'paper';

    if (!apiKey || !apiSecret) {
      return NextResponse.json(
        { error: 'API Key ID og Secret Key er påkrevd.' },
        { status: 400 }
      );
    }

    if (apiKey.length < 16 || apiSecret.length < 24) {
      return NextResponse.json(
        { error: 'API-nøklene ser ugyldige ut. Sjekk at du har kopiert dem riktig fra Alpaca.' },
        { status: 400 }
      );
    }

    // Validate against Alpaca
    const validation = await validateCreds({ apiKey, apiSecret, env: environment });
    if (!validation.success) {
      const userMsg =
        validation.errorCode === 'INVALID_CREDS'
          ? 'Alpaca avviste API-nøklene. Sjekk at de er riktig kopiert og at de hører til riktig konto.'
          : validation.errorCode === 'WRONG_ENV'
          ? `Disse nøklene fungerer ikke i ${environment === 'live' ? 'LIVE' : 'PAPER'}-modus. Du har sannsynligvis valgt feil miljø.`
          : `Validering feilet: ${validation.error}`;
      return NextResponse.json({ error: userMsg, code: validation.errorCode }, { status: 401 });
    }

    const account = validation.data;
    const equity = Number(account.equity) || Number(account.portfolio_value) || 0;

    if (account.account_blocked || account.trading_blocked) {
      return NextResponse.json(
        { error: 'Alpaca-kontoen din er blokkert for trading. Kontakt Alpaca support.' },
        { status: 403 }
      );
    }

    await saveUserAlpacaCreds(userId, {
      apiKey,
      apiSecret,
      environment,
      accountId: account.account_number,
      accountStatus: account.status,
      currentEquity: equity,
    });

    console.log(
      `[alpaca-connect] user=${userId} env=${environment} account=${account.account_number} key=${mask(apiKey)}`
    );

    return NextResponse.json({
      success: true,
      message: 'Alpaca-kontoen er koblet til.',
      accountInfo: {
        accountId: account.account_number,
        status: account.status,
        currency: account.currency,
        equity,
        cash: Number(account.cash) || 0,
        buyingPower: Number(account.buying_power) || 0,
        environment,
        isLive: environment === 'live',
      },
    });
  } catch (err) {
    console.error('[alpaca-connect POST] error:', err);
    const msg = err instanceof Error ? err.message : String(err);

    if (msg.includes('ENCRYPTION_KEY')) {
      return NextResponse.json(
        {
          error:
            'Server-konfigurasjon mangler: ENCRYPTION_KEY er ikke satt. Kontakt support.',
          code: 'CONFIG_ENCRYPTION_KEY_MISSING',
        },
        { status: 500 }
      );
    }
    if (msg.includes('SUPABASE_SERVICE_ROLE_KEY') || msg.includes('NEXT_PUBLIC_SUPABASE')) {
      return NextResponse.json(
        {
          error:
            'Server-konfigurasjon mangler: Supabase-nøkler er ikke satt. Kontakt support.',
          code: 'CONFIG_SUPABASE_MISSING',
        },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: 'En uventet feil oppstod. Prøv igjen.' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ connected: false });
    }

    const creds = await getUserAlpacaCreds(userId);
    if (!creds) {
      return NextResponse.json({ connected: false });
    }

    // Probe Alpaca for a fresh account snapshot
    const validation = await validateCreds({
      apiKey: creds.apiKey,
      apiSecret: creds.apiSecret,
      env: creds.environment,
    });

    if (!validation.success) {
      return NextResponse.json({
        connected: true,
        stale: true,
        accountInfo: {
          accountId: creds.accountId,
          environment: creds.environment,
          isLive: creds.environment === 'live',
          status: creds.accountStatus,
          equity: 0,
          cash: 0,
          buyingPower: 0,
          currency: 'USD',
          error: validation.error,
        },
      });
    }

    const account = validation.data;
    return NextResponse.json({
      connected: true,
      stale: false,
      accountInfo: {
        accountId: account.account_number,
        status: account.status,
        currency: account.currency,
        equity: Number(account.equity) || 0,
        cash: Number(account.cash) || 0,
        buyingPower: Number(account.buying_power) || 0,
        environment: creds.environment,
        isLive: creds.environment === 'live',
      },
    });
  } catch (err) {
    console.error('[alpaca-connect GET] error:', err);
    return NextResponse.json({ connected: false });
  }
}

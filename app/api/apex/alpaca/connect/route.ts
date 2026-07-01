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
import { auth, clerkClient } from '@clerk/nextjs/server';
import { validateCreds, updateAccountConfigurations, type AlpacaEnv } from '@/lib/alpaca';
import { saveUserAlpacaCreds, getUserAlpacaCreds } from '@/lib/user-alpaca';
import { mask } from '@/lib/crypto';
import { checkSameOrigin } from '@/lib/csrf';
import { RISK_VERSION } from '@/lib/legal-copy';

export async function POST(request: NextRequest) {
  try {
    // H1 CSRF — connect overwrites stored API creds; same-origin POST only.
    const csrf = checkSameOrigin(request);
    if (!csrf.ok) {
      return NextResponse.json({ error: 'cross_origin_blocked' }, { status: 403 });
    }
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Du må være logget inn.' }, { status: 401 });
    }

    // §6 lag 4b — attestasjonen håndheves server-side, ikke bare i klienten.
    // Nøkler lagres ALDRI uten at Max-attestasjonen (maxRiskVersion) er på
    // fil i Clerk publicMetadata for gjeldende RISK_VERSION.
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId);
    const meta = (clerkUser.publicMetadata ?? {}) as { maxRiskVersion?: unknown };
    const maxRiskVersion =
      typeof meta.maxRiskVersion === 'number' ? meta.maxRiskVersion : 0;
    if (maxRiskVersion < RISK_VERSION) {
      return NextResponse.json({ error: 'attestation_required' }, { status: 403 });
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

    // Validate against Alpaca. validateCreds now produces user-ready norsk
    // messages for INVALID_CREDS and WRONG_ENV (incl. cross-env probing).
    const validation = await validateCreds({ apiKey, apiSecret, env: environment });
    if (!validation.success) {
      const userMsg =
        validation.errorCode === 'INVALID_CREDS' || validation.errorCode === 'WRONG_ENV'
          ? validation.error
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

    // Best-effort: defer the buying-power gate to fill time so the engine's
    // re-buy path (e.g. after a same-day kill-switch SELL) is never rejected
    // at order entry. dtbp_check still earns its keep under Alpaca's 2026
    // intraday-margin framework; pdt_check is now a harmless no-op (PDT rule
    // retired). Idempotent. Intentionally NON-blocking — a failed PATCH must
    // not break a connection that otherwise validated, so we log and move on.
    // We do NOT touch max_margin_multiplier: Max runs 1x/RegT by design.
    try {
      const cfg = await updateAccountConfigurations(
        { apiKey, apiSecret, env: environment },
        { pdt_check: 'exit', dtbp_check: 'exit' },
      );
      if (!cfg.success) {
        console.warn(
          `[alpaca-connect] config-relax skipped for user=${userId}: ${cfg.error}`,
        );
      }
    } catch (cfgErr) {
      console.warn(`[alpaca-connect] config-relax threw for user=${userId}:`, cfgErr);
    }

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
    // Supabase / PostgREST throws plain objects (PostgrestError), not Error instances.
    // Walk common shapes so we surface the real message instead of "[object Object]".
    const errObj = err as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    const msg =
      err instanceof Error
        ? err.message
        : typeof errObj?.message === 'string'
        ? [errObj.message, errObj.details, errObj.hint].filter(Boolean).join(' | ')
        : (() => {
            try {
              return JSON.stringify(err);
            } catch {
              return String(err);
            }
          })();
    const pgCode = typeof errObj?.code === 'string' ? errObj.code : undefined;

    if (msg.includes('ENCRYPTION_KEY')) {
      return NextResponse.json(
        {
          error: 'Server-konfigurasjon mangler: ENCRYPTION_KEY er ikke satt eller har feil lengde (må være 64 hex-tegn).',
          code: 'CONFIG_ENCRYPTION_KEY_MISSING',
        },
        { status: 500 }
      );
    }
    if (msg.includes('SUPABASE_SERVICE_ROLE_KEY') || msg.includes('NEXT_PUBLIC_SUPABASE')) {
      return NextResponse.json(
        {
          error: 'Server-konfigurasjon mangler: Supabase-nøkler er ikke satt.',
          code: 'CONFIG_SUPABASE_MISSING',
        },
        { status: 500 }
      );
    }
    // H7 fix — Postgres / PostgREST errors used to leak through to clients
    // via `details: msg` and `error: \`Uventet serverfeil: ${msg}\``. These
    // can expose ENCRYPTION_KEY / SUPABASE_SERVICE_ROLE_KEY env names,
    // table names, RLS policy hints — useful reconnaissance for attackers.
    // Now: log full message server-side, return stable code + generic copy.
    if (
      pgCode === '42P01' ||
      (msg.includes('relation') && msg.includes('does not exist'))
    ) {
      console.error('[apex/alpaca/connect] missing-table error:', msg);
      return NextResponse.json(
        {
          error:
            'Databasen er ikke initialisert: tabellen `alpaca_accounts` finnes ikke. Kjør `prisma/supabase-setup.sql` i Supabase SQL Editor.',
          code: 'DB_TABLE_MISSING',
        },
        { status: 500 }
      );
    }
    if (pgCode === '42501' || msg.includes('row-level security') || msg.includes('permission denied')) {
      console.error('[apex/alpaca/connect] permission-denied error:', msg);
      return NextResponse.json(
        {
          error:
            'Databasen avviste skriving (RLS eller permissions). Kjør den siste versjonen av `prisma/supabase-setup.sql` som disabler RLS på `alpaca_accounts`.',
          code: 'DB_PERMISSION_DENIED',
        },
        { status: 500 }
      );
    }
    console.error('[apex/alpaca/connect] internal error:', msg);
    return NextResponse.json(
      {
        error: 'Uventet serverfeil. Prøv igjen, eller kontakt support hvis problemet vedvarer.',
        code: 'INTERNAL',
      },
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

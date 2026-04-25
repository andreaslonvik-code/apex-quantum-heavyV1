import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { cookies } from 'next/headers';
import { getUserSaxoCreds, saveUserSaxoCreds } from '@/lib/user-saxo';
import { getSaxoBase, type SaxoEnv } from '@/lib/saxo';

async function fetchAccountInfo(accessToken: string, env: SaxoEnv) {
  const res = await fetch(`${getSaxoBase(env)}/port/v1/accounts/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.Data?.[0] || data;
}

async function fetchBalance(accessToken: string, accountKey: string, clientKey: string, env: SaxoEnv) {
  const res = await fetch(
    `${getSaxoBase(env)}/port/v1/balances?AccountKey=${accountKey}&ClientKey=${clientKey}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) return { balance: 1000000, currency: 'NOK' };
  const data = await res.json();
  return {
    balance: data.TotalValue || data.CashBalance || 1000000,
    currency: data.Currency || 'NOK',
  };
}

// POST — store tokens after OAuth + validate them
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    const body = await request.json();
    const { accessToken, environment: bodyEnv } = body;
    const env: SaxoEnv = (bodyEnv === 'live' || bodyEnv === 'sim')
      ? bodyEnv
      : ((process.env.SAXO_ENV as SaxoEnv) || 'sim');

    if (!accessToken) {
      return NextResponse.json({ error: 'Access token er påkrevd' }, { status: 400 });
    }

    const account = await fetchAccountInfo(accessToken, env);
    if (!account) {
      return NextResponse.json(
        { error: 'Kunne ikke hente kontoinformasjon fra Saxo. Sjekk at tilkoblingen er gyldig.' },
        { status: 401 }
      );
    }

    const accountKey: string = account.AccountKey || 'me';
    const clientKey: string = account.ClientKey || accountKey;
    const accountId: string = account.AccountId || accountKey;
    const { balance, currency } = await fetchBalance(accessToken, accountKey, clientKey, env);

    // Persist to database per user
    if (userId) {
      await saveUserSaxoCreds(userId, {
        accessToken,
        accountKey,
        clientKey,
        accountId,
        environment: env,
        currentBalance: balance,
      });
    }

    // Also set HttpOnly cookies for same-device session
    const cookieStore = await cookies();
    const opts = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 60 * 60 * 24,
      path: '/',
    };
    cookieStore.set('apex_saxo_token', accessToken, opts);
    cookieStore.set('apex_saxo_account_key', accountKey, opts);
    cookieStore.set('apex_saxo_client_key', clientKey, opts);

    return NextResponse.json({
      success: true,
      message: 'Tilkobling vellykket',
      accountInfo: {
        accountId,
        accountKey,
        balance,
        currency,
        simulationMode: env !== 'live',
      },
    });
  } catch (error) {
    console.error('[connect-saxo POST]', error);
    return NextResponse.json({ error: 'En uventet feil oppstod. Vennligst prøv igjen.' }, { status: 500 });
  }
}

// GET — check connection status: DB first, cookie fallback
export async function GET() {
  try {
    const { userId } = await auth();

    // 1. DB lookup (works across devices, survives cookie loss)
    if (userId) {
      const creds = await getUserSaxoCreds(userId);
      if (creds) {
        const res = await fetch(`${getSaxoBase(creds.environment)}/port/v1/accounts/me`, {
          headers: { Authorization: `Bearer ${creds.accessToken}` },
        });
        if (res.ok) {
          const accountsData = await res.json();
          const account = accountsData.Data?.[0] || accountsData;
          const { balance, currency } = await fetchBalance(creds.accessToken, creds.accountKey, creds.clientKey, creds.environment);

          // Refresh cookies for this browser session
          const cookieStore = await cookies();
          const opts = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, maxAge: 86400, path: '/' };
          cookieStore.set('apex_saxo_token', creds.accessToken, opts);
          cookieStore.set('apex_saxo_account_key', creds.accountKey, opts);
          cookieStore.set('apex_saxo_client_key', creds.clientKey, opts);

          return NextResponse.json({
            connected: true,
            accountKey: creds.accountKey,
            accountInfo: {
              accountId: account.AccountId || creds.accountId,
              accountKey: creds.accountKey,
              balance,
              currency,
            },
          });
        }
        // Token expired — fall through to cookie check
      }
    }

    // 2. Cookie fallback (same device, may not have Clerk yet)
    const cookieStore = await cookies();
    const token = cookieStore.get('apex_saxo_token')?.value;
    const accountKey = cookieStore.get('apex_saxo_account_key')?.value;
    const clientKey = cookieStore.get('apex_saxo_client_key')?.value;

    if (!token || !accountKey) {
      return NextResponse.json({ connected: false });
    }

    const fallbackEnv: SaxoEnv = (process.env.SAXO_ENV as SaxoEnv) || 'sim';
    const res = await fetch(`${getSaxoBase(fallbackEnv)}/port/v1/accounts/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return NextResponse.json({ connected: false });

    const accountsData = await res.json();
    const account = accountsData.Data?.[0] || accountsData;
    const { balance, currency } = await fetchBalance(token, accountKey, clientKey || accountKey, fallbackEnv);

    return NextResponse.json({
      connected: true,
      accountKey,
      accountInfo: {
        accountId: account.AccountId || accountKey,
        accountKey,
        balance,
        currency,
      },
    });
  } catch {
    return NextResponse.json({ connected: false });
  }
}

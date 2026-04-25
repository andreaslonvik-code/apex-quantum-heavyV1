import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { cookies } from 'next/headers';
import { saveUserSaxoCreds } from '@/lib/user-saxo';
import { getSaxoBase, type SaxoEnv } from '@/lib/saxo';

const CLIENT_ID = process.env.SAXO_CLIENT_ID;
const CLIENT_SECRET = process.env.SAXO_CLIENT_SECRET;
const REDIRECT_URI = process.env.SAXO_REDIRECT_URI || 'https://apex-quantum.com/callback';

function getSaxoTokenUrl(env: SaxoEnv) {
  return env === 'live'
    ? 'https://live.logonvalidation.net/token'
    : 'https://sim.logonvalidation.net/token';
}

export async function POST(request: NextRequest) {
  try {
    if (!CLIENT_ID || !CLIENT_SECRET) {
      return NextResponse.json({ error: 'Serverkonfigurasjon mangler. Kontakt support.' }, { status: 500 });
    }

    const { userId } = await auth();
    const { code, environment: bodyEnv } = await request.json();
    const env: SaxoEnv = (bodyEnv === 'live' || bodyEnv === 'sim')
      ? bodyEnv
      : ((process.env.SAXO_ENV as SaxoEnv) || 'sim');

    if (!code) {
      return NextResponse.json({ error: 'Autorisasjonskode mangler' }, { status: 400 });
    }

    // Exchange OAuth code for tokens
    const tokenRes = await fetch(getSaxoTokenUrl(env), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
      }).toString(),
    });

    if (!tokenRes.ok) {
      console.error('[saxo-token] Token exchange failed:', await tokenRes.text());
      return NextResponse.json({ error: 'Kunne ikke autentisere med Saxo. Prøv igjen.' }, { status: 401 });
    }

    const tokenData = await tokenRes.json();
    const accessToken: string = tokenData.access_token;
    const refreshToken: string | undefined = tokenData.refresh_token;
    const expiresIn: number = tokenData.expires_in || 3600;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    // Fetch account info from Saxo
    const SAXO_API_BASE = getSaxoBase(env);
    const accountsRes = await fetch(`${SAXO_API_BASE}/port/v1/accounts/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!accountsRes.ok) {
      return NextResponse.json({ error: 'Kunne ikke hente kontoinformasjon' }, { status: 500 });
    }

    const accountsData = await accountsRes.json();
    const account = accountsData.Data?.[0] || accountsData;
    const accountKey: string = account.AccountKey || 'me';
    const clientKey: string = account.ClientKey || 'me';
    const accountId: string = account.AccountId || accountKey;

    // Fetch balance
    const balRes = await fetch(
      `${SAXO_API_BASE}/port/v1/balances?AccountKey=${accountKey}&ClientKey=${clientKey}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    let balance = 1000000;
    let currency = 'NOK';
    if (balRes.ok) {
      const balData = await balRes.json();
      balance = balData.TotalValue || balData.CashBalance || 1000000;
      currency = balData.Currency || 'NOK';
    }

    // --- PERSIST TO DATABASE (per user) ---
    if (userId) {
      await saveUserSaxoCreds(userId, {
        accessToken,
        refreshToken,
        accountKey,
        clientKey,
        accountId,
        environment: env,
        expiresAt,
        currentBalance: balance,
      });
      console.log(`[saxo-token] Saved credentials to DB for user ${userId}`);
    } else {
      console.warn('[saxo-token] No Clerk userId — storing in cookies only (unauthenticated session)');
    }

    // Also set HttpOnly cookies so the same browser session works immediately
    const cookieStore = await cookies();
    const cookieOpts = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: expiresIn,
      path: '/',
    };
    cookieStore.set('apex_saxo_token', accessToken, cookieOpts);
    cookieStore.set('apex_saxo_account_key', accountKey, cookieOpts);
    cookieStore.set('apex_saxo_client_key', clientKey, cookieOpts);

    return NextResponse.json({
      success: true,
      accessToken,
      accountId,
      accountKey,
      clientKey,
      balance,
      currency,
      message: 'Tilkobling vellykket! Apex Quantum er koblet til din Saxo-konto.',
    });
  } catch (error) {
    console.error('[saxo-token] Error:', error);
    return NextResponse.json({ error: 'En uventet feil oppstod. Prøv igjen.' }, { status: 500 });
  }
}

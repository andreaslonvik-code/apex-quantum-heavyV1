// Manual diagnostic endpoint for the AI portfolio selector.
//
// Authenticated via Clerk session. Hit this from a browser tab while
// signed in to force a Grok call and see exactly what comes back +
// whether it persisted to Supabase. Useful to confirm the AI pipeline
// works end-to-end without waiting for the trading cron.
//
// Returns a flat JSON envelope so you can read it inline in browser
// devtools — no parsing needed.
import { NextResponse } from 'next/server';
import { getRequestCreds } from '@/lib/get-request-creds';
import { selectEliteWithAI } from '@/lib/ai-portfolio';
import { createAdminClient } from '@/utils/supabase/admin';
import { getStockBars } from '@/lib/alpaca';

export async function GET() {
  const userCreds = await getRequestCreds();
  if (!userCreds) {
    return NextResponse.json(
      { error: 'Not signed in to Clerk / no Alpaca creds. Sign in via dashboard first.' },
      { status: 401 },
    );
  }

  const startTime = Date.now();

  // Quick Alpaca-bars sanity check for 3 well-known tickers. If these fail
  // the rest of the AI pipeline will fail too because gatherTickerStats
  // depends on the same getStockBars call.
  const credsForBars = {
    apiKey: userCreds.apiKey,
    apiSecret: userCreds.apiSecret,
    env: userCreds.environment,
  };
  const barsTest: Record<string, { success: boolean; barsCount?: number; error?: string }> = {};
  for (const t of ['MU', 'NVDA', 'AAPL']) {
    try {
      const r = await getStockBars(credsForBars, t, { timeframe: '1Day', limit: 30 });
      barsTest[t] = r.success
        ? { success: true, barsCount: r.data.length }
        : { success: false, error: r.error };
    } catch (e) {
      barsTest[t] = { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  // Snapshot: latest persisted AI selection BEFORE we trigger a new one,
  // so we can confirm a fresh row appears after this call.
  let beforeCount = 0;
  let beforeLastAt: string | null = null;
  try {
    const sb = createAdminClient();
    const { count } = await sb
      .from('ai_portfolio_selections')
      .select('*', { count: 'exact', head: true });
    beforeCount = count ?? 0;
    const { data: latest } = await sb
      .from('ai_portfolio_selections')
      .select('selected_at')
      .order('selected_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    beforeLastAt = latest?.selected_at ? String(latest.selected_at) : null;
  } catch (e) {
    return NextResponse.json(
      {
        success: false,
        stage: 'pre-snapshot',
        error: e instanceof Error ? e.message : String(e),
        hint: 'Could not read ai_portfolio_selections — table missing? SUPABASE_SERVICE_ROLE_KEY misconfigured?',
      },
      { status: 500 },
    );
  }

  // Now trigger the actual AI selection.
  let result;
  try {
    result = await selectEliteWithAI({
      apiKey: userCreds.apiKey,
      apiSecret: userCreds.apiSecret,
      env: userCreds.environment,
    });
  } catch (e) {
    return NextResponse.json(
      {
        success: false,
        stage: 'select-elite-with-ai',
        elapsedMs: Date.now() - startTime,
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
        beforeSnapshot: { count: beforeCount, lastSelectedAt: beforeLastAt },
      },
      { status: 500 },
    );
  }

  // Snapshot AFTER — confirms the row actually landed + pulls error_message
  // from the latest 5 rows so we can see WHY the fallback fired.
  let afterCount = 0;
  let recentRows: Array<Record<string, unknown>> = [];
  try {
    const sb = createAdminClient();
    const { count } = await sb
      .from('ai_portfolio_selections')
      .select('*', { count: 'exact', head: true });
    afterCount = count ?? 0;
    const { data: rows } = await sb
      .from('ai_portfolio_selections')
      .select('selected_at, source, confidence, failed, error_message, picks')
      .order('selected_at', { ascending: false })
      .limit(5);
    recentRows = (rows ?? []).map((r) => ({
      selected_at: r.selected_at,
      source: r.source,
      confidence: r.confidence,
      failed: r.failed,
      error_message: r.error_message,
      pick_count: Array.isArray(r.picks) ? r.picks.length : 0,
    }));
  } catch {
    /* non-critical */
  }

  return NextResponse.json({
    success: true,
    elapsedMs: Date.now() - startTime,
    aiResult: {
      source: result.source,
      tickers: Array.from(result.tickers),
      thesis: result.thesis,
      confidence: result.confidence,
      riskRead: result.riskRead,
      picks: result.picks,
    },
    persistence: {
      rowsBefore: beforeCount,
      rowsAfter: afterCount,
      newRowLanded: afterCount > beforeCount,
      recentRows,
    },
    diagnosis:
      result.source === 'grok-4-heavy'
        ? 'Grok call succeeded with valid JSON.'
        : `Fell back to Sharpe-math. Latest row error_message: "${
            recentRows[0]?.error_message ?? '(missing)'
          }"`,
    envCheck: {
      XAI_API_KEY: process.env.XAI_API_KEY ? `set (${(process.env.XAI_API_KEY as string).slice(0, 8)}...)` : 'MISSING',
      GROK_MODEL: process.env.GROK_MODEL ?? '(default: grok-4-heavy)',
      ALPACA_DATA_BASE: process.env.ALPACA_DATA_URL ?? '(default)',
    },
    alpacaBarsTest: barsTest,
  });
}

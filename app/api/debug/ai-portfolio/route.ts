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

export async function GET() {
  const userCreds = await getRequestCreds();
  if (!userCreds) {
    return NextResponse.json(
      { error: 'Not signed in to Clerk / no Alpaca creds. Sign in via dashboard first.' },
      { status: 401 },
    );
  }

  const startTime = Date.now();

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

  // Snapshot AFTER — confirms the row actually landed.
  let afterCount = 0;
  let afterLastAt: string | null = null;
  try {
    const sb = createAdminClient();
    const { count } = await sb
      .from('ai_portfolio_selections')
      .select('*', { count: 'exact', head: true });
    afterCount = count ?? 0;
    const { data: latest } = await sb
      .from('ai_portfolio_selections')
      .select('selected_at, source, confidence, failed, error_message')
      .order('selected_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    afterLastAt = latest?.selected_at ? String(latest.selected_at) : null;
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
      lastSelectedAtBefore: beforeLastAt,
      lastSelectedAtAfter: afterLastAt,
    },
    diagnosis:
      result.source === 'grok-4-heavy'
        ? 'Grok call succeeded with valid JSON.'
        : 'Fell back to Sharpe-math. Check error_message in latest row.',
  });
}

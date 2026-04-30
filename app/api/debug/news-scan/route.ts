// Manual diagnostic for the Grok-driven news scanner. Same shape as
// /api/debug/ai-portfolio: triggers a scan immediately, persists, and
// returns before/after row counts + the latest error_messages from
// news_intelligence so we can see why scans are failing.
//
// Hit from a signed-in browser tab:
//   https://apex-quantum.com/api/debug/news-scan
import { NextResponse } from 'next/server';
import { getRequestCreds } from '@/lib/get-request-creds';
import {
  invalidateNewsCache,
  persistNewsIntel,
  scanNews,
} from '@/lib/news-intelligence';
import { createAdminClient } from '@/utils/supabase/admin';

export async function GET() {
  const userCreds = await getRequestCreds();
  if (!userCreds) {
    return NextResponse.json(
      { error: 'Sign in via dashboard first' },
      { status: 401 },
    );
  }

  const startTime = Date.now();

  let beforeCount = 0;
  let beforeLastAt: string | null = null;
  try {
    const sb = createAdminClient();
    const { count } = await sb
      .from('news_intelligence')
      .select('*', { count: 'exact', head: true });
    beforeCount = count ?? 0;
    const { data } = await sb
      .from('news_intelligence')
      .select('scanned_at')
      .order('scanned_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    beforeLastAt = data?.scanned_at ? String(data.scanned_at) : null;
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        stage: 'pre-snapshot',
        error: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }

  const result = await scanNews();
  await persistNewsIntel(result.intel, result.error, result.raw);
  invalidateNewsCache();

  let afterCount = 0;
  let recentRows: Array<Record<string, unknown>> = [];
  try {
    const sb = createAdminClient();
    const { count } = await sb
      .from('news_intelligence')
      .select('*', { count: 'exact', head: true });
    afterCount = count ?? 0;
    const { data } = await sb
      .from('news_intelligence')
      .select('scanned_at, risk_mode, confidence, failed, error_message, summary, ticker_events')
      .order('scanned_at', { ascending: false })
      .limit(5);
    recentRows = (data ?? []).map((r) => ({
      scanned_at: r.scanned_at,
      risk_mode: r.risk_mode,
      confidence: r.confidence,
      failed: r.failed,
      error_message: r.error_message,
      summary_preview:
        typeof r.summary === 'string' ? r.summary.slice(0, 120) : null,
      ticker_event_count: Array.isArray(r.ticker_events) ? r.ticker_events.length : 0,
    }));
  } catch {
    /* non-critical */
  }

  return NextResponse.json({
    ok: result.intel !== null,
    elapsedMs: Date.now() - startTime,
    scanResult: result.intel
      ? {
          riskMode: result.intel.riskMode,
          confidence: result.intel.confidence,
          summary: result.intel.summary,
          sectorBias: result.intel.sectorBias,
          tickerEventCount: result.intel.tickerEvents.length,
        }
      : null,
    error: result.error ?? null,
    persistence: {
      rowsBefore: beforeCount,
      rowsAfter: afterCount,
      newRowLanded: afterCount > beforeCount,
      lastScannedAtBefore: beforeLastAt,
      recentRows,
    },
    diagnosis: result.intel
      ? `Scan succeeded — model returned valid news intel.`
      : `Scan failed. Latest error_message: "${
          recentRows[0]?.error_message ?? '(missing)'
        }"`,
    envCheck: {
      XAI_API_KEY: process.env.XAI_API_KEY
        ? `set (${(process.env.XAI_API_KEY as string).slice(0, 8)}...)`
        : 'MISSING',
      GROK_MODEL_NEWS:
        process.env.GROK_MODEL_NEWS ??
        (process.env.GROK_MODEL
          ? `(via legacy GROK_MODEL: ${process.env.GROK_MODEL})`
          : '(default: grok-4-1-fast-non-reasoning)'),
    },
  });
}

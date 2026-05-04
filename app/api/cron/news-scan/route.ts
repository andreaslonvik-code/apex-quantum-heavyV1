// Vercel Cron — Grok-4-Heavy news + sentiment scan with adaptive cadence.
//
// Cron fires every minute year-round (vercel.json schedule). The route
// then decides whether to actually scan based on market session + last
// scan time:
//
//   - Premarket / regular / afterhours (US equity sessions, ET, 04:00-20:00):
//     Scan if last scan >= 50 s ago. Effective cadence: ~1 min.
//     Catches Trump-tweet / OPEC / Hormuz flow within minutes instead of
//     30+ min. Latency from event → engine reaction drops to ~1-3 min.
//
//   - Market closed (overnight / weekend):
//     Scan if last scan >= 30 min ago. Effective cadence: every 30 min.
//     Catches overnight catalysts without burning per-minute API budget
//     while nothing trades.
//
// Cost note: ~960 calls/weekday during sessions + ~50 closed-hour calls,
// ~21k calls/month at this cadence. Use the closed-hour gate (30 min) to
// avoid burning budget when the engine isn't trading.
//
// Auth: requires Authorization: Bearer ${CRON_SECRET}.
import { NextResponse } from 'next/server';
import {
  invalidateNewsCache,
  persistNewsIntel,
  scanNews,
} from '@/lib/news-intelligence';
import { createAdminClient } from '@/utils/supabase/admin';
import { getMarketSession, isSessionTradable } from '@/lib/market-session';

const SCAN_GAP_OPEN_MS = 50 * 1000;          // 50 s — re-scan ~every minute during sessions
const SCAN_GAP_CLOSED_MS = 30 * 60 * 1000;   // 30 min — re-scan every 30 min when closed

async function getLastScanAt(): Promise<Date | null> {
  try {
    const sb = createAdminClient();
    const { data } = await sb
      .from('news_intelligence')
      .select('scanned_at')
      .order('scanned_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data?.scanned_at) return null;
    return new Date(String(data.scanned_at));
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  // We don't have an Alpaca creds object handy in this cron — pass null
  // clock; getMarketSession falls back to ET wall-clock classification.
  const session = getMarketSession(null, now);
  const tradable = isSessionTradable(session);
  const minGap = tradable ? SCAN_GAP_OPEN_MS : SCAN_GAP_CLOSED_MS;

  const lastScanAt = await getLastScanAt();
  if (lastScanAt) {
    const sinceLastMs = now.getTime() - lastScanAt.getTime();
    if (sinceLastMs < minGap) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: `Last scan ${Math.round(sinceLastMs / 60_000)} min ago, min gap ${Math.round(minGap / 60_000)} min in ${session} session`,
        session,
      });
    }
  }

  const startTime = Date.now();
  const result = await scanNews();
  await persistNewsIntel(result.intel, result.error, result.raw);
  invalidateNewsCache();

  const elapsed = Date.now() - startTime;
  if (!result.intel) {
    console.error(`[NEWS-CRON] Scan failed in ${elapsed}ms — ${result.error ?? 'unknown'}`);
    return NextResponse.json(
      { success: false, elapsedMs: elapsed, session, error: result.error ?? 'unknown' },
      { status: 500 },
    );
  }

  console.log(
    `[NEWS-CRON] OK in ${elapsed}ms — session=${session} riskMode=${result.intel.riskMode} ` +
    `confidence=${result.intel.confidence} sectors=${Object.keys(result.intel.sectorBias).length} ` +
    `events=${result.intel.tickerEvents.length}`
  );

  return NextResponse.json({
    success: true,
    elapsedMs: elapsed,
    session,
    riskMode: result.intel.riskMode,
    confidence: result.intel.confidence,
    sectorsBiased: Object.keys(result.intel.sectorBias).length,
    tickerEvents: result.intel.tickerEvents.length,
    summary: result.intel.summary,
  });
}

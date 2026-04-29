// Vercel Cron — Grok-4-Heavy news + sentiment scan with adaptive cadence.
//
// Cron fires every 30 min year-round (vercel.json schedule). The route
// then decides whether to actually scan based on market session + last
// scan time:
//
//   - Premarket / regular / afterhours (US equity sessions, ET):
//     Scan if last scan >= 25 min ago. Effective cadence: every 30 min.
//     Captures intra-session news flow that drives same-day price action.
//
//   - Market closed (overnight / weekend):
//     Scan if last scan >= 55 min ago. Effective cadence: hourly.
//     Catches overnight catalysts (Asia open, geopolitical events,
//     after-hours earnings) that move the next session's open.
//
// This shape gives ~40 calls/day instead of 288 if we naively ran every
// 5 min — reasonable cost while still catching market-hours news flow.
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

const SCAN_GAP_OPEN_MS = 25 * 60 * 1000;     // 25 min — re-scan after 25+ min during sessions
const SCAN_GAP_CLOSED_MS = 55 * 60 * 1000;   // 55 min — re-scan after 55+ min when closed

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

/**
 * Vercel Cron — hourly news + sentiment scan via Grok-4-Heavy.
 *
 * Calls scanNews() once globally per hour (shared across all users), parses
 * the structured response via Zod, and persists to the news_intelligence
 * table. The trading engine reads the latest non-failed scan at the start
 * of each per-minute trading scan and uses it to bias BUY scoring.
 *
 * Schedule: every hour at minute 5 (set in vercel.json) — minute 5 instead
 * of minute 0 so we land after the regular trading cron has finished its
 * pre-market or first-minute work.
 *
 * Auth: requires `Authorization: Bearer ${CRON_SECRET}`.
 */
import { NextResponse } from 'next/server';
import {
  invalidateNewsCache,
  persistNewsIntel,
  scanNews,
} from '@/lib/news-intelligence';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const result = await scanNews();
  await persistNewsIntel(result.intel, result.error, result.raw);
  invalidateNewsCache();

  const elapsed = Date.now() - startTime;
  if (!result.intel) {
    console.error(`[NEWS-CRON] Scan failed in ${elapsed}ms — ${result.error ?? 'unknown'}`);
    return NextResponse.json(
      { success: false, elapsedMs: elapsed, error: result.error ?? 'unknown' },
      { status: 500 },
    );
  }

  console.log(
    `[NEWS-CRON] OK in ${elapsed}ms — riskMode=${result.intel.riskMode} confidence=${result.intel.confidence} ` +
    `sectors=${Object.keys(result.intel.sectorBias).length} events=${result.intel.tickerEvents.length}`
  );

  return NextResponse.json({
    success: true,
    elapsedMs: elapsed,
    riskMode: result.intel.riskMode,
    confidence: result.intel.confidence,
    sectorsBiased: Object.keys(result.intel.sectorBias).length,
    tickerEvents: result.intel.tickerEvents.length,
    summary: result.intel.summary,
  });
}

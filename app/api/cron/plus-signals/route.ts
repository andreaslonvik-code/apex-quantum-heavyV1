import { NextResponse, type NextRequest } from 'next/server';
import { generateDailySignals } from '@/lib/grok-plus';
import { startScan, finishScanSuccess, finishScanFailed } from '@/lib/plus-db';
import { fetchQuotes } from '@/lib/yahoo-finance';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Daily Plus signal scan. Triggered by Vercel cron at 06:00 UTC.
 * Calls Grok with the Plus blueprint, validates the JSON payload,
 * and persists scan + signals to Supabase.
 */
export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${expected}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  const startedAt = Date.now();
  let scanId: string | null = null;
  try {
    scanId = await startScan();
    const result = await generateDailySignals();
    if (!result.ok) {
      await finishScanFailed(scanId, result.error || 'unknown', Date.now() - startedAt);
      return NextResponse.json(
        { ok: false, scanId, error: result.error },
        { status: 502 },
      );
    }

    // Capture price-at-signal so the dashboard can show change-since-signal
    // and the track-record can compute hit-rate. Failures here are non-fatal:
    // we still ship the signals, just without enriched prices.
    const signals = result.signals || [];
    const tickers = Array.from(new Set(signals.map((s) => s.ticker)));
    const quotes = await fetchQuotes(tickers);
    for (const s of signals) {
      const q = quotes[s.ticker.toUpperCase()];
      if (q) {
        s.price_at_signal = q.price;
        s.price_currency = q.currency;
      }
    }

    await finishScanSuccess(scanId, {
      scanSummary: result.scanSummary || '',
      scanSummaryEn: result.scanSummaryEn ?? null,
      signals,
      durationMs: Date.now() - startedAt,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      numSourcesUsed: result.numSourcesUsed,
    });

    return NextResponse.json({
      ok: true,
      scanId,
      signalCount: result.signals?.length ?? 0,
      durationMs: Date.now() - startedAt,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (scanId) {
      try {
        await finishScanFailed(scanId, msg, Date.now() - startedAt);
      } catch {
        /* ignore — we'll still return the original error below */
      }
    }
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

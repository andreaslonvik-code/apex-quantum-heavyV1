import { NextResponse, type NextRequest } from 'next/server';
import { mirrorMaxDecisionsToPlus } from '@/lib/plus-mirror';
import { resolveLeaderClerkId } from '@/lib/leader';
import { startScan, finishScanSuccess, finishScanFailed } from '@/lib/plus-db';
import { fetchQuotes } from '@/lib/yahoo-finance';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Plus signal mirror cron. Reads the leader's latest Max trading decision
 * (stocks blueprint) and reshapes it into Plus signal cards.
 *
 * Previously this called Grok directly with live web/X-search (≈$200/mnd).
 * Now it just transforms the leader's existing decision — zero Grok spend,
 * and Plus subscribers see the exact same calls that drive Max trading.
 * See `lib/plus-mirror.ts` for the mapping and trade-offs.
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

    const leaderId = await resolveLeaderClerkId();
    if (!leaderId) {
      // Couldn't resolve the leader at all (Clerk down, env unset, no cache).
      // Fail the scan rather than write empty signals; cron will retry next
      // hour and Plus dashboard keeps showing the last successful scan.
      await finishScanFailed(scanId, 'leader_unresolved', Date.now() - startedAt);
      return NextResponse.json(
        { ok: false, scanId, error: 'leader_unresolved' },
        { status: 503 },
      );
    }

    const result = await mirrorMaxDecisionsToPlus(leaderId);
    if (!result.ok) {
      await finishScanFailed(scanId, result.error || 'unknown', Date.now() - startedAt);
      return NextResponse.json(
        { ok: false, scanId, error: result.error },
        { status: 502 },
      );
    }

    // Price-at-signal lets the dashboard render change-since-signal and the
    // track-record compute hit-rate. Failures are non-fatal — ship signals
    // without enriched prices rather than blocking the scan.
    const signals = result.signals || [];
    const tickers = Array.from(new Set(signals.map((s) => s.ticker)));
    if (tickers.length > 0) {
      const quotes = await fetchQuotes(tickers);
      for (const s of signals) {
        const q = quotes[s.ticker.toUpperCase()];
        if (q) {
          s.price_at_signal = q.price;
          s.price_currency = q.currency;
        }
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
      leaderId,
      signalCount: signals.length,
      mirrorMode: true,
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

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { hasPlusAccess } from '@/lib/access';
import { getLatestScan } from '@/lib/plus-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Returns the latest successful Plus scan + its signals, or `null` when no
 * scan exists yet (UI falls back to seed data). Daily cron at 06:00 UTC
 * populates this; subsequent visits hit the cached row.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!(await hasPlusAccess())) {
    return NextResponse.json({ error: 'beta_only' }, { status: 403 });
  }

  try {
    const result = await getLatestScan();
    if (!result) {
      return NextResponse.json({ ok: true, scan: null, signals: [] });
    }
    return NextResponse.json({
      ok: true,
      scan: {
        id: result.scan.id,
        generatedAt: result.scan.generated_at,
        scanSummary: result.scan.scan_summary,
        signalCount: result.scan.signal_count,
      },
      signals: result.signals.map((s) => ({
        id: s.id,
        ticker: s.ticker,
        region: s.region,
        action: s.action,
        confidence: s.confidence,
        timeHorizon: s.time_horizon,
        reasoning: s.reasoning,
        catalysts: s.catalysts ?? [],
        risks: s.risks ?? [],
        peerComparison: s.peer_comparison,
        insiderSignal: s.insider_signal,
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { hasPlusAccess } from '@/lib/access';
import { getLatestScan } from '@/lib/plus-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Returns the latest successful Plus scan + its signals, or `null` when no
 * scan exists yet (UI falls back to seed data).
 *
 * `?lang=en` returns English content (with NO fallback for any field where
 * English isn't yet populated, e.g. legacy rows from before the bilingual
 * migration). Default is `no`.
 */
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!(await hasPlusAccess())) {
    return NextResponse.json({ error: 'beta_only' }, { status: 403 });
  }

  const wantEn = req.nextUrl.searchParams.get('lang') === 'en';

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
        scanSummary: wantEn
          ? (result.scan.scan_summary_en ?? result.scan.scan_summary)
          : result.scan.scan_summary,
        signalCount: result.scan.signal_count,
      },
      signals: result.signals.map((s) => ({
        id: s.id,
        ticker: s.ticker,
        region: s.region,
        action: s.action,
        confidence: s.confidence,
        timeHorizon: s.time_horizon,
        reasoning: wantEn ? (s.reasoning_en ?? s.reasoning) : s.reasoning,
        catalysts: wantEn
          ? ((s.catalysts_en && s.catalysts_en.length > 0 ? s.catalysts_en : s.catalysts) ?? [])
          : (s.catalysts ?? []),
        risks: wantEn
          ? ((s.risks_en && s.risks_en.length > 0 ? s.risks_en : s.risks) ?? [])
          : (s.risks ?? []),
        peerComparison: wantEn
          ? (s.peer_comparison_en ?? s.peer_comparison)
          : s.peer_comparison,
        insiderSignal: wantEn ? (s.insider_signal_en ?? s.insider_signal) : s.insider_signal,
        priceAtSignal: s.price_at_signal,
        priceCurrency: s.price_currency,
        createdAt: s.created_at,
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

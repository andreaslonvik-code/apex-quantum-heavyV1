/**
 * Public read-only timeline of the leader cockpit's Grok decisions.
 *
 * Powers the /innsyn page (transparency view for prospects). Exposes only
 * what's safe to publish: decision text, per-ticker action + outcome, and
 * how many live-search sources Grok consumed. Does NOT expose the leader's
 * clerk_user_id, raw response bodies (may contain prompt instructions),
 * token-billing fields, or any user-identifying data.
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { resolveLeaderClerkId } from '@/lib/leader';
import type { GrokDecision } from '@/lib/grok';
import type { TradeOutcome } from '@/lib/grok-decisions';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface PublicDecisionRow {
  id: number;
  blueprintId: 'stocks' | 'crypto' | 'commodities';
  decidedAt: string;
  thesis: string | null;
  decisions: GrokDecision[];
  tradeOutcomes: TradeOutcome[];
  /** Live-search source count Grok consumed for this call. */
  sourcesUsed: number | null;
  failed: boolean;
}

interface DbRow {
  id: number;
  blueprint_id: string;
  decided_at: string;
  thesis: string | null;
  decisions: unknown;
  trade_outcomes: unknown;
  raw_response: unknown;
  failed: boolean;
}

function extractSourcesUsed(raw: unknown): number | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as { usage?: { num_sources_used?: unknown } };
  const n = r.usage?.num_sources_used;
  return typeof n === 'number' ? n : null;
}

export async function GET() {
  const leaderId = await resolveLeaderClerkId();
  if (!leaderId) {
    return NextResponse.json({ ok: false, rows: [] }, { status: 503 });
  }
  try {
    const sb = createAdminClient();
    const { data, error } = await sb
      .from('grok_decisions')
      .select('id, blueprint_id, decided_at, thesis, decisions, trade_outcomes, raw_response, failed')
      .eq('clerk_user_id', leaderId)
      .order('decided_at', { ascending: false })
      .limit(40);

    if (error || !data) {
      return NextResponse.json({ ok: false, rows: [] }, { status: 500 });
    }

    const rows: PublicDecisionRow[] = (data as DbRow[]).map((row) => ({
      id: row.id,
      blueprintId: row.blueprint_id as PublicDecisionRow['blueprintId'],
      decidedAt: row.decided_at,
      thesis: row.thesis,
      decisions: Array.isArray(row.decisions) ? (row.decisions as GrokDecision[]) : [],
      tradeOutcomes: Array.isArray(row.trade_outcomes) ? (row.trade_outcomes as TradeOutcome[]) : [],
      sourcesUsed: extractSourcesUsed(row.raw_response),
      failed: row.failed,
    }));

    return NextResponse.json(
      { ok: true, rows, asOfIso: new Date().toISOString() },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
    );
  } catch {
    return NextResponse.json({ ok: false, rows: [] }, { status: 500 });
  }
}

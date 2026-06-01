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
import type { GrokCatalyst, GrokDecision } from '@/lib/grok';
import type { TradeOutcome } from '@/lib/grok-decisions';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

/** Public-safe trade-outcome view. H8 fix — the internal TradeOutcome's
 *  `error` field is raw Alpaca/engine output (may contain order IDs,
 *  account numbers, RLS hints). Publish a stable error_code only. */
interface PublicTradeOutcome {
  ticker: string;
  action: 'BUY' | 'SELL';
  status: 'OK' | 'ERR' | 'SKIP';
  notional: number;
  qty: number;
  reason: string;
  error_code?: string;
}

interface PublicDecisionRow {
  id: number;
  blueprintId: 'stocks' | 'crypto' | 'commodities';
  decidedAt: string;
  thesis: string | null;
  decisions: GrokDecision[];
  tradeOutcomes: PublicTradeOutcome[];
  catalysts: GrokCatalyst[];
  /** Live-search source count Grok consumed for this call. */
  sourcesUsed: number | null;
  failed: boolean;
}

/** Convert an internal Alpaca/engine error string to a coarse public code.
 *  Never echo the raw message — it can leak order IDs, account numbers,
 *  RLS hints, or anything Alpaca added to the rejection body. */
function classifyOutcomeError(error: string | undefined): string | undefined {
  if (!error) return undefined;
  const e = error.toLowerCase();
  if (e.includes('insufficient') || e.includes('buying power') || e.includes('bp')) return 'insufficient_buying_power';
  if (e.includes('rate limit') || e.includes('429')) return 'rate_limited';
  if (e.includes('not tradable') || e.includes('halted') || e.includes('suspended')) return 'symbol_unavailable';
  if (e.includes('no position') || e.includes('not found')) return 'no_position';
  if (e.includes('pdt') || e.includes('day trad')) return 'pdt_restriction';
  if (e.includes('extended hours') || e.includes('market closed')) return 'market_closed';
  return 'rejected';
}

interface DbRow {
  id: number;
  blueprint_id: string;
  decided_at: string;
  thesis: string | null;
  decisions: unknown;
  trade_outcomes: unknown;
  catalysts?: unknown;
  raw_response: unknown;
  failed: boolean;
}

function extractSourcesUsed(raw: unknown): number | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as { usage?: { num_sources_used?: unknown } };
  const n = r.usage?.num_sources_used;
  return typeof n === 'number' ? n : null;
}

/** Postgres SQLSTATE 42703 = undefined_column; PostgREST surfaces missing
 *  columns as code 'PGRST204' (schema cache) before the query hits Postgres.
 *  Either means the catalysts column hasn't been migrated yet — retry the
 *  SELECT without it so the page stays alive. */
function isCatalystsColumnMissing(err: { code?: string; message?: string }): boolean {
  if (err.code === '42703' || err.code === 'PGRST204') return true;
  if (err.message && /catalysts/i.test(err.message) && /column|schema/i.test(err.message)) {
    return true;
  }
  return false;
}

const SELECT_WITH_CATALYSTS =
  'id, blueprint_id, decided_at, thesis, decisions, trade_outcomes, catalysts, raw_response, failed';
const SELECT_WITHOUT_CATALYSTS =
  'id, blueprint_id, decided_at, thesis, decisions, trade_outcomes, raw_response, failed';

export async function GET() {
  const leaderId = await resolveLeaderClerkId();
  if (!leaderId) {
    return NextResponse.json({ ok: false, rows: [] }, { status: 503 });
  }
  try {
    const sb = createAdminClient();
    const first = await sb
      .from('grok_decisions')
      .select(SELECT_WITH_CATALYSTS)
      .eq('clerk_user_id', leaderId)
      .order('decided_at', { ascending: false })
      .limit(80);

    // Fallback: catalysts column not yet migrated — re-query without it so
    // /innsyn renders the rest of the row (decisions + thesis still useful).
    let data: unknown = first.data;
    let error = first.error;
    if (error && isCatalystsColumnMissing(error)) {
      const retry = await sb
        .from('grok_decisions')
        .select(SELECT_WITHOUT_CATALYSTS)
        .eq('clerk_user_id', leaderId)
        .order('decided_at', { ascending: false })
        .limit(80);
      data = retry.data;
      error = retry.error;
    }

    if (error || !data || !Array.isArray(data)) {
      return NextResponse.json({ ok: false, rows: [] }, { status: 500 });
    }

    const rows: PublicDecisionRow[] = (data as DbRow[]).map((row) => ({
      id: row.id,
      blueprintId: row.blueprint_id as PublicDecisionRow['blueprintId'],
      decidedAt: row.decided_at,
      thesis: row.thesis,
      decisions: Array.isArray(row.decisions) ? (row.decisions as GrokDecision[]) : [],
      tradeOutcomes: Array.isArray(row.trade_outcomes)
        ? (row.trade_outcomes as TradeOutcome[]).map((o) => {
            const code = classifyOutcomeError(o.error);
            return {
              ticker: o.ticker,
              action: o.action,
              status: o.status,
              notional: o.notional,
              qty: o.qty,
              reason: o.reason,
              ...(code ? { error_code: code } : {}),
            };
          })
        : [],
      catalysts: Array.isArray(row.catalysts) ? (row.catalysts as GrokCatalyst[]) : [],
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

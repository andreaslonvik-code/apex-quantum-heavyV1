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
  /** H10 — read num_sources_used as its own column instead of parsing
   *  the full raw_response blob (~50-150 KB/row, 80 rows = 4-12 MB
   *  transfer for one timeline request). Older rows that pre-date this
   *  column fall through to parsing raw_response. */
  num_sources_used: number | null;
  raw_response: unknown;
  failed: boolean;
}

function extractSourcesUsed(row: DbRow): number | null {
  if (typeof row.num_sources_used === 'number') return row.num_sources_used;
  if (!row.raw_response || typeof row.raw_response !== 'object') return null;
  const r = row.raw_response as { usage?: { num_sources_used?: unknown } };
  const n = r.usage?.num_sources_used;
  return typeof n === 'number' ? n : null;
}

/** Postgres SQLSTATE 42703 = undefined_column; PostgREST surfaces missing
 *  columns as code 'PGRST204' (schema cache) before the query hits Postgres.
 *  Either means a post-2026-06-01 migration hasn't been applied yet —
 *  retry the SELECT with a stripped column list so the page stays alive. */
function isMissingNewColumn(err: { code?: string; message?: string }): boolean {
  if (err.code === '42703' || err.code === 'PGRST204') return true;
  if (
    err.message &&
    /(catalysts|num_sources_used)/i.test(err.message) &&
    /column|schema/i.test(err.message)
  ) {
    return true;
  }
  return false;
}

// H10 — `num_sources_used` is the new column populated by saveDecision
// instead of the entire raw_response blob; SELECT both for back-compat on
// rows written before the migration ran. Three escalating SELECT variants
// so a partial migration (catalysts present but num_sources_used not yet,
// or vice versa) still renders the page.
const SELECT_FULL =
  'id, blueprint_id, decided_at, thesis, decisions, trade_outcomes, catalysts, num_sources_used, raw_response, failed';
const SELECT_NO_NUM_SOURCES =
  'id, blueprint_id, decided_at, thesis, decisions, trade_outcomes, catalysts, raw_response, failed';
const SELECT_LEGACY =
  'id, blueprint_id, decided_at, thesis, decisions, trade_outcomes, raw_response, failed';

export async function GET() {
  const leaderId = await resolveLeaderClerkId();
  if (!leaderId) {
    return NextResponse.json({ ok: false, rows: [] }, { status: 503 });
  }
  try {
    const sb = createAdminClient();
    const querySelects = [SELECT_FULL, SELECT_NO_NUM_SOURCES, SELECT_LEGACY];
    let data: unknown = null;
    let error: { code?: string; message?: string } | null = null;
    for (const sel of querySelects) {
      const r = await sb
        .from('grok_decisions')
        .select(sel)
        .eq('clerk_user_id', leaderId)
        .order('decided_at', { ascending: false })
        .limit(80);
      if (!r.error) {
        data = r.data;
        error = null;
        break;
      }
      if (!isMissingNewColumn(r.error)) {
        error = r.error;
        break;
      }
      // Else: this select failed because a new column is missing; try the
      // next-most-stripped select.
      error = r.error;
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
      sourcesUsed: extractSourcesUsed(row),
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

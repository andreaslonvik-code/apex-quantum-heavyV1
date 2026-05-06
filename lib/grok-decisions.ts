import { createAdminClient } from '@/utils/supabase/admin';
import type { AssetClass } from './blueprints';
import type { GrokDecision, GrokUsage } from './grok';

export interface TradeOutcome {
  ticker: string;
  action: 'BUY' | 'SELL';
  status: 'OK' | 'ERR' | 'SKIP';
  notional: number;
  qty: number;
  reason: string;
  error?: string;
}

export interface GrokDecisionRow {
  id: number;
  clerkUserId: string;
  blueprintId: AssetClass;
  decidedAt: string;
  thesis: string | null;
  decisions: GrokDecision[];
  tradeOutcomes: TradeOutcome[];
  promptTokens: number | null;
  outputTokens: number | null;
  failed: boolean;
  errorMessage: string | null;
}

interface DbRow {
  id: number;
  clerk_user_id: string;
  blueprint_id: string;
  decided_at: string;
  thesis: string | null;
  decisions: unknown;
  trade_outcomes: unknown;
  prompt_tokens: number | null;
  output_tokens: number | null;
  failed: boolean;
  error_message: string | null;
}

function rowToDecision(row: DbRow): GrokDecisionRow {
  return {
    id: row.id,
    clerkUserId: row.clerk_user_id,
    blueprintId: row.blueprint_id as AssetClass,
    decidedAt: row.decided_at,
    thesis: row.thesis,
    decisions: Array.isArray(row.decisions) ? (row.decisions as GrokDecision[]) : [],
    tradeOutcomes: Array.isArray(row.trade_outcomes) ? (row.trade_outcomes as TradeOutcome[]) : [],
    promptTokens: row.prompt_tokens,
    outputTokens: row.output_tokens,
    failed: row.failed,
    errorMessage: row.error_message,
  };
}

export async function getLatestDecision(
  clerkUserId: string,
  blueprintId: AssetClass,
): Promise<GrokDecisionRow | null> {
  try {
    const sb = createAdminClient();
    const { data, error } = await sb
      .from('grok_decisions')
      .select('*')
      .eq('clerk_user_id', clerkUserId)
      .eq('blueprint_id', blueprintId)
      .order('decided_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return rowToDecision(data as DbRow);
  } catch {
    return null;
  }
}

/** Latest decision per blueprint for one user — used by the dashboard card. */
export async function getLatestDecisionsForUser(
  clerkUserId: string,
): Promise<Partial<Record<AssetClass, GrokDecisionRow>>> {
  const out: Partial<Record<AssetClass, GrokDecisionRow>> = {};
  for (const id of ['stocks', 'crypto', 'commodities'] as AssetClass[]) {
    const r = await getLatestDecision(clerkUserId, id);
    if (r) out[id] = r;
  }
  return out;
}

/**
 * Tickers that had a mechanical-stop SELL in the recent past — used by the
 * engine to enforce a cool-down period before re-entering the same name.
 * Whipsaw protection (bought-stopped-bought-stopped on same ticker is one of
 * the most reliable ways to bleed gains).
 *
 * `lookbackDays` is calendar days, not trading days, for simplicity.
 */
export async function getRecentStopOutTickers(
  clerkUserId: string,
  blueprintId: AssetClass,
  lookbackDays = 5,
): Promise<Set<string>> {
  const out = new Set<string>();
  try {
    const sb = createAdminClient();
    const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await sb
      .from('grok_decisions')
      .select('trade_outcomes')
      .eq('clerk_user_id', clerkUserId)
      .eq('blueprint_id', blueprintId)
      .gte('decided_at', since)
      .limit(200);
    if (error || !data) return out;
    for (const row of data as Array<{ trade_outcomes: unknown }>) {
      const outcomes = Array.isArray(row.trade_outcomes)
        ? (row.trade_outcomes as TradeOutcome[])
        : [];
      for (const o of outcomes) {
        if (o.action !== 'SELL' || o.status !== 'OK') continue;
        if (!o.reason) continue;
        if (
          o.reason.startsWith('MECHANICAL_ATR_STOP') ||
          o.reason.startsWith('MECHANICAL_TRAILING_STOP')
        ) {
          out.add(o.ticker);
        }
      }
    }
  } catch {
    // Soft-fail: cool-down is a defense-in-depth layer, not safety-critical.
  }
  return out;
}

interface SaveInput {
  clerkUserId: string;
  blueprintId: AssetClass;
  thesis: string;
  decisions: GrokDecision[];
  tradeOutcomes?: TradeOutcome[];
  usage?: GrokUsage;
  rawResponse: unknown;
  failed?: boolean;
  errorMessage?: string;
}

export async function saveDecision(input: SaveInput): Promise<void> {
  try {
    const sb = createAdminClient();
    const { error } = await sb.from('grok_decisions').insert({
      clerk_user_id: input.clerkUserId,
      blueprint_id: input.blueprintId,
      thesis: input.thesis || null,
      decisions: input.decisions,
      trade_outcomes: input.tradeOutcomes ?? [],
      prompt_tokens: input.usage?.prompt_tokens ?? null,
      output_tokens: input.usage?.completion_tokens ?? null,
      raw_response: input.rawResponse ?? null,
      failed: input.failed ?? false,
      error_message: input.errorMessage ?? null,
    });
    if (error) console.error('[grok-decisions] insert error:', error.message);
  } catch (e) {
    console.error('[grok-decisions] save exception:', e);
  }
}

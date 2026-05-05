import { createAdminClient } from '@/utils/supabase/admin';
import type { AssetClass } from './blueprints';
import type { GrokDecision, GrokUsage } from './grok';

export interface GrokDecisionRow {
  id: number;
  clerkUserId: string;
  blueprintId: AssetClass;
  decidedAt: string;
  thesis: string | null;
  decisions: GrokDecision[];
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

interface SaveInput {
  clerkUserId: string;
  blueprintId: AssetClass;
  thesis: string;
  decisions: GrokDecision[];
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

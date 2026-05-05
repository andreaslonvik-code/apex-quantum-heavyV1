/**
 * xAI Grok client. Used by the trading engine to translate blueprint
 * strategy text + live market context into BUY/SELL/HOLD decisions.
 *
 * Auth: bearer XAI_API_KEY (env var, server-only).
 * Endpoint: https://api.x.ai/v1/chat/completions (OpenAI-compatible).
 */

const GROK_ENDPOINT = 'https://api.x.ai/v1/chat/completions';
// xAI's API exposes `grok-4` (alias to grok-4-0709). The "Heavy" variant is
// gated behind SuperGrok and not always callable via standard API.
// Read XAI_MODEL first, fall back to GROK_MODEL (legacy name), then default
// to `grok-4`.
const DEFAULT_MODEL =
  process.env.XAI_MODEL ?? process.env.GROK_MODEL ?? 'grok-4';
// 3 min — Grok-4-Heavy and complex prompts can take 60–120s.
const REQUEST_TIMEOUT_MS = 180_000;

export type GrokAction = 'BUY' | 'SELL' | 'HOLD';

export interface GrokDecision {
  ticker: string;
  action: GrokAction;
  /** USD notional to deploy on a BUY. Ignored for SELL/HOLD. */
  notional_usd?: number;
  reason: string;
}

export interface GrokDecisionPayload {
  thesis: string;
  decisions: GrokDecision[];
}

export type GrokResult =
  | { success: true; payload: GrokDecisionPayload; raw: unknown; usage?: GrokUsage }
  | { success: false; error: string; raw?: unknown };

export interface GrokUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

interface ChatRequest {
  systemPrompt: string;
  userPrompt: string;
  model?: string;
}

/**
 * Call Grok with a system + user prompt and parse the JSON response into a
 * decision payload. Returns a discriminated-union result — never throws.
 */
export async function decide(req: ChatRequest): Promise<GrokResult> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return { success: false, error: 'XAI_API_KEY not set' };

  const model = req.model ?? DEFAULT_MODEL;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  let raw: unknown;
  try {
    res = await fetch(GROK_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: ctrl.signal,
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: req.systemPrompt },
          { role: 'user', content: req.userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.4,
      }),
    });
  } catch (e) {
    clearTimeout(timer);
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
  clearTimeout(timer);

  let text = '';
  try {
    text = await res.text();
    raw = text ? JSON.parse(text) : null;
  } catch (e) {
    return { success: false, error: `JSON parse: ${e instanceof Error ? e.message : String(e)}`, raw: text };
  }

  if (!res.ok) {
    const msg = (raw as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`;
    return { success: false, error: msg, raw };
  }

  const json = raw as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: GrokUsage;
  };
  const content = json.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    return { success: false, error: 'No string content in Grok response', raw };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    return {
      success: false,
      error: `Grok returned non-JSON content: ${e instanceof Error ? e.message : String(e)}`,
      raw: { ...json, content_preview: content.slice(0, 500) },
    };
  }

  const validated = validatePayload(parsed);
  if (!validated.ok) return { success: false, error: validated.error, raw };

  return { success: true, payload: validated.payload, raw, usage: json.usage };
}

function validatePayload(
  v: unknown,
): { ok: true; payload: GrokDecisionPayload } | { ok: false; error: string } {
  if (!v || typeof v !== 'object') return { ok: false, error: 'payload not an object' };
  const obj = v as Record<string, unknown>;
  const thesis = typeof obj.thesis === 'string' ? obj.thesis : '';
  const rawDecisions = Array.isArray(obj.decisions) ? obj.decisions : [];
  const decisions: GrokDecision[] = [];
  for (const d of rawDecisions) {
    if (!d || typeof d !== 'object') continue;
    const o = d as Record<string, unknown>;
    const ticker = typeof o.ticker === 'string' ? o.ticker.trim().toUpperCase() : '';
    const actionRaw = typeof o.action === 'string' ? o.action.trim().toUpperCase() : '';
    if (!ticker || !['BUY', 'SELL', 'HOLD'].includes(actionRaw)) continue;
    const action = actionRaw as GrokAction;
    const notional =
      typeof o.notional_usd === 'number' && Number.isFinite(o.notional_usd) && o.notional_usd > 0
        ? o.notional_usd
        : undefined;
    const reason = typeof o.reason === 'string' ? o.reason : '';
    decisions.push({
      ticker: ticker.replace('-', '/'),
      action,
      ...(notional !== undefined ? { notional_usd: notional } : {}),
      reason,
    });
  }
  return { ok: true, payload: { thesis, decisions } };
}

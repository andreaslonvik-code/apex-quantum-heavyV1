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
// 5 min — matches Vercel function maxDuration. Grok-4 reasoning can take
// 2–4 min on large prompts (e.g. stocks watchlist with 46 tickers).
const REQUEST_TIMEOUT_MS = 290_000;

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
  /** Number of live-search sources Grok consumed for this call. */
  num_sources_used?: number;
}

interface ChatRequest {
  systemPrompt: string;
  userPrompt: string;
  model?: string;
}

/**
 * Call Grok with a system + user prompt and parse the JSON response into a
 * decision payload. Returns a discriminated-union result — never throws.
 *
 * Retries on transient xAI overload responses (HTTP 429 / 503) with
 * exponential backoff up to 3 attempts. Other errors fail fast.
 */
export async function decide(req: ChatRequest): Promise<GrokResult> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return { success: false, error: 'XAI_API_KEY not set' };

  const model = req.model ?? DEFAULT_MODEL;
  const maxAttempts = 3;
  let lastError: GrokResult | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const r = await callOnce(apiKey, model, req);
    if (r.success) return r;

    lastError = r;
    // Only retry on transient overload signatures.
    const transient =
      typeof r.error === 'string' &&
      (r.error.includes('HTTP 503') ||
        r.error.includes('HTTP 429') ||
        r.error.includes('at capacity') ||
        r.error.includes('temporarily unavailable'));
    if (!transient || attempt === maxAttempts) break;

    // Exponential backoff: 5s, 12s, 25s (with small jitter).
    const baseMs = [5_000, 12_000, 25_000][attempt - 1] ?? 30_000;
    const jitter = Math.floor(Math.random() * 2_000);
    await new Promise((resolve) => setTimeout(resolve, baseMs + jitter));
  }

  return lastError ?? { success: false, error: 'unknown' };
}

async function callOnce(
  apiKey: string,
  model: string,
  req: ChatRequest,
): Promise<GrokResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  let raw: unknown;
  let rawText = '';
  try {
    // Reasoning models on xAI (grok-4) do not accept `temperature` — drop it.
    //
    // Live data is currently OFF. xAI deprecated `search_parameters` and
    // `live_search` tool variants on the chat completions endpoint, and
    // their new Agent Tools API (web_search/x_search/code_interpreter)
    // appears to be exposed only through the Responses API
    // (https://docs.x.ai/docs/guides/tools/overview), which uses a
    // different endpoint + schema. Migration is a separate task. For now
    // Grok answers from training data only.
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
      }),
    });
  } catch (e) {
    clearTimeout(timer);
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
  clearTimeout(timer);

  try {
    rawText = await res.text();
    raw = rawText ? JSON.parse(rawText) : null;
  } catch (e) {
    return {
      success: false,
      error: `non-JSON body (${res.status}): ${rawText.slice(0, 500)} — parse: ${e instanceof Error ? e.message : String(e)}`,
      raw: rawText,
    };
  }

  if (!res.ok) {
    const errObj = (raw as { error?: { message?: string; code?: string; type?: string } })?.error;
    const detail =
      errObj?.message ??
      (typeof raw === 'object' && raw
        ? JSON.stringify(raw).slice(0, 500)
        : rawText.slice(0, 500));
    return { success: false, error: `HTTP ${res.status}: ${detail}`, raw };
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

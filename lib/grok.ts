/**
 * xAI Grok client — uses the Responses API (`/v1/responses`) so we can
 * enable built-in Agent Tools (web_search, x_search) for live data parity
 * with the user's Grok chat experience.
 *
 * Auth: bearer XAI_API_KEY (env var, server-only).
 */

const GROK_ENDPOINT = 'https://api.x.ai/v1/responses';
const FALLBACK_MODEL = 'grok-4';
// Resolve the API model name. Read XAI_MODEL or legacy GROK_MODEL env var,
// but force-coerce any "heavy" variant down to `grok-4` because the Heavy
// multi-agent variant is not callable on the public API tier (HTTP 400
// "Model not found"). The Grok web/app chat uses Heavy via SuperGrok, but
// API access requires a different tier.
const PRIMARY_MODEL = ((): string => {
  const fromEnv = process.env.XAI_MODEL ?? process.env.GROK_MODEL;
  if (!fromEnv) return FALLBACK_MODEL;
  if (fromEnv.toLowerCase().includes('heavy')) {
    console.warn(
      `[grok] env var requested "${fromEnv}" but that variant is not API-callable. Using ${FALLBACK_MODEL} instead.`,
    );
    return FALLBACK_MODEL;
  }
  return fromEnv;
})();
// 5 min — matches Vercel function maxDuration. Grok-4-Heavy reasoning + tool
// loops can take 2–4 min on large prompts.
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
 * - Retries on transient xAI overload (HTTP 429 / 503) with exponential backoff.
 * - Falls back from the configured model to `grok-4` if the primary model is
 *   "Model not found" (Heavy variant flakiness on the API tier).
 */
export async function decide(req: ChatRequest): Promise<GrokResult> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return { success: false, error: 'XAI_API_KEY not set' };

  const primaryModel = req.model ?? PRIMARY_MODEL;
  const modelsToTry =
    primaryModel === FALLBACK_MODEL ? [primaryModel] : [primaryModel, FALLBACK_MODEL];

  let lastError: GrokResult | null = null;

  for (const model of modelsToTry) {
    const result = await tryWithRetries(apiKey, model, req);
    if (result.success) return result;
    lastError = result;
    // Only fall back to the next model on "model not found" / "invalid model"
    const e = typeof result.error === 'string' ? result.error.toLowerCase() : '';
    const modelMissing =
      e.includes('model not found') ||
      e.includes('invalid model') ||
      e.includes('unknown model');
    if (!modelMissing) break; // any other error: stop here
  }

  return lastError ?? { success: false, error: 'unknown' };
}

async function tryWithRetries(
  apiKey: string,
  model: string,
  req: ChatRequest,
): Promise<GrokResult> {
  const maxAttempts = 3;
  let lastError: GrokResult | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const r = await callOnce(apiKey, model, req);
    if (r.success) return r;

    lastError = r;
    const transient =
      typeof r.error === 'string' &&
      (r.error.includes('HTTP 503') ||
        r.error.includes('HTTP 429') ||
        r.error.includes('at capacity') ||
        r.error.includes('temporarily unavailable'));
    if (!transient || attempt === maxAttempts) break;

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
    // Responses API (`/v1/responses`):
    //   - `input` instead of `messages`
    //   - `tools: [{type: "web_search"}, {type: "x_search"}]` for built-in
    //     server-side live search (Grok runs them, returns final answer)
    //   - `text.format` for JSON output (alternative to chat completions'
    //     response_format)
    res = await fetch(GROK_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: ctrl.signal,
      body: JSON.stringify({
        model,
        input: [
          { role: 'system', content: req.systemPrompt },
          { role: 'user', content: req.userPrompt },
        ],
        tools: [
          { type: 'web_search' },
          { type: 'x_search' },
        ],
        text: { format: { type: 'json_object' } },
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

  const text = extractResponsesText(raw);
  if (!text) {
    return { success: false, error: 'No text content in Responses API output', raw };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return {
      success: false,
      error: `Grok returned non-JSON content: ${e instanceof Error ? e.message : String(e)}`,
      raw: { ...(raw as object), content_preview: text.slice(0, 500) },
    };
  }

  const validated = validatePayload(parsed);
  if (!validated.ok) return { success: false, error: validated.error, raw };

  const usage = extractUsage(raw);
  return { success: true, payload: validated.payload, raw, usage };
}

/**
 * Pull the final-answer text out of a Responses API response. The API
 * returns an `output` array; the model's text lives in a "message" item
 * with `content[].text` (server-executed tool calls show up as separate
 * items but we don't need to do anything with those — they're already
 * folded into the final message).
 */
function extractResponsesText(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as {
    output_text?: string;
    output?: Array<{
      type?: string;
      content?: Array<{ type?: string; text?: string }>;
      text?: string;
    }>;
  };
  // Some SDK versions expose `output_text` as a convenience top-level field.
  if (typeof r.output_text === 'string' && r.output_text.length > 0) {
    return r.output_text;
  }
  if (!Array.isArray(r.output)) return null;
  for (const item of r.output) {
    if (item.type === 'message' && Array.isArray(item.content)) {
      for (const c of item.content) {
        if (
          (c.type === 'output_text' || c.type === 'text') &&
          typeof c.text === 'string' &&
          c.text.length > 0
        ) {
          return c.text;
        }
      }
    }
    // Fallback: some shapes put text directly on the item.
    if (typeof item.text === 'string' && item.text.length > 0) {
      return item.text;
    }
  }
  return null;
}

function extractUsage(raw: unknown): GrokUsage | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as { usage?: Record<string, unknown> };
  if (!r.usage) return undefined;
  const u = r.usage;
  return {
    prompt_tokens:
      typeof u.input_tokens === 'number'
        ? u.input_tokens
        : typeof u.prompt_tokens === 'number'
          ? u.prompt_tokens
          : undefined,
    completion_tokens:
      typeof u.output_tokens === 'number'
        ? u.output_tokens
        : typeof u.completion_tokens === 'number'
          ? u.completion_tokens
          : undefined,
    total_tokens:
      typeof u.total_tokens === 'number' ? u.total_tokens : undefined,
    num_sources_used:
      typeof u.num_sources_used === 'number' ? u.num_sources_used : undefined,
  };
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

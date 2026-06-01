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

/** A discrete external event Grok cites as a driver for this scan's
 *  decisions. Distinct from `thesis` (bot's overall narrative) and
 *  `decisions[].reason` (per-ticker justification). Used to render the
 *  public /innsyn timeline as "event → articles → bot action". */
export interface GrokCatalyst {
  /** Short headline-style title (≤ 120 chars). */
  title: string;
  /** Coarse category — drives icon/colour on /innsyn. */
  category: 'trump' | 'macro' | 'geopolitics' | 'earnings' | 'sector' | 'company' | 'other';
  /** One- or two-sentence summary (≤ 280 chars). */
  summary: string;
  /** Source URLs from live-search. Up to 4 per event. */
  sources: GrokCatalystSource[];
  /** Tickers in our universe this event materially affects. */
  tickers: string[];
}

export interface GrokCatalystSource {
  url: string;
  /** Optional headline for display when host name alone is too vague. */
  headline?: string;
}

export interface GrokDecisionPayload {
  thesis: string;
  decisions: GrokDecision[];
  /** External events cited by Grok as drivers for this scan. Empty when
   *  the scan was routine (no notable catalyst). */
  catalysts: GrokCatalyst[];
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

export interface DecideOptions {
  /**
   * Skip the live-search tools array (`web_search` + `x_search`) on this call.
   * Engine sets this on most ticks: live search is billed per source consumed
   * and is the dominant cost line. Engine pre-fetches Finnhub headlines and
   * RS/sector stats into the user prompt, so prompt-only ticks have most of
   * what the model needs. Re-enable hourly for a "fresh look" call.
   */
  disableTools?: boolean;
}

/**
 * Call Grok with a system + user prompt and parse the JSON response into a
 * decision payload. Returns a discriminated-union result — never throws.
 *
 * - Retries on transient xAI overload (HTTP 429 / 503) with exponential backoff.
 * - Falls back from the configured model to `grok-4` if the primary model is
 *   "Model not found" (Heavy variant flakiness on the API tier).
 */
export async function decide(
  req: ChatRequest,
  options: DecideOptions = {},
): Promise<GrokResult> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return { success: false, error: 'XAI_API_KEY not set' };

  const primaryModel = req.model ?? PRIMARY_MODEL;
  const modelsToTry =
    primaryModel === FALLBACK_MODEL ? [primaryModel] : [primaryModel, FALLBACK_MODEL];

  let lastError: GrokResult | null = null;

  for (const model of modelsToTry) {
    let result = await tryWithRetries(apiKey, model, req, {
      disableTools: options.disableTools,
    });

    // If Grok returned an empty-text response WHILE tools were enabled, retry
    // once WITHOUT live-search tools. Symptom: { success: false, error: 'No
    // text content in Responses API output' }. Most likely cause is that
    // web_search/x_search hung or returned nothing useful and Grok never
    // produced a final message. Without tools, the model uses prompt+training
    // only — degraded but functional. If tools were already disabled, the
    // fallback wouldn't change anything, so skip it.
    const noTextContent =
      !result.success &&
      typeof result.error === 'string' &&
      result.error.includes('No text content');
    if (noTextContent && !options.disableTools) {
      result = await tryWithRetries(apiKey, model, req, { disableTools: true });
    }

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

interface CallOptions {
  /** When true, omit the `tools` array — fallback path for when live search
   *  hangs or never produces final text. */
  disableTools?: boolean;
}

async function tryWithRetries(
  apiKey: string,
  model: string,
  req: ChatRequest,
  options: CallOptions = {},
): Promise<GrokResult> {
  const maxAttempts = 3;
  let lastError: GrokResult | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const r = await callOnce(apiKey, model, req, options);
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
  options: CallOptions = {},
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
    // When `disableTools` is set (fallback path on no-text-content), we
    // omit the tools array entirely — Grok runs prompt-only.
    const requestBody: Record<string, unknown> = {
      model,
      input: [
        { role: 'system', content: req.systemPrompt },
        { role: 'user', content: req.userPrompt },
      ],
      text: { format: { type: 'json_object' } },
    };
    if (!options.disableTools) {
      requestBody.tools = [{ type: 'web_search' }, { type: 'x_search' }];
    }
    res = await fetch(GROK_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: ctrl.signal,
      body: JSON.stringify(requestBody),
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

  // Tool-execution diagnostic: detect if Grok actually ran the live search
  // tools we declared, or hallucinated a thesis from training data only.
  // If usage.num_sources_used is 0 OR missing AND the response has no
  // tool_call items in output, log a warning. Without live search Grok
  // cannot see today's news / X posts / oil price. Suppressed when tools
  // were intentionally disabled — that's a cost-gated prompt-only tick,
  // not a hallucination risk we need to flag.
  const rawObj = raw as { output?: Array<{ type?: string }> };
  const hasToolUse = Array.isArray(rawObj?.output)
    ? rawObj.output.some((item) => item?.type === 'tool_call' || item?.type === 'tool_use')
    : false;
  const sourceCount = usage?.num_sources_used ?? 0;
  if (!options.disableTools && !hasToolUse && sourceCount === 0) {
    console.warn(
      `[grok] Live search tools declared but not executed (no tool_call items, num_sources_used=${sourceCount}). Decision is from training data only — may be hallucinated.`,
    );
  }

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

const CATALYST_CATEGORIES: readonly GrokCatalyst['category'][] = [
  'trump',
  'macro',
  'geopolitics',
  'earnings',
  'sector',
  'company',
  'other',
];

function parseCatalysts(raw: unknown): GrokCatalyst[] {
  if (!Array.isArray(raw)) return [];
  const out: GrokCatalyst[] = [];
  for (const c of raw) {
    if (!c || typeof c !== 'object') continue;
    const o = c as Record<string, unknown>;
    const title = typeof o.title === 'string' ? o.title.trim().slice(0, 200) : '';
    if (!title) continue;
    const categoryRaw = typeof o.category === 'string' ? o.category.toLowerCase().trim() : 'other';
    const category = (CATALYST_CATEGORIES as readonly string[]).includes(categoryRaw)
      ? (categoryRaw as GrokCatalyst['category'])
      : 'other';
    const summary = typeof o.summary === 'string' ? o.summary.trim().slice(0, 400) : '';
    const tickersRaw = Array.isArray(o.tickers) ? o.tickers : [];
    const tickers: string[] = [];
    for (const t of tickersRaw) {
      if (typeof t === 'string') {
        const v = t.trim().toUpperCase();
        if (v && v.length <= 10) tickers.push(v);
      }
    }
    const sourcesRaw = Array.isArray(o.sources) ? o.sources : [];
    const sources: GrokCatalystSource[] = [];
    for (const s of sourcesRaw.slice(0, 4)) {
      if (!s || typeof s !== 'object') continue;
      const so = s as Record<string, unknown>;
      const url = typeof so.url === 'string' ? so.url.trim() : '';
      if (!url || !/^https?:\/\//i.test(url)) continue;
      const headline = typeof so.headline === 'string' ? so.headline.trim().slice(0, 200) : undefined;
      sources.push(headline ? { url, headline } : { url });
    }
    out.push({ title, category, summary, sources, tickers });
    if (out.length >= 8) break;
  }
  return out;
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
  const catalysts = parseCatalysts(obj.catalysts);
  return { ok: true, payload: { thesis, decisions, catalysts } };
}

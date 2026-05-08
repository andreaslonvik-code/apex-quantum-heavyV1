// Apex Quantum + sin Grok-integrasjon. Egen modul så Plus-flyten ikke deler
// kode med trading-engine — slik at en endring her aldri kan påvirke
// autonom Max-handel.

import {
  PLUS_BLUEPRINT,
  PLUS_WATCHLIST,
  PLUS_SIGNAL_USER_PROMPT_TEMPLATE,
  findPlusTicker,
  type PlusRegion,
} from './blueprints/plus';
import type { SignalInsert } from './plus-db';

const GROK_ENDPOINT = 'https://api.x.ai/v1/responses';
const FALLBACK_MODEL = 'grok-4';
const REQUEST_TIMEOUT_MS = 290_000;

const PRIMARY_MODEL = ((): string => {
  const fromEnv = process.env.XAI_MODEL ?? process.env.GROK_MODEL;
  if (!fromEnv) return FALLBACK_MODEL;
  if (fromEnv.toLowerCase().includes('heavy')) return FALLBACK_MODEL;
  return fromEnv;
})();

export interface AskResult {
  ok: boolean;
  answer?: string;
  error?: string;
}

const LANG_DIRECTIVE: Record<string, string> = {
  no: 'Svar på norsk.',
  en: 'Respond in English.',
  de: 'Antworte auf Deutsch.',
  es: 'Responde en español.',
  zh: '请用简体中文回答。',
};

/**
 * Spør Grok om en spesifikk ticker. Returnerer fri-tekst svar (markdown OK).
 * Bruker live web/X-søk via Responses API tools.
 */
export async function askAboutTicker(
  ticker: string,
  question: string,
  lang: string,
): Promise<AskResult> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return { ok: false, error: 'XAI_API_KEY not set' };

  const meta = findPlusTicker(ticker);
  const tickerLine = meta
    ? `${meta.ticker} (${meta.name}, ${meta.region}, ${meta.theme})`
    : ticker;

  const langDirective = LANG_DIRECTIVE[lang] ?? LANG_DIRECTIVE.en;

  const systemPrompt = `${PLUS_BLUEPRINT.systemPrompt}

${PLUS_BLUEPRINT.askPrompt}

${langDirective}`;

  const userPrompt = `Ticker: ${tickerLine}

Brukerens spørsmål:
${question.trim()}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(GROK_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: PRIMARY_MODEL,
        input: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        tools: [{ type: 'web_search' }, { type: 'x_search' }],
      }),
    });
    clearTimeout(timer);

    const text = await res.text();
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 300)}` };
    }

    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      return { ok: false, error: 'non-JSON response' };
    }

    const answer = extractText(raw);
    if (!answer) return { ok: false, error: 'empty response' };

    return { ok: true, answer };
  } catch (e) {
    clearTimeout(timer);
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Daily signal generation
// ─────────────────────────────────────────────────────────────────────────────

export interface ScanGenerationResult {
  ok: boolean;
  scanSummary?: string;
  signals?: SignalInsert[];
  promptTokens?: number;
  completionTokens?: number;
  numSourcesUsed?: number;
  error?: string;
}

const VALID_ACTIONS = new Set(['BUY', 'SELL', 'HOLD', 'WATCH']);
const VALID_HORIZONS = new Set(['short', 'medium', 'long']);
const VALID_REGIONS = new Set<PlusRegion>(['NO', 'EU', 'US', 'TW', 'KR', 'JP', 'HK', 'IN']);

const tickerSet = new Set(PLUS_WATCHLIST.map((t) => t.ticker.toUpperCase()));
const tickerToRegion = new Map(PLUS_WATCHLIST.map((t) => [t.ticker.toUpperCase(), t.region] as const));

/**
 * Run the daily Plus signal scan. Calls Grok with the blueprint system prompt
 * + signal-template user prompt, validates the JSON response, and returns
 * normalized SignalInsert rows ready for the DB.
 */
export async function generateDailySignals(): Promise<ScanGenerationResult> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return { ok: false, error: 'XAI_API_KEY not set' };

  const tickerList = PLUS_WATCHLIST.map((t) => `${t.ticker} (${t.region}, ${t.theme})`).join(', ');
  const userPrompt = `${PLUS_SIGNAL_USER_PROMPT_TEMPLATE}

Watchlist (kun bruk tickere herfra):
${tickerList}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(GROK_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: PRIMARY_MODEL,
        input: [
          { role: 'system', content: PLUS_BLUEPRINT.systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        text: { format: { type: 'json_object' } },
        tools: [{ type: 'web_search' }, { type: 'x_search' }],
      }),
    });
    clearTimeout(timer);

    const text = await res.text();
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 300)}` };
    }

    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      return { ok: false, error: 'non-JSON response' };
    }

    const answer = extractText(raw);
    if (!answer) return { ok: false, error: 'empty response' };

    let parsed: unknown;
    try {
      parsed = JSON.parse(answer);
    } catch {
      return { ok: false, error: `Grok returned non-JSON content: ${answer.slice(0, 300)}` };
    }

    const validated = validateSignalsPayload(parsed);
    if (!validated.ok) return { ok: false, error: validated.error };

    const usage = (raw as { usage?: { input_tokens?: number; output_tokens?: number; num_sources_used?: number } })
      .usage;

    return {
      ok: true,
      scanSummary: validated.scanSummary,
      signals: validated.signals,
      promptTokens: usage?.input_tokens,
      completionTokens: usage?.output_tokens,
      numSourcesUsed: usage?.num_sources_used,
    };
  } catch (e) {
    clearTimeout(timer);
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

interface ValidatedScan {
  ok: true;
  scanSummary: string;
  signals: SignalInsert[];
}
interface ValidatedScanError {
  ok: false;
  error: string;
}

function validateSignalsPayload(v: unknown): ValidatedScan | ValidatedScanError {
  if (!v || typeof v !== 'object') return { ok: false, error: 'payload not an object' };
  const obj = v as Record<string, unknown>;

  const scanSummary = typeof obj.scan_summary === 'string' ? obj.scan_summary : '';
  const rawSignals = Array.isArray(obj.signals) ? obj.signals : [];

  const signals: SignalInsert[] = [];
  for (const s of rawSignals) {
    if (!s || typeof s !== 'object') continue;
    const o = s as Record<string, unknown>;

    const ticker = typeof o.ticker === 'string' ? o.ticker.trim().toUpperCase() : '';
    if (!tickerSet.has(ticker)) continue;

    const action = typeof o.action === 'string' ? o.action.trim().toUpperCase() : '';
    if (!VALID_ACTIONS.has(action)) continue;

    const confidence = typeof o.confidence === 'number'
      ? Math.max(0, Math.min(100, Math.round(o.confidence)))
      : 0;

    const horizon = typeof o.time_horizon === 'string' ? o.time_horizon.trim().toLowerCase() : '';
    if (!VALID_HORIZONS.has(horizon)) continue;

    const region = (typeof o.region === 'string' ? o.region.trim().toUpperCase() : '') as PlusRegion;
    const finalRegion = VALID_REGIONS.has(region) ? region : tickerToRegion.get(ticker);
    if (!finalRegion) continue;

    const reasoning = typeof o.reasoning === 'string' ? o.reasoning.trim() : '';
    if (!reasoning) continue;

    const catalysts = Array.isArray(o.catalysts)
      ? o.catalysts.filter((c): c is string => typeof c === 'string').slice(0, 5)
      : [];
    const risks = Array.isArray(o.risk)
      ? o.risk.filter((r): r is string => typeof r === 'string').slice(0, 5)
      : Array.isArray(o.risks)
        ? o.risks.filter((r): r is string => typeof r === 'string').slice(0, 5)
        : [];

    const peerComparison = typeof o.peer_comparison === 'string' ? o.peer_comparison : null;
    const insiderSignal = typeof o.insider_signal === 'string' ? o.insider_signal : null;

    signals.push({
      ticker,
      region: finalRegion,
      action: action as SignalInsert['action'],
      confidence,
      time_horizon: horizon as SignalInsert['time_horizon'],
      reasoning,
      catalysts,
      risks,
      peer_comparison: peerComparison,
      insider_signal: insiderSignal,
    });
  }

  return { ok: true, scanSummary, signals };
}

// ─────────────────────────────────────────────────────────────────────────────
// Weekly market report
// ─────────────────────────────────────────────────────────────────────────────

export interface ReportResult {
  ok: boolean;
  title?: string;
  body?: string;
  promptTokens?: number;
  completionTokens?: number;
  error?: string;
}

const REPORT_USER_PROMPT = `Skriv en ukentlig markedsrapport for Apex Quantum +.

Strukturer rapporten med tydelige overskrifter og 600–900 ord totalt:

# UKENS HOVEDSAK
Den viktigste markedsbevegelsen denne uken — hva skjedde og hvorfor det betyr noe.

## Sektorrotasjon
Hvilke sektorer ledet og hvilke hang etter? Konkrete eksempler fra global watchlist.

## Makro og geopolitikk
FX, råvarer, sentralbankrenter, viktige nyheter som påvirker markedene.

## Fokus neste uke
Earnings, makro-utgivelser, og aksjer modellen vil følge særlig nøye.

## Læringspunkt
Et konkret begrep eller mønster fra ukens hendelser som leseren kan ta med seg.

Returner ren JSON: { "title": "kort tittel maks 80 tegn", "body": "rapporten i markdown" }
Skriv på norsk. Ikke individuell investeringsrådgivning.`;

export async function generateWeeklyReport(): Promise<ReportResult> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return { ok: false, error: 'XAI_API_KEY not set' };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(GROK_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: PRIMARY_MODEL,
        input: [
          { role: 'system', content: PLUS_BLUEPRINT.systemPrompt },
          { role: 'user', content: REPORT_USER_PROMPT },
        ],
        text: { format: { type: 'json_object' } },
        tools: [{ type: 'web_search' }, { type: 'x_search' }],
      }),
    });
    clearTimeout(timer);

    const text = await res.text();
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 300)}` };

    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      return { ok: false, error: 'non-JSON response' };
    }
    const answer = extractText(raw);
    if (!answer) return { ok: false, error: 'empty response' };

    let parsed: unknown;
    try {
      parsed = JSON.parse(answer);
    } catch {
      return { ok: false, error: 'Grok returned non-JSON content' };
    }

    if (!parsed || typeof parsed !== 'object') {
      return { ok: false, error: 'payload not an object' };
    }
    const p = parsed as Record<string, unknown>;
    const title = typeof p.title === 'string' ? p.title.slice(0, 200) : null;
    const body = typeof p.body === 'string' ? p.body : null;
    if (!title || !body) return { ok: false, error: 'missing title or body' };

    const usage = (raw as { usage?: { input_tokens?: number; output_tokens?: number } }).usage;
    return {
      ok: true,
      title,
      body,
      promptTokens: usage?.input_tokens,
      completionTokens: usage?.output_tokens,
    };
  } catch (e) {
    clearTimeout(timer);
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function extractText(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as {
    output_text?: string;
    output?: Array<{
      type?: string;
      content?: Array<{ type?: string; text?: string }>;
      text?: string;
    }>;
  };
  if (typeof r.output_text === 'string' && r.output_text.length > 0) return r.output_text;
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
    if (typeof item.text === 'string' && item.text.length > 0) return item.text;
  }
  return null;
}

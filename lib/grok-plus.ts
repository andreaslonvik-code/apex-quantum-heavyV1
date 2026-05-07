// Apex Quantum + sin Grok-integrasjon. Egen modul så Plus-flyten ikke deler
// kode med trading-engine — slik at en endring her aldri kan påvirke
// autonom Max-handel.

import { PLUS_BLUEPRINT, findPlusTicker } from './blueprints/plus';

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

// Apex Quantum AI portfolio selector.
//
// Replaces the pure-math 30-day-Sharpe ranking for elite-portfolio selection
// with a Grok-4-Heavy decision that integrates news + macro + per-ticker
// stats. Trading engine sees the same Set<string> of elite tickers — the
// only thing that changes is *who decided which 8*.
//
// Flow:
//   1. Aggregate per-ticker stats (30-d return, vol, sector) — same input
//      the math optimizer used.
//   2. Pull latest news intel (sector bias, ticker events, risk mode).
//   3. Build a compact prompt: ticker stats table + news context + hard
//      constraints (max 8, max 3/sector, must justify each).
//   4. Grok returns structured JSON: thesis + picks (ticker + reasoning).
//   5. Validate + filter to known tickers + apply sector cap. Fall back to
//      Sharpe-ranking if Grok fails or returns < 5 valid picks.
//   6. Persist selection to ai_portfolio_selections for audit + future
//      "AI vs Sharpe" backtest.
//
// Cached for 1 hour at the calling layer (lib/portfolio-optimizer.ts).

import { generateObject } from 'ai';
import { createXai } from '@ai-sdk/xai';
import { z } from 'zod';
import {
  WATCHLIST,
  SYMBOL_TO_SECTOR,
  TICKER_NAME,
  type SectorKey,
} from './blueprint';
import { getStockBars, type AlpacaCreds } from './alpaca';
import { getLatestNewsIntel } from './news-intelligence';
import { createAdminClient } from '@/utils/supabase/admin';

const xai = createXai({ apiKey: process.env.XAI_API_KEY || '' });
// Note: "Grok Heavy mode" is a UI feature on x.com/grok.com (multi-agent
// reasoning), not an API model. Use the underlying model name. Common
// valid names: 'grok-4', 'grok-4-fast-reasoning', 'grok-4-0709', 'grok-3'.
// Override with GROK_MODEL env var.
const MODEL_NAME = process.env.GROK_MODEL || 'grok-4';
const grokModel = xai(MODEL_NAME);

const ELITE_SIZE = 8;
const MAX_PER_SECTOR = 3;
const MIN_VALID_PICKS = 5;
const STAT_FETCH_CONCURRENCY = 12;
const TRADING_DAYS = 252;

interface TickerStats {
  ticker: string;
  return30d: number;
  vol30d: number;
  sharpe: number;
}

const PickSchema = z.object({
  ticker: z.string(),
  reasoning: z.string().max(280),
});

const AiPortfolioSchema = z.object({
  thesis: z.string().max(800),
  riskRead: z.enum(['normal', 'risk-on', 'risk-off', 'crash-warning']),
  picks: z.array(PickSchema).min(5).max(8),
  confidence: z.number().min(0).max(1),
});

export type AiPortfolioPick = z.infer<typeof PickSchema>;
export type AiPortfolio = z.infer<typeof AiPortfolioSchema>;

export interface AiSelectionResult {
  tickers: Set<string>;
  source: 'ai' | 'sharpe-fallback';
  picks: AiPortfolioPick[];
  thesis: string;
  riskRead: AiPortfolio['riskRead'];
  confidence: number;
}

async function runInChunks<T>(items: readonly T[], size: number, fn: (item: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(fn));
  }
}

async function gatherTickerStats(creds: AlpacaCreds): Promise<TickerStats[]> {
  const stats: TickerStats[] = [];
  await runInChunks(WATCHLIST, STAT_FETCH_CONCURRENCY, async (ticker) => {
    const bars = await getStockBars(creds, ticker, { timeframe: '1Day', limit: 30 });
    if (!bars.success || bars.data.length < 20) return;
    const closes = bars.data.map((b) => b.c).filter((c) => c > 0);
    if (closes.length < 20) return;
    const ret30d = closes[closes.length - 1] / closes[0] - 1;
    const logReturns: number[] = [];
    for (let i = 1; i < closes.length; i++) logReturns.push(Math.log(closes[i] / closes[i - 1]));
    const meanRet = logReturns.reduce((s, r) => s + r, 0) / logReturns.length;
    const variance = logReturns.reduce((s, r) => s + (r - meanRet) ** 2, 0) / logReturns.length;
    const vol = Math.sqrt(variance) * Math.sqrt(TRADING_DAYS);
    if (!Number.isFinite(vol) || vol <= 0) return;
    const sharpe = ret30d / vol;
    if (!Number.isFinite(sharpe)) return;
    stats.push({ ticker, return30d: ret30d, vol30d: vol, sharpe });
  });
  return stats;
}

function sharpeFallback(stats: TickerStats[]): AiSelectionResult {
  // Math fallback: same greedy-top-N + sector cap as the original optimizer.
  const sorted = [...stats].sort((a, b) => b.sharpe - a.sharpe);
  const sectorCount = new Map<SectorKey, number>();
  const selected: TickerStats[] = [];
  for (const s of sorted) {
    if (selected.length >= ELITE_SIZE) break;
    if (s.sharpe <= 0) break;
    const sector = SYMBOL_TO_SECTOR[s.ticker];
    if (sector) {
      const cnt = sectorCount.get(sector) || 0;
      if (cnt >= MAX_PER_SECTOR) continue;
      sectorCount.set(sector, cnt + 1);
    }
    selected.push(s);
  }
  const tickers = new Set(selected.map((s) => s.ticker));
  const picks: AiPortfolioPick[] = selected.map((s) => ({
    ticker: s.ticker,
    reasoning: `Sharpe ${s.sharpe.toFixed(2)} (30d return ${(s.return30d * 100).toFixed(1)}%, vol ${(s.vol30d * 100).toFixed(0)}%)`,
  }));
  return {
    tickers,
    source: 'sharpe-fallback',
    picks,
    thesis: 'Math fallback (Grok unavailable or returned invalid picks). Top-8 by 30-day risk-adjusted momentum with per-sector cap.',
    riskRead: 'normal',
    confidence: 0.5,
  };
}

function buildPrompt(stats: TickerStats[], newsIntel: Awaited<ReturnType<typeof getLatestNewsIntel>>): string {
  // Compact per-ticker brief — sorted by Sharpe so the strongest math picks
  // surface to the top of Grok's context window.
  const sorted = [...stats].sort((a, b) => b.sharpe - a.sharpe);
  const tickerLines = sorted.map((s) => {
    const sector = SYMBOL_TO_SECTOR[s.ticker] ?? 'misc';
    return `${s.ticker} (${sector}): ret30d ${(s.return30d * 100).toFixed(1)}%, vol ${(s.vol30d * 100).toFixed(0)}%, sharpe ${s.sharpe.toFixed(2)}`;
  }).join('\n');

  const newsBlock = newsIntel
    ? `\n\n# Aktuelt nyhetsbilde (siste skann)
- Risk mode: ${newsIntel.riskMode}
- Confidence: ${newsIntel.confidence.toFixed(2)}
- Sammendrag: ${newsIntel.summary}
- Sektor-bias: ${JSON.stringify(newsIntel.sectorBias)}
- Materielle ticker-events: ${newsIntel.tickerEvents.length === 0 ? 'ingen' : newsIntel.tickerEvents.map((e) => `${e.ticker}/${e.direction}/${e.source}`).join(', ')}
`
    : '\n\n# Aktuelt nyhetsbilde: ingen ferskt skann tilgjengelig — bruk dine egne kunnskaper om generell makro.\n';

  return `Du er APEX QUANTUM sin AI portfolio manager. Du velger 8 aksjer for porteføljen for neste time.

# Univers (${WATCHLIST.length} tickere) — sortert etter 30-dagers risk-adjusted momentum
${tickerLines}
${newsBlock}

# Dine valg
Velg 8 tickere for porteføljen. Prinsipper:

1. **Math er førsteinntrykket, ikke fasit.** Sharpe-rangeringen over er nyttig, men den ser ikke nyheter, geopolitikk, eller sektor-temaer. Du gjør det.
2. **Integrer nyhets-kontekst.** Hvis Hormuz-spenninger eller olje-rally i nyhetsbildet → vurder energi-tickere selv om de ikke er topp-Sharpe. Hvis AI-boble-frykt → vær mer forsiktig med semis-konsentrasjon.
3. **Sektor-spredning.** Maks 3 picks fra samme sektor — unngå konsentrasjons-risiko.
4. **Kun positive momentum eller klart fundamentalt drevet.** Ingen "fallende kniver".
5. **Hver pick må ha begrunnelse.** En setning som forklarer *hvorfor* — ikke generic "sterk Sharpe".

# Risk read
- 'crash-warning' BARE ved ekstreme makro-signaler (bank-failures, sovereign default, krigsutbrudd)
- 'risk-off' ved klart bearish makro / Fed-hawk / olje-shock
- 'risk-on' ved tydelig pro-risk regime
- 'normal' = default

# Confidence
0..1. Hvis nyhetsbildet er klart og picks er overbevisende: høy. Hvis tvetydig eller du gjetter: lav. Vi faller tilbake til ren matte hvis confidence < 0.4.

Returner JSON som matcher schema. Eksempel:
{
  "thesis": "AI-capex-drevet semi-rally fortsetter, men Hormuz-spenninger gir asymmetrisk olje-upside. Tar 4 semis (top-Sharpe), 2 olje (XOM som anker, OXY for shale-beta), 1 datacenter (VRT), 1 power (CEG som AI-nuclear hedge).",
  "riskRead": "normal",
  "picks": [
    { "ticker": "MU", "reasoning": "Top-Sharpe semis + Micron earnings beat sist uke + AI-capex driver" },
    { "ticker": "XOM", "reasoning": "Hormuz-spenninger gir oljepris-upside, XOM som lavest-vol oljeaktør i universet" },
    ...
  ],
  "confidence": 0.75
}`;
}

async function persistSelection(
  result: AiSelectionResult,
  rawResponse: unknown,
  errorMessage?: string,
): Promise<void> {
  try {
    const sb = createAdminClient();
    const { error } = await sb.from('ai_portfolio_selections').insert({
      picks: result.picks,
      thesis: result.thesis,
      risk_read: result.riskRead,
      confidence: result.confidence,
      source: result.source,
      raw_response: rawResponse ?? null,
      failed: result.source === 'sharpe-fallback' && !!errorMessage,
      error_message: errorMessage ?? null,
    });
    if (error) {
      console.error('[AI-PORTFOLIO] supabase insert error:', error.message, error.details);
    } else {
      console.log(`[AI-PORTFOLIO] persisted ${result.source} selection (${result.picks.length} picks)`);
    }
  } catch (e) {
    console.error('[AI-PORTFOLIO] persist threw:', e);
  }
}

export async function selectEliteWithAI(creds: AlpacaCreds): Promise<AiSelectionResult> {
  const t0 = Date.now();
  console.log('[AI-PORTFOLIO] start');

  const stats = await gatherTickerStats(creds);
  console.log(`[AI-PORTFOLIO] stats: ${stats.length}/${WATCHLIST.length} tickers in ${Date.now() - t0}ms`);

  if (stats.length < ELITE_SIZE * 1.5) {
    console.warn(`[AI-PORTFOLIO] insufficient stats (${stats.length} < ${ELITE_SIZE * 1.5}), using fallback`);
    const fallback = sharpeFallback(stats);
    await persistSelection(fallback, null, 'insufficient market data');
    return fallback;
  }

  const newsIntel = await getLatestNewsIntel();
  console.log(`[AI-PORTFOLIO] news: ${newsIntel ? `riskMode=${newsIntel.riskMode} confidence=${newsIntel.confidence}` : 'none'}`);

  // Verify XAI key presence early so the failure mode is obvious in logs.
  if (!process.env.XAI_API_KEY) {
    console.error('[AI-PORTFOLIO] XAI_API_KEY not set — falling back to Sharpe');
    const fallback = sharpeFallback(stats);
    await persistSelection(fallback, null, 'XAI_API_KEY env var missing');
    return fallback;
  }

  let aiResult: AiPortfolio | null = null;
  let rawResponse: unknown = null;
  let errorMessage: string | undefined;
  const tGrok = Date.now();
  try {
    console.log('[AI-PORTFOLIO] calling Grok...');
    const r = await generateObject({
      model: grokModel,
      schema: AiPortfolioSchema,
      prompt: buildPrompt(stats, newsIntel),
      temperature: 0.4,
    });
    aiResult = r.object;
    rawResponse = r.object;
    console.log(`[AI-PORTFOLIO] Grok OK in ${Date.now() - tGrok}ms — ${r.object.picks.length} picks, confidence ${r.object.confidence}`);
  } catch (e) {
    // Extract everything we can from AI SDK errors so the diagnosis row
    // says exactly what xAI rejected — not just generic "Bad Request".
    const err = e as Error & {
      statusCode?: number;
      responseBody?: string | Record<string, unknown>;
      url?: string;
      cause?: unknown;
      data?: unknown;
    };
    const parts: string[] = [];
    if (err.statusCode) parts.push(`HTTP ${err.statusCode}`);
    parts.push(err.message ?? String(e));
    if (err.responseBody) {
      const body =
        typeof err.responseBody === 'string'
          ? err.responseBody
          : JSON.stringify(err.responseBody);
      parts.push(`xai_response=${body.slice(0, 800)}`);
    } else if (err.data) {
      parts.push(`data=${JSON.stringify(err.data).slice(0, 400)}`);
    }
    if (err.cause) {
      const cause =
        err.cause instanceof Error ? err.cause.message : String(err.cause);
      parts.push(`cause=${cause.slice(0, 200)}`);
    }
    errorMessage = parts.join(' | ');
    console.error(
      `[AI-PORTFOLIO] Grok call failed in ${Date.now() - tGrok}ms:`,
      errorMessage,
    );
  }

  if (!aiResult) {
    const fallback = sharpeFallback(stats);
    await persistSelection(fallback, null, errorMessage ?? 'grok returned null');
    return fallback;
  }

  // Filter to known tickers + apply sector cap defensively (Grok may
  // hallucinate or over-concentrate even with explicit instructions).
  const watchlistSet = new Set(WATCHLIST);
  const sectorCount = new Map<SectorKey, number>();
  const validPicks: AiPortfolioPick[] = [];
  for (const p of aiResult.picks) {
    const tk = p.ticker.toUpperCase();
    if (!watchlistSet.has(tk)) continue;
    const sector = SYMBOL_TO_SECTOR[tk];
    if (sector) {
      const cnt = sectorCount.get(sector) || 0;
      if (cnt >= MAX_PER_SECTOR) continue;
      sectorCount.set(sector, cnt + 1);
    }
    validPicks.push({ ticker: tk, reasoning: p.reasoning });
    if (validPicks.length >= ELITE_SIZE) break;
  }

  if (validPicks.length < MIN_VALID_PICKS || aiResult.confidence < 0.4) {
    const reason = validPicks.length < MIN_VALID_PICKS
      ? `Grok returned only ${validPicks.length} valid picks`
      : `Grok confidence ${aiResult.confidence} below 0.4 threshold`;
    console.warn(`[AI-PORTFOLIO] ${reason} — using fallback`);
    const fallback = sharpeFallback(stats);
    await persistSelection(fallback, rawResponse, reason);
    return fallback;
  }

  const result: AiSelectionResult = {
    tickers: new Set(validPicks.map((p) => p.ticker)),
    source: 'ai',
    picks: validPicks,
    thesis: aiResult.thesis,
    riskRead: aiResult.riskRead,
    confidence: aiResult.confidence,
  };
  await persistSelection(result, rawResponse);
  console.log(`[AI-PORTFOLIO] complete in ${Date.now() - t0}ms — picks=${validPicks.map((p) => p.ticker).join(',')}`);
  return result;
}

// Read path used by dashboard — returns the latest non-failed selection.
const READ_CACHE_TTL_MS = 5 * 60 * 1000;
let readCache: { ts: number; data: StoredAiSelection | null } | null = null;

export interface StoredAiSelection {
  selectedAt: string;
  picks: AiPortfolioPick[];
  thesis: string;
  riskRead: AiPortfolio['riskRead'];
  confidence: number;
  source: string;
}

export async function getLatestAiSelection(): Promise<StoredAiSelection | null> {
  if (readCache && Date.now() - readCache.ts < READ_CACHE_TTL_MS) return readCache.data;
  try {
    const sb = createAdminClient();
    const { data } = await sb
      .from('ai_portfolio_selections')
      .select('selected_at, picks, thesis, risk_read, confidence, source')
      .eq('failed', false)
      .order('selected_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) {
      readCache = { ts: Date.now(), data: null };
      return null;
    }
    const out: StoredAiSelection = {
      selectedAt: String(data.selected_at),
      picks: (data.picks as AiPortfolioPick[]) ?? [],
      thesis: String(data.thesis ?? ''),
      riskRead: data.risk_read as AiPortfolio['riskRead'],
      confidence: Number(data.confidence),
      source: String(data.source),
    };
    readCache = { ts: Date.now(), data: out };
    return out;
  } catch {
    readCache = { ts: Date.now(), data: null };
    return null;
  }
}

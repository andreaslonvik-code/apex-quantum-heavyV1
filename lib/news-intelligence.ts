// Apex Quantum news + sentiment intelligence.
//
// Hourly Grok-4-Heavy scan that produces a structured read on:
//   • Macro / geopolitics (Hormuz, China-US, Trump, Musk, oil, bubble/crash risk)
//   • Per-watchlist-ticker news (filed only when materially newsworthy)
//   • X / social sentiment for the same tickers (institutional voices,
//     not retail meme-noise)
//
// Output is a tight JSON schema enforced via Zod. The trading engine reads
// the latest scan at the start of each scan and uses it to:
//   • Scale BUY size globally by riskMode (crash-warning → 0.2×, risk-off
//     → 0.5×, normal → 1.0×, risk-on → 1.2×)
//   • Apply sector tilts (e.g. energy_oil bias = +0.3 → 1.3× BUY scores
//     on oil tickers)
//   • Apply per-ticker boosts/blocks for specific events
//
// Failsafe: if Grok errors / returns malformed JSON / confidence < 0.4 →
// no influence. Trading runs at neutral. We never block trading because
// of a news-API hiccup.

import { generateObject } from 'ai';
import { createXai } from '@ai-sdk/xai';
import { z } from 'zod';
import { createAdminClient } from '@/utils/supabase/admin';
import {
  SECTORS,
  WATCHLIST,
  type SectorKey,
} from './blueprint';

const xai = createXai({ apiKey: process.env.XAI_API_KEY || '' });
const grokModel = xai(process.env.GROK_MODEL || 'grok-4-heavy');

const SECTOR_KEYS = Object.keys(SECTORS) as SectorKey[];

// ─────────────────────────────────────────────────────────────────────────────
// Schema
// ─────────────────────────────────────────────────────────────────────────────

const TickerEventSchema = z.object({
  ticker: z.string(),
  direction: z.enum(['bullish', 'bearish']),
  weight: z.number().min(0).max(1),
  source: z.enum(['news', 'social', 'rumor', 'macro']),
  reason: z.string().max(280),
});

const NewsIntelSchema = z.object({
  summary: z.string().max(800),
  riskMode: z.enum(['normal', 'risk-on', 'risk-off', 'crash-warning']),
  sectorBias: z.record(z.string(), z.number().min(-1).max(1)),
  tickerEvents: z.array(TickerEventSchema).max(40),
  confidence: z.number().min(0).max(1),
});

export type NewsIntel = z.infer<typeof NewsIntelSchema>;
export type TickerEvent = z.infer<typeof TickerEventSchema>;

export interface StoredNewsIntel {
  scannedAt: string;
  summary: string;
  riskMode: NewsIntel['riskMode'];
  sectorBias: Record<string, number>;
  tickerEvents: TickerEvent[];
  confidence: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt
// ─────────────────────────────────────────────────────────────────────────────

function buildPrompt(): string {
  return `Du er APEX QUANTUM sin nyhets-analytiker. Hver time leser du verdens-nyhetsbildet og X-sentiment, og leverer en strukturert vurdering som driver allokeringen.

# Datakilder
- Globale finansnyheter (Reuters, Bloomberg, FT, WSJ, CNBC) — fokus siste timen
- X / Twitter — institusjonelle stemmer: CEOs, journalister, anerkjente analytikere (Goldman, JPM, Morgan Stanley equity research), Bloomberg-folk. IKKE meme-kontoer, IKKE anonyme retail-stemmer
- Geopolitiske kilder
- Råvare-feeds (WTI/Brent, gull, kobber)

# Proaktiv overvåkning (alltid sjekk)
- **Midtøsten**: Hormuz-stredet, Iran, Israel-konflikt, Saudi/OPEC+ rykter
- **USA/Kina**: tariffer, Taiwan, halvleder-eksport-restriksjoner, valuta-bevegelser
- **Trump-administrasjonen**: policy-uttalelser, særlig handel/sanksjoner/energi
- **Elon Musk**: Tesla/SpaceX/X uttalelser som har historie å flytte kurs
- **Oljepris**: spike-bevegelser, OPEC+ rykter, raffineri-hendelser
- **Boble/krakk-signaler**: AI peak-euphoria, uvanlige opsjoner, insider-salg, kreditt-spreads, VIX-spikes, bank-stress

# Watchlist (sjekk for materielle hendelser siste timen)
${WATCHLIST.join(', ')}

# Output-spec

\`riskMode\`:
- 'crash-warning' BARE ved ekstreme signaler (multiple bank failures, sovereign default, VIX > 35, geopolitisk eskalering)
- 'risk-off' ved klart bearish makro / kreditt-stress / Fed-hawk-signal
- 'risk-on' ved tydelig pro-risk policy / dovish Fed / fred-rykter
- 'normal' = default

\`sectorBias\`: Map<sektor-key, tall ∈ [-1, +1]> hvor +1 = sterkt bullish, -1 = sterkt bearish.
Kun nevn sektorer med faktisk signal — ikke list alle.
Tilgjengelige keys: ${SECTOR_KEYS.join(', ')}

\`tickerEvents\`: bare MATERIELLE hendelser. Ikke inkluder generic "TSLA opp i dag" — kun hvis det er konkret driver:
- Verifisert nyhet (earnings, regulator, M&A): weight 0.7-1.0, source='news'
- CEO/insider-tweet (faktisk identitet): 0.5-0.8, source='social'
- Uverifisert rykte fra troverdig X-konto: 0.3-0.6, source='rumor'
- Makro-hendelse som rammer ticker direkte: 0.4-0.8, source='macro'

\`confidence\`: 0..1. Hvis nyhetsbildet er rolig eller tvetydig: LAV confidence (0.3-0.5). Ikke fabriker signaler.

Returner JSON som matcher schema. Eksempel ved rolig dag:
{
  "summary": "Rolig nyhetsbilde. AI-capex driver semis. Olje stabilt ~$72. Ingen geopolitiske eskaleringer.",
  "riskMode": "normal",
  "sectorBias": { "semis": 0.2 },
  "tickerEvents": [],
  "confidence": 0.5
}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export async function scanNews(): Promise<{ intel: NewsIntel | null; raw: unknown; error?: string }> {
  try {
    const result = await generateObject({
      model: grokModel,
      schema: NewsIntelSchema,
      prompt: buildPrompt(),
      temperature: 0.3,
    });
    return { intel: result.object, raw: result.object };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[NEWS] scanNews failed:', msg);
    return { intel: null, raw: null, error: msg };
  }
}

export async function persistNewsIntel(
  intel: NewsIntel | null,
  errorMessage?: string,
  rawResponse?: unknown,
): Promise<void> {
  try {
    const sb = createAdminClient();
    if (intel) {
      await sb.from('news_intelligence').insert({
        summary: intel.summary,
        risk_mode: intel.riskMode,
        sector_bias: intel.sectorBias,
        ticker_events: intel.tickerEvents,
        confidence: intel.confidence,
        raw_response: rawResponse ?? null,
        failed: false,
      });
    } else {
      await sb.from('news_intelligence').insert({
        risk_mode: 'normal',
        sector_bias: {},
        ticker_events: [],
        confidence: 0,
        failed: true,
        error_message: errorMessage ?? 'unknown',
      });
    }
  } catch (e) {
    console.error('[NEWS] persistNewsIntel failed:', e);
  }
  invalidateNewsCache();
}

// ─────────────────────────────────────────────────────────────────────────────
// Read path — used by trading engine + dashboard feed
// ─────────────────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 15 * 60 * 1000;
const MAX_INTEL_AGE_MS = 4 * 60 * 60 * 1000;
const MIN_CONFIDENCE = 0.4;

interface NewsCache { ts: number; intel: StoredNewsIntel | null }
let cached: NewsCache | null = null;

export async function getLatestNewsIntel(): Promise<StoredNewsIntel | null> {
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.intel;
  try {
    const sb = createAdminClient();
    const { data, error } = await sb
      .from('news_intelligence')
      .select('scanned_at, summary, risk_mode, sector_bias, ticker_events, confidence')
      .eq('failed', false)
      .gte('scanned_at', new Date(Date.now() - MAX_INTEL_AGE_MS).toISOString())
      .order('scanned_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) {
      cached = { ts: Date.now(), intel: null };
      return null;
    }
    if (Number(data.confidence) < MIN_CONFIDENCE) {
      cached = { ts: Date.now(), intel: null };
      return null;
    }
    const intel: StoredNewsIntel = {
      scannedAt: String(data.scanned_at),
      summary: String(data.summary ?? ''),
      riskMode: data.risk_mode as NewsIntel['riskMode'],
      sectorBias: (data.sector_bias as Record<string, number>) ?? {},
      tickerEvents: (data.ticker_events as TickerEvent[]) ?? [],
      confidence: Number(data.confidence),
    };
    cached = { ts: Date.now(), intel };
    return intel;
  } catch (e) {
    console.error('[NEWS] getLatestNewsIntel failed:', e);
    cached = { ts: Date.now(), intel: null };
    return null;
  }
}

export function invalidateNewsCache(): void {
  cached = null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Multipliers consumed by the trading engine
// ─────────────────────────────────────────────────────────────────────────────

const RISK_MODE_BUY_FACTOR: Record<NewsIntel['riskMode'], number> = {
  'risk-on': 1.2,
  'normal': 1.0,
  'risk-off': 0.5,
  'crash-warning': 0.2,
};

export function buyFactorFromIntel(intel: StoredNewsIntel | null): number {
  if (!intel) return 1.0;
  return RISK_MODE_BUY_FACTOR[intel.riskMode] ?? 1.0;
}

export function sectorMultiplierFromIntel(
  intel: StoredNewsIntel | null,
  sector: SectorKey | undefined,
): number {
  if (!intel || !sector) return 1.0;
  const bias = intel.sectorBias[sector];
  if (!Number.isFinite(bias)) return 1.0;
  // Clamp to ±0.5 around 1.0 — sector tilt can't more than 1.5× boost or 0.5× cut.
  return 1.0 + Math.max(-0.5, Math.min(0.5, bias as number));
}

export function tickerEventMultiplierFromIntel(
  intel: StoredNewsIntel | null,
  ticker: string,
): number {
  if (!intel) return 1.0;
  const events = intel.tickerEvents.filter((e) => e.ticker.toUpperCase() === ticker.toUpperCase());
  if (events.length === 0) return 1.0;
  let multiplier = 1.0;
  for (const e of events) {
    const sign = e.direction === 'bullish' ? +1 : -1;
    const magnitude = Math.max(0, Math.min(1, e.weight));
    multiplier += sign * magnitude * 0.5;
  }
  return Math.max(0.0, Math.min(2.0, multiplier));
}

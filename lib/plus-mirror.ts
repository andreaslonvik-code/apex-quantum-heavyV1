import { getLatestDecision } from './grok-decisions';
import { PLUS_WATCHLIST, type PlusRegion } from './blueprints/plus';
import type { ScanGenerationResult } from './grok-plus';
import type { SignalInsert, PlusAction } from './plus-db';

const tickerToPlusRegion = new Map<string, PlusRegion>(
  PLUS_WATCHLIST.map((t) => [t.ticker.toUpperCase(), t.region] as const),
);

/**
 * Plus signal mirror. Reads the leader's latest Max trading decision from
 * `grok_decisions` and reshapes each `GrokDecision` into a Plus `SignalInsert`.
 * The leader's Grok call (cron/tick) is the single source of truth for all
 * signals in the product — Max followers mirror it to Alpaca, Plus signal
 * cards mirror it to plus_signals.
 *
 * Why this exists: replaces `generateDailySignals()` (which made its own
 * hourly Grok call with web_search + x_search tools enabled). Eliminates
 * the entire Plus signal Grok spend (~$200/month) and guarantees Plus
 * customers see the exact same calls that drive Max — the product becomes
 * "one strategy, two ways to consume it" instead of two parallel signal
 * streams that could diverge.
 *
 * Caveats versus the old Grok-driven Plus signals:
 *   - No catalysts/risks/peer_comparison/insider_signal. Max decisions don't
 *     produce these fields. The weekly `cron/plus-report` still runs and
 *     covers the narrative layer.
 *   - Ticker universe shrinks to the Max stocks watchlist (62 US tickers).
 *     PLUS_WATCHLIST's NO/EU coverage no longer surfaces in the daily
 *     signals UI. By design — user has explicitly chosen consistency with
 *     Max's track record over breadth of coverage.
 */
export async function mirrorMaxDecisionsToPlus(
  leaderClerkUserId: string,
): Promise<ScanGenerationResult> {
  // Stocks is the only blueprint Plus has ever surfaced. Crypto/commodities
  // intentionally stay out — different time horizons, different risk profiles,
  // and the existing Plus UI/track-record assumes equity-style signals.
  const decision = await getLatestDecision(leaderClerkUserId, 'stocks');

  if (!decision || decision.failed) {
    return {
      ok: true,
      scanSummary: 'Venter på fersk Max-signal fra leder-kontoen.',
      scanSummaryEn: 'Awaiting fresh Max signal from leader account.',
      signals: [],
      promptTokens: 0,
      completionTokens: 0,
      numSourcesUsed: 0,
    };
  }

  const signals: SignalInsert[] = [];
  for (const dec of decision.decisions) {
    const ticker = dec.ticker.toUpperCase();
    // Pass through all three actions. HOLD is meaningful: Plus subscribers
    // can see exactly what the leader is holding, not just new entries/exits.
    const action: PlusAction = dec.action;
    // BUY/SELL = high conviction (the leader just acted); HOLD = steady state.
    // Confidence is a UI hint, not a sizing input — keep the scale simple.
    const confidence = action === 'HOLD' ? 50 : 80;
    // Region: prefer the PLUS_WATCHLIST tagging when the ticker overlaps,
    // otherwise default 'US' (Max watchlist is entirely US-listed).
    const region = tickerToPlusRegion.get(ticker) ?? 'US';

    signals.push({
      ticker,
      region,
      action,
      confidence,
      time_horizon: 'short',
      reasoning: dec.reason || `${action} ${ticker} (Max-engine speil)`,
      reasoning_en: null,
      catalysts: [],
      catalysts_en: null,
      risks: [],
      risks_en: null,
      peer_comparison: null,
      peer_comparison_en: null,
      insider_signal: null,
      insider_signal_en: null,
    });
  }

  return {
    ok: true,
    scanSummary: decision.thesis ?? 'Max-engine speil — ingen tese fra leder.',
    scanSummaryEn: null,
    signals,
    promptTokens: 0,
    completionTokens: 0,
    numSourcesUsed: 0,
  };
}

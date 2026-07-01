/**
 * Live marketing stats — derives the numbers shown on the public landing
 * straight from the LEADER's paper Alpaca account. Replaces the hardcoded
 * design-prototype numbers so an investor never sees a figure that isn't
 * traceable to live data.
 *
 * Cached in-memory for 5 minutes — anonymous landing visitors don't need
 * second-level freshness, and Alpaca shouldn't be hit per-page-view.
 *
 * Falls back to `ok: false` (no numbers rendered) if anything fails — the
 * landing copy is written to read cleanly without numbers.
 */
import { resolveLeaderClerkId } from './leader';
import { getUserAlpacaCreds } from './user-alpaca';
import { getAccount, getPositions, getPortfolioHistory, type AlpacaCreds } from './alpaca';

export interface MarketingPosition {
  ticker: string;
  price: number;
  /** Unrealized P&L % since entry (positive or negative). */
  changePct: number;
  side: 'up' | 'dn';
}

export interface MarketingStats {
  ok: boolean;
  /** Current portfolio total (USD). */
  totalValue: number | null;
  /** Year-to-date return % (e.g. 12.34 = +12.34%). */
  ytdReturnPct: number | null;
  /** Max drawdown over the YTD window as a positive % (e.g. 4.8 = -4.8% peak-to-trough). */
  maxDrawdownPct: number | null;
  /** Number of currently held long positions. */
  positionsHeld: number | null;
  /** Top live positions (up to 6) by market value. */
  positions: MarketingPosition[];
  /** YTD daily equity series for the track-record chart ([] if too little history). */
  equityHistory: number[];
  /** Real epoch-ms timestamps, parallel to equityHistory (live tip → Date.now()). */
  equityTimestampsMs: number[];
  /** Whether enough equity history is available to plot a curve (>= 5 points). */
  hasChart: boolean;
  asOfIso: string;
}

const EMPTY: MarketingStats = {
  ok: false,
  totalValue: null,
  ytdReturnPct: null,
  maxDrawdownPct: null,
  positionsHeld: null,
  positions: [],
  equityHistory: [],
  equityTimestampsMs: [],
  hasChart: false,
  asOfIso: new Date().toISOString(),
};

const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: { stats: MarketingStats; expiresAt: number } | null = null;

export async function getLeaderMarketingStats(): Promise<MarketingStats> {
  if (cache && cache.expiresAt > Date.now()) return cache.stats;
  try {
    const leaderId = await resolveLeaderClerkId();
    if (!leaderId) return cacheAndReturn(EMPTY);
    const userCreds = await getUserAlpacaCreds(leaderId);
    if (!userCreds) return cacheAndReturn(EMPTY);

    const creds: AlpacaCreds = {
      apiKey: userCreds.apiKey,
      apiSecret: userCreds.apiSecret,
      env: userCreds.environment,
    };

    const [acct, pos, hist] = await Promise.all([
      getAccount(creds),
      getPositions(creds),
      getPortfolioHistory(creds, { period: '1A', timeframe: '1D' }),
    ]);

    if (!acct.success) return cacheAndReturn(EMPTY);
    const totalValue = parseFloat(acct.data.equity) || 0;

    // ── YTD return + max drawdown from portfolio history ────────────────
    let ytdReturnPct: number | null = null;
    let maxDrawdownPct: number | null = null;
    const equityHistory: number[] = [];
    const equityTimestampsMs: number[] = [];

    if (hist.success && hist.data.timestamp.length > 0) {
      const yearStart = Math.floor(Date.UTC(new Date().getUTCFullYear(), 0, 1) / 1000);
      let baseline: number | null = null;
      // Collect equity points from the year start onward (or all if no YTD coverage).
      for (let i = 0; i < hist.data.timestamp.length; i++) {
        const t = hist.data.timestamp[i];
        const v = hist.data.equity[i];
        if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) continue;
        if (t >= yearStart) {
          if (baseline == null) baseline = v;
          equityHistory.push(v);
          equityTimestampsMs.push(t * 1000);
        }
      }
      // Append the live tip so the chart reaches the headline number.
      if (totalValue > 0 && (equityHistory.length === 0 || Math.abs(equityHistory[equityHistory.length - 1] - totalValue) > 0.5)) {
        equityHistory.push(totalValue);
        equityTimestampsMs.push(Date.now());
      }
      // Fall back to since-inception baseline if no YTD coverage at all.
      if (baseline == null) {
        for (let i = 0; i < hist.data.equity.length; i++) {
          const v = hist.data.equity[i];
          if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
            baseline = v;
            break;
          }
        }
      }
      if (baseline && baseline > 0 && totalValue > 0) {
        ytdReturnPct = ((totalValue - baseline) / baseline) * 100;
      }
      // Max drawdown over the chart window.
      let peak = 0;
      let dd = 0;
      for (const v of equityHistory) {
        if (v > peak) peak = v;
        if (peak > 0) {
          const cur = ((peak - v) / peak) * 100;
          if (cur > dd) dd = cur;
        }
      }
      maxDrawdownPct = dd;
    }

    // ── Live positions (top 6 by market value) ──────────────────────────
    let positions: MarketingPosition[] = [];
    let positionsHeld = 0;
    if (pos.success) {
      const longs = pos.data.filter((p) => p.side === 'long');
      positionsHeld = longs.length;
      positions = longs
        .sort(
          (a, b) =>
            (parseFloat(b.market_value) || 0) - (parseFloat(a.market_value) || 0),
        )
        .slice(0, 6)
        .map((p) => {
          const plpct = (parseFloat(p.unrealized_plpc) || 0) * 100;
          return {
            ticker: p.symbol,
            price: parseFloat(p.current_price) || 0,
            changePct: plpct,
            side: plpct >= 0 ? 'up' : 'dn',
          };
        });
    }

    const stats: MarketingStats = {
      ok: true,
      totalValue,
      ytdReturnPct,
      maxDrawdownPct,
      positionsHeld,
      positions,
      equityHistory,
      equityTimestampsMs,
      hasChart: equityHistory.length >= 5,
      asOfIso: new Date().toISOString(),
    };
    return cacheAndReturn(stats);
  } catch {
    return cacheAndReturn(EMPTY);
  }
}

function cacheAndReturn(s: MarketingStats): MarketingStats {
  cache = { stats: s, expiresAt: Date.now() + CACHE_TTL_MS };
  return s;
}

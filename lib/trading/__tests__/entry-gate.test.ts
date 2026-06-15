import {
  gateMirrorBuys,
  isAnticipatorySignal,
  type IndicatorSnapshot,
} from '@/lib/trading/entry-gate';
import type { MirrorOrder } from '@/lib/trading/portfolio-mirror';

/**
 * Baseline snapshot for a NON-priority-core ticker that cleanly passes the
 * strict PATH C "momentum leader" path. Tests override individual fields to
 * exercise the hard gates and rejection paths.
 */
function baseSnapshot(overrides: Partial<IndicatorSnapshot> = {}): IndicatorSnapshot {
  return {
    ticker: 'ZTEST', // not in PRIORITY_CORE_TICKERS → goes through strict gates
    price: 150,
    change_24h_pct: 1,
    change_5d_pct: 5,
    rsi_14: 60,
    sma_50: 140,
    sma_200: 100,
    macd_hist: 1,
    atr_14: 3,
    bullish_divergence: false,
    volume_accumulation: true,
    rsi_rising: true,
    higher_highs: true,
    higher_lows: true,
    rising_channel: true,
    realized_vol_20d: 0.02,
    rsi_14_1h: null,
    uptrend_1h: false,
    days_to_earnings: null,
    news_count_24h: 0,
    return_30d: 0.1,
    relative_strength_30d: 5,
    sector_avg_rs_30d: 10,
    sector_rank: 1,
    recent_headlines: [],
    pct_below_20bar_high: 0,
    priority_core_dip_signal: false,
    ...overrides,
  };
}

describe('isAnticipatorySignal — hard gates', () => {
  it('passes a clean momentum leader', () => {
    const sig = isAnticipatorySignal(baseSnapshot());
    expect(sig.ok).toBe(true);
    expect(sig.reasons).toContain('momentum_leader');
  });

  it('rejects inside the earnings blackout window', () => {
    const sig = isAnticipatorySignal(baseSnapshot({ days_to_earnings: 2 }));
    expect(sig.ok).toBe(false);
    expect(sig.reasons[0]).toMatch(/earnings_blackout/);
  });

  it('rejects when SMA200 is unavailable (insufficient history)', () => {
    const sig = isAnticipatorySignal(baseSnapshot({ sma_200: null }));
    expect(sig.ok).toBe(false);
    expect(sig.reasons[0]).toMatch(/sma200_unavailable/);
  });

  it('rejects when price is below SMA200 (downtrend / falling knife)', () => {
    const sig = isAnticipatorySignal(baseSnapshot({ price: 90, sma_200: 100 }));
    expect(sig.ok).toBe(false);
    expect(sig.reasons[0]).toMatch(/not_in_uptrend/);
  });

  it('rejects when the sector is not in an uptrend (sector_rs ≤ 0)', () => {
    const sig = isAnticipatorySignal(baseSnapshot({ sector_avg_rs_30d: -1 }));
    expect(sig.ok).toBe(false);
    expect(sig.reasons[0]).toMatch(/sector_not_uptrend/);
  });

  it('rejects a structural laggard dip-buy (RS30d < -5pp)', () => {
    const sig = isAnticipatorySignal(
      baseSnapshot({ relative_strength_30d: -8, rsi_14: 40, rising_channel: false }),
    );
    expect(sig.ok).toBe(false);
    expect(sig.reasons[0]).toMatch(/structural_laggard/);
  });

  it('rejects chasing an extended/overbought name (the late-entry case)', () => {
    // RSI 85, channel pattern broken, no accumulation, well off any support:
    // no valid fresh entry → a late follower must NOT buy this.
    const sig = isAnticipatorySignal(
      baseSnapshot({
        rsi_14: 85,
        rising_channel: false,
        volume_accumulation: false,
        relative_strength_30d: 10,
        change_5d_pct: 8,
      }),
    );
    expect(sig.ok).toBe(false);
    expect(sig.reasons[0]).toMatch(/no_dip_no_trend/);
  });

  it('lets a priority-core name through the passthrough path (PATH F)', () => {
    const sig = isAnticipatorySignal(
      baseSnapshot({
        ticker: 'NVDA',
        rsi_14: 70,
        relative_strength_30d: 4,
        rising_channel: false,
        volume_accumulation: false,
      }),
    );
    expect(sig.ok).toBe(true);
    expect(sig.reasons).toContain('priority_core_passthrough_pathF');
  });
});

describe('gateMirrorBuys — follower entry-gate', () => {
  const buy = (ticker: string): MirrorOrder => ({
    ticker,
    action: 'BUY',
    notional: 1000,
    reason: 'mirror_topup',
  });

  it('allows BUYs with a valid entry signal and gates the rest', () => {
    const snapshots = new Map<string, IndicatorSnapshot>([
      ['ZGOOD', baseSnapshot({ ticker: 'ZGOOD' })],
      // extended/overbought → gated out
      ['ZEXT', baseSnapshot({ ticker: 'ZEXT', rsi_14: 85, rising_channel: false, volume_accumulation: false })],
      // 'ZNOSNAP' intentionally absent from the map
    ]);

    const { allowed, gated } = gateMirrorBuys(
      [buy('ZGOOD'), buy('ZEXT'), buy('ZNOSNAP')],
      snapshots,
    );

    expect(allowed.map((o) => o.ticker)).toEqual(['ZGOOD']);
    const gatedByTicker = Object.fromEntries(gated.map((g) => [g.ticker, g.reason]));
    expect(gatedByTicker.ZEXT).toMatch(/no_dip_no_trend/);
    expect(gatedByTicker.ZNOSNAP).toBe('no_snapshot');
  });

  it('never routes a SELL through the gate (de-risking is unaffected)', () => {
    const sell: MirrorOrder = { ticker: 'ZGOOD', action: 'SELL', qty: 10, reason: 'mirror_exit' };
    const snapshots = new Map<string, IndicatorSnapshot>([
      ['ZGOOD', baseSnapshot({ ticker: 'ZGOOD' })],
    ]);
    const { allowed, gated } = gateMirrorBuys([sell], snapshots);
    expect(allowed).toHaveLength(0);
    expect(gated).toHaveLength(0);
  });

  it('preserves the BUY order object (notional/reason) when allowed', () => {
    const snapshots = new Map<string, IndicatorSnapshot>([
      ['ZGOOD', baseSnapshot({ ticker: 'ZGOOD' })],
    ]);
    const { allowed } = gateMirrorBuys([buy('ZGOOD')], snapshots);
    expect(allowed[0]).toEqual({ ticker: 'ZGOOD', action: 'BUY', notional: 1000, reason: 'mirror_topup' });
  });
});

import { computeMirrorPlan, type LeaderSnapshot } from '@/lib/trading/portfolio-mirror';
import { STOCKS_BLUEPRINT } from '@/lib/blueprints/stocks';
import type { AlpacaPosition } from '@/lib/alpaca';

function leaderHolding(nvdaMarketValue: number): LeaderSnapshot {
  return {
    clerkUserId: 'leader',
    equity: 100_000,
    allocation: { stocks: 50, crypto: 25, commodities: 25 },
    positionsByBlueprint: {
      stocks: new Map(nvdaMarketValue > 0 ? [['NVDA', nvdaMarketValue]] : []),
      crypto: new Map(),
      commodities: new Map(),
    },
  };
}

function pos(qty: number, marketValue: number): AlpacaPosition {
  return {
    symbol: 'NVDA',
    qty: String(qty),
    market_value: String(marketValue),
    current_price: String(marketValue / qty),
    side: 'long',
  } as unknown as AlpacaPosition;
}

const baseArgs = {
  blueprint: STOCKS_BLUEPRINT,
  followerEquity: 10_000,
  followerAllocationPct: 50, // follower stocks bucket = 5_000
  followerInFlight: new Set<string>(),
  followerBuyingPower: 10_000,
  cooldownTickers: new Set<string>(),
  fridayBlackout: false,
  isBearRegime: false,
};

describe('computeMirrorPlan — composition matching', () => {
  it("buys to top up toward the leader's per-ticker %", () => {
    // Leader: NVDA = 25k / 50k bucket = 50%. Follower bucket 5k → target 2.5k.
    const orders = computeMirrorPlan({
      ...baseArgs,
      leaderSnapshot: leaderHolding(25_000),
      followerPositions: new Map(),
    });
    expect(orders).toHaveLength(1);
    expect(orders[0]).toMatchObject({ ticker: 'NVDA', action: 'BUY', notional: 2500 });
  });

  it('Friday blackout blocks a new stock BUY', () => {
    const orders = computeMirrorPlan({
      ...baseArgs,
      fridayBlackout: true,
      leaderSnapshot: leaderHolding(25_000),
      followerPositions: new Map(),
    });
    expect(orders).toHaveLength(0);
  });

  it('cool-down blocks re-entry into a recently stopped-out name', () => {
    const orders = computeMirrorPlan({
      ...baseArgs,
      cooldownTickers: new Set(['NVDA']),
      leaderSnapshot: leaderHolding(25_000),
      followerPositions: new Map(),
    });
    expect(orders).toHaveLength(0);
  });

  it('bear regime halves the BUY notional', () => {
    const orders = computeMirrorPlan({
      ...baseArgs,
      isBearRegime: true,
      leaderSnapshot: leaderHolding(25_000),
      followerPositions: new Map(),
    });
    expect(orders).toHaveLength(1);
    expect(orders[0]).toMatchObject({ ticker: 'NVDA', action: 'BUY', notional: 1250 });
  });
});

describe('computeMirrorPlan — de-risking is never blocked', () => {
  it('full-exits a name the leader no longer holds', () => {
    const orders = computeMirrorPlan({
      ...baseArgs,
      leaderSnapshot: leaderHolding(0), // leader holds no stocks, but bucket > 0
      followerPositions: new Map([['NVDA', pos(10, 5000)]]),
    });
    expect(orders).toHaveLength(1);
    expect(orders[0]).toMatchObject({ ticker: 'NVDA', action: 'SELL', qty: 10 });
  });

  it('still SELLs during Friday blackout and bear regime', () => {
    const orders = computeMirrorPlan({
      ...baseArgs,
      fridayBlackout: true,
      isBearRegime: true,
      leaderSnapshot: leaderHolding(0),
      followerPositions: new Map([['NVDA', pos(10, 5000)]]),
    });
    expect(orders).toHaveLength(1);
    expect(orders[0].action).toBe('SELL');
  });
});

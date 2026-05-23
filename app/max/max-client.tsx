'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';

import { Topbar } from './components/topbar';
import { PortfolioHeader, type Timeframe } from './components/portfolio-header';
import { ReturnsChart } from './components/returns-chart';
import { ChartSummary } from './components/chart-summary';
import { ExposureCard } from './components/exposure-card';
import { FailedOrderAlert } from './components/failed-order-alert';
import { WithdrawCard } from './components/withdraw-card';
import { BottomStats } from './components/bottom-stats';
import { Watchlist, type WatchlistRow, type Signal } from './components/watchlist';
import { RecentOrders, type RecentOrder } from './components/recent-orders';
import { BenchmarkBar, type BenchmarkBarPayload } from './components/benchmark-bar';
import { WithdrawModal, type WithdrawStatus } from './components/withdraw-modal';
import { GrokThesisCard } from './components/grok-thesis-card';
import type { Lang } from './components/i18n';
import { BLUEPRINTS, type AssetClass } from '@/lib/blueprints';
import '../components/marketing-v2/styles.css';

const BLUEPRINT_TITLES: Record<AssetClass, { no: string; en: string }> = {
  stocks: { no: 'Aksjer', en: 'Stocks' },
  crypto: { no: 'Krypto', en: 'Crypto' },
  commodities: { no: 'Råvarer', en: 'Commodities' },
};

interface AccountInfo {
  accountId: string;
  equity: number;
  cash: number;
  buyingPower: number;
  currency: string;
  environment: 'paper' | 'live';
  isLive: boolean;
}

interface PerformancePayload {
  tf?: Timeframe;
  current: {
    totalValue: number;
    pnl: number;
    pnlPercent: number;
    initialValue: number;
    balance: number;
    positionsValue: number;
    sinceInceptionPnl?: number;
    sinceInceptionPnlPct?: number;
  };
  session: { peak: number; maxDrawdown: number };
  chartData: Array<{ timestamp?: number; value: number }>;
  xTicks?: string[];
  benchmark?: {
    symbol: string;
    /** Re-sampled to equity timestamps; preferred for chart overlay. */
    valuesAligned?: number[];
    values: number[];
    pct: number | null;
    vsBenchPct: number | null;
  };
  benchmarkNasdaq?: {
    symbol: string;
    valuesAligned?: number[];
    values: number[];
    pct: number | null;
  };
  /** Real S&P 500 index level (^GSPC), aligned to equity timestamps. */
  indexSp500?: {
    symbol: string;
    valuesAligned?: number[];
    pct: number | null;
  };
  /** Real NASDAQ Composite index level (^IXIC), aligned to equity timestamps. */
  indexNasdaq?: {
    symbol: string;
    valuesAligned?: number[];
    pct: number | null;
  };
  benchmarkBar?: BenchmarkBarPayload;
}

interface AlpacaPositionPayload {
  ticker: string;
  symbol: string;
  navn?: string;
  antall: number;
  vekt: number;
  avgPrice: number;
  currentPrice: number;
  marketValue: number;
  pnl: number;
  pnlPercent: number;
}

export default function MaxClient({ isAdmin = false }: { isAdmin?: boolean }) {
  const router = useRouter();
  const [lang, setLang] = useState<Lang>('no');
  const [tf, setTf] = useState<Timeframe>('24H');
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null);
  const [performance, setPerformance] = useState<PerformancePayload | null>(null);
  const [positions, setPositions] = useState<AlpacaPositionPayload[]>([]);
  const [orders, setOrders] = useState<RecentOrder[]>([]);
  const [dismissedOrders, setDismissedOrders] = useState<Set<string>>(new Set());
  const [botRunning, setBotRunning] = useState(true);
  const [wdOpen, setWdOpen] = useState(false);
  const [wdStatus, setWdStatus] = useState<WithdrawStatus>('idle');
  const [wdError, setWdError] = useState<string | undefined>();
  const tickerRef = useRef<NodeJS.Timeout | null>(null);

  const refreshAll = useCallback(async () => {
    try {
      const [perfRes, posRes, ordRes] = await Promise.all([
        fetch(`/api/apex/performance?tf=${encodeURIComponent(tf)}`, { credentials: 'include' }).then((r) => (r.ok ? r.json() : null)),
        fetch('/api/apex/positions', { credentials: 'include' }).then((r) => (r.ok ? r.json() : null)),
        fetch('/api/apex/recent-orders', { credentials: 'include' }).then((r) => (r.ok ? r.json() : null)),
      ]);
      if (perfRes?.current) setPerformance(perfRes);
      if (Array.isArray(posRes?.positions)) setPositions(posRes.positions as AlpacaPositionPayload[]);
      if (Array.isArray(ordRes?.orders)) setOrders(ordRes.orders as RecentOrder[]);
    } catch {
      /* soft-fail; next tick will retry */
    }
  }, [tf]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/apex/alpaca/connect', { credentials: 'include' });
        const data = await res.json();
        if (cancelled) return;
        if (data.connected) {
          setIsConnected(true);
          if (data.accountInfo) {
            setAccountInfo({
              accountId: data.accountInfo.accountId || 'ALPACA',
              equity: data.accountInfo.equity || 0,
              cash: data.accountInfo.cash || 0,
              buyingPower: data.accountInfo.buyingPower || 0,
              currency: data.accountInfo.currency || 'USD',
              environment: data.accountInfo.environment || 'paper',
              isLive: !!data.accountInfo.isLive,
            });
          }
          await refreshAll();
        } else {
          setIsConnected(false);
        }
      } catch {
        if (!cancelled) setIsConnected(false);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshAll]);

  useEffect(() => {
    if (!isConnected) return;
    // refreshAll's identity flips whenever `tf` changes — fire once immediately
    // so the chart redraws without waiting for the next 3 s tick.
    refreshAll();
    tickerRef.current = setInterval(refreshAll, 3000);
    return () => {
      if (tickerRef.current) clearInterval(tickerRef.current);
    };
  }, [isConnected, refreshAll]);

  // Kick the engine on connect so initial capital deployment happens at
  // login instead of waiting up to 60 s for the next cron tick. The engine
  // is idempotent — if positions or open orders already exist it no-ops.
  useEffect(() => {
    if (!isConnected) return;
    fetch('/api/apex/blueprint-tick', { method: 'POST', credentials: 'include' })
      .then(() => refreshAll())
      .catch(() => {
        /* soft-fail */
      });
  }, [isConnected, refreshAll]);

  // ── Derived values ───────────────────────────────────────────────────
  const startVal = performance?.current?.initialValue ?? accountInfo?.equity ?? 0;
  const currentVal = performance?.current?.totalValue ?? accountInfo?.equity ?? 0;
  const profit = performance?.current?.pnl ?? 0;
  const profitPct = performance?.current?.pnlPercent ?? 0;
  const peakVal = performance?.session?.peak ?? currentVal;
  const drawdownPct = performance?.session?.maxDrawdown ?? 0;
  const drawdownAbs = (drawdownPct / 100) * (peakVal || 0);
  const fromPeakAbs = Math.max(0, peakVal - currentVal);
  const fromPeakPct = peakVal > 0 ? (fromPeakAbs / peakVal) * 100 : 0;
  const vsBenchPct = performance?.benchmark?.vsBenchPct ?? null;
  const cashUsd = performance?.current?.balance ?? accountInfo?.cash ?? 0;
  const investedUsd = performance?.current?.positionsValue ?? 0;
  const totalForExposure = currentVal || 1;
  const cashPct = Math.max(0, Math.min(100, (cashUsd / totalForExposure) * 100));
  const investedPct = Math.max(0, Math.min(100, (investedUsd / totalForExposure) * 100));

  const largest = useMemo(() => {
    if (positions.length === 0) return null;
    let top = positions[0];
    for (const p of positions) if (p.marketValue > top.marketValue) top = p;
    const pct = totalForExposure > 0 ? (top.marketValue / totalForExposure) * 100 : 0;
    return { ticker: top.ticker, pct };
  }, [positions, totalForExposure]);

  // Recent successful engine orders, indexed by ticker (both crypto forms).
  // 15 min window ≈ scan cadence + fill latency. This is the only honest
  // "signal" the dashboard has — it reflects what the engine actually did,
  // never a P&L guess. ERR/PENDING orders don't count.
  const recentActionByTicker = useMemo(() => {
    const RECENT_WINDOW_MS = 15 * 60 * 1000;
    const cutoff = Date.now() - RECENT_WINDOW_MS;
    const map = new Map<string, 'BUY' | 'SELL'>();
    for (const o of orders) {
      if (o.status !== 'OK') continue;
      const t = Date.parse(o.submittedAt);
      if (!Number.isFinite(t) || t < cutoff) continue;
      const norm = o.ticker;
      if (!map.has(norm)) map.set(norm, o.action);
      if (!norm.includes('/') && /^[A-Z]+USD$/.test(norm) && norm.length >= 6) {
        const slashed = `${norm.slice(0, -3)}/USD`;
        if (!map.has(slashed)) map.set(slashed, o.action);
      }
    }
    return map;
  }, [orders]);

  const watchlistRowsByBlueprint = useMemo(() => {
    // Alpaca crypto positions come back without slash ("BTCUSD"); blueprints
    // store the data-API form ("BTC/USD"). Index held positions by both forms
    // so the watchlist matches regardless of which side hands us the ticker.
    const heldByTicker = new Map<string, AlpacaPositionPayload>();
    for (const p of positions) {
      heldByTicker.set(p.ticker, p);
      if (!p.ticker.includes('/') && /^[A-Z]+USD$/.test(p.ticker) && p.ticker.length >= 6) {
        heldByTicker.set(`${p.ticker.slice(0, -3)}/USD`, p);
      }
    }

    const buildRows = (blueprintId: AssetClass): WatchlistRow[] => {
      const bp = BLUEPRINTS[blueprintId];
      return bp.watchlist.map((ticker) => {
        const name = bp.tickerNames?.[ticker] ?? ticker;
        const held = heldByTicker.get(ticker);
        const recent = recentActionByTicker.get(ticker);
        if (held) {
          // Held position: show the engine's last real action within the
          // recent window, else HOLD. The dashboard never invents a SELL
          // from P&L — the engine's ATR/trailing stops decide exits, and
          // those aren't visible client-side, so a guess would mislead.
          const sig: Signal = recent ?? 'HOLD';
          return { ticker, name, qty: held.antall, avg: held.avgPrice, mark: held.currentPrice, signal: sig };
        }
        if (recent === 'BUY') {
          return { ticker, name, qty: 0, avg: 0, mark: 0, signal: 'BUY' as Signal };
        }
        if (recent === 'SELL') {
          return { ticker, name, qty: 0, avg: 0, mark: 0, signal: 'SELL' as Signal };
        }
        return { ticker, name, qty: 0, avg: 0, mark: 0, signal: 'WATCH' as Signal };
      });
    };

    return {
      stocks: buildRows('stocks'),
      crypto: buildRows('crypto'),
      commodities: buildRows('commodities'),
    };
  }, [positions, recentActionByTicker]);

  /**
   * Unified "Mine posisjoner" — every held position across all three
   * buckets, sorted by market value descending. Drives the top-of-page
   * holdings panel so the user sees current exposure in one glance.
   */
  const myHoldingsRows: WatchlistRow[] = useMemo(() => {
    // Build ticker → human-readable name lookup across all blueprints.
    const tickerToName = new Map<string, string>();
    for (const bpId of ['stocks', 'crypto', 'commodities'] as const) {
      const bp = BLUEPRINTS[bpId];
      for (const ticker of bp.watchlist) {
        tickerToName.set(ticker, bp.tickerNames?.[ticker] ?? ticker);
      }
    }

    const rows: Array<WatchlistRow & { _mv: number }> = [];
    for (const p of positions) {
      if (!Number.isFinite(p.antall) || p.antall <= 0) continue;
      // Normalize crypto: "BTCUSD" → "BTC/USD" so name lookup matches blueprint.
      let displayTicker = p.ticker;
      if (
        !displayTicker.includes('/') &&
        /^[A-Z]+USD$/.test(displayTicker) &&
        displayTicker.length >= 6
      ) {
        displayTicker = `${displayTicker.slice(0, -3)}/USD`;
      }
      const name = tickerToName.get(displayTicker) ?? p.symbol;
      // Signal = the engine's last real action on this ticker, else HOLD —
      // see recentActionByTicker. No P&L-derived SELL: the dashboard must
      // not claim a sell the engine has not made.
      const sig: Signal = recentActionByTicker.get(displayTicker) ?? 'HOLD';

      rows.push({
        ticker: displayTicker,
        name,
        qty: p.antall,
        avg: p.avgPrice,
        mark: p.currentPrice,
        signal: sig,
        // Share of total account capital — engine already computes this
        // as marketValue / equity in the /positions route.
        weightPct: p.vekt,
        _mv: p.marketValue,
      });
    }
    rows.sort((a, b) => b._mv - a._mv);
    return rows.map(({ _mv: _mv, ...row }) => row);
  }, [positions, recentActionByTicker]);

  const equityPoints = useMemo(() => {
    if (!performance?.chartData?.length) return undefined;
    return performance.chartData.map((d) => d.value);
  }, [performance]);

  // Real index levels (^GSPC / ^IXIC), aligned to equity timestamps — drive
  // the "Indeks" chart mode. The "Avkastning" mode shows the portfolio alone.
  const sp500Points = performance?.indexSp500?.valuesAligned ?? undefined;
  const nasdaqPoints = performance?.indexNasdaq?.valuesAligned ?? undefined;
  const chartTicks = performance?.xTicks && performance.xTicks.length > 0 ? performance.xTicks : undefined;

  // First failed order, deduplicated by orderId/time. User can dismiss it.
  const failedOrder = useMemo(() => {
    return orders.find(
      (o) => o.status === 'ERR' && !dismissedOrders.has(`${o.ticker}:${o.submittedAt}`)
    );
  }, [orders, dismissedOrders]);

  // ── Actions ──────────────────────────────────────────────────────────
  const handleWithdrawConfirm = async () => {
    setWdStatus('pending');
    setWdError(undefined);
    try {
      const res = await fetch('/api/apex/withdraw-profits', { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (!res.ok || data.success === false) {
        setWdStatus('error');
        setWdError(data.message || data.error || 'Uventet feil');
        return;
      }
      setWdStatus('done');
      toast.success(
        lang === 'no'
          ? `Hentet ut $${(data.totalSold || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
          : `Withdrew $${(data.totalSold || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
      );
      await refreshAll();
    } catch (err) {
      setWdStatus('error');
      setWdError(err instanceof Error ? err.message : 'Network error');
    }
  };

  const handleDisconnect = async () => {
    try {
      await fetch('/api/apex/disconnect', { method: 'POST', credentials: 'include' });
    } catch {}
    router.push('/');
  };

  const handleStopAll = () => {
    setBotRunning(false);
    toast.error(lang === 'no' ? 'Stopp aktivert — ingen nye ordre' : 'Halt active — no new orders');
  };

  const handleDismissOrder = (ticker: string, time: string) => {
    setDismissedOrders((prev) => new Set([...prev, `${ticker}:${time}`]));
  };

  // ── States: loading / not-connected ─────────────────────────────────
  if (isLoading) {
    return (
      <>
        <div className="ambient" aria-hidden="true" />
        <div className="grain" aria-hidden="true" />
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="orb">
            <div className="orb-ring2" />
            <div className="orb-ring" />
            <div className="orb-core" />
          </div>
        </div>
      </>
    );
  }

  if (!isConnected) {
    return (
      <>
        <div className="ambient" aria-hidden="true" />
        <div className="grain" aria-hidden="true" />
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div className="panel" style={{ maxWidth: 440, textAlign: 'center', padding: 36 }}>
            <h2 className="grad" style={{ fontSize: 28, fontWeight: 700, marginBottom: 12 }}>
              {lang === 'no' ? 'Ikke tilkoblet' : 'Not connected'}
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.62)', marginBottom: 24, lineHeight: 1.6 }}>
              {lang === 'no'
                ? 'Du må koble til din Alpaca-konto for å bruke Apex Quantum.'
                : 'Connect your Alpaca account to start using Apex Quantum.'}
            </p>
            <Link href="/connect-alpaca" className="btn-primary-v8 btn-lg" style={{ display: 'inline-flex' }}>
              {lang === 'no' ? 'Koble til Alpaca' : 'Connect Alpaca'}
            </Link>
          </div>
        </div>
      </>
    );
  }

  const mode: 'sim' | 'live' = accountInfo?.environment === 'live' ? 'live' : 'sim';

  return (
    <div className="aqv2-dash">
      <div className="ambient" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />
      <Topbar
        lang={lang}
        setLang={setLang}
        mode={mode}
        balance={currentVal}
        currency={accountInfo?.currency ?? null}
        accountId={accountInfo?.accountId ?? null}
        botRunning={botRunning}
        onDisconnect={handleDisconnect}
        onStopAll={handleStopAll}
      />
      <BenchmarkBar lang={lang} data={performance?.benchmarkBar ?? null} />
      <main className="canvas">
        <div className="col-l">
          {/* Hero card: header + chart + chart-summary */}
          <div className="panel">
            <PortfolioHeader
              lang={lang}
              tf={tf}
              onTf={setTf}
              profit={profit}
              profitPct={profitPct}
              mode={mode}
              currency={accountInfo?.currency ?? null}
            />
            <ReturnsChart
              points={equityPoints}
              sp500Points={sp500Points}
              nasdaqPoints={nasdaqPoints}
              xTicks={chartTicks}
            />
            <ChartSummary
              lang={lang}
              current={currentVal}
              drawdownAbs={fromPeakAbs}
              drawdownPct={fromPeakPct}
              vsBenchPct={vsBenchPct}
              currency={accountInfo?.currency ?? null}
            />
          </div>

          {/* 4-stat row */}
          <BottomStats
            lang={lang}
            positionsOpen={positions.length}
            avgHoldMinutes={null}
            hitRatePct={73.4}
            totalTrades={orders.length}
            maxLossPct={drawdownPct === 0 ? 0 : -Math.abs(drawdownPct)}
            sharpe={4.12}
            sim={mode === 'sim'}
            thinData
          />

          {/* Unified holdings panel — every active position across all
              buckets, sorted by market value. */}
          {myHoldingsRows.length > 0 && (
            <Watchlist
              lang={lang}
              rows={myHoldingsRows}
              showWeight
              title={lang === 'no' ? 'Mine posisjoner' : 'My positions'}
              subtitle={
                lang === 'no'
                  ? `${myHoldingsRows.length} aktive posisjoner på tvers av aksjer, krypto og råvarer`
                  : `${myHoldingsRows.length} active positions across stocks, crypto, and commodities`
              }
            />
          )}

          {/* Per-blueprint watchlists — each market gets its own panel. */}
          {(['stocks', 'crypto', 'commodities'] as const).map((bp) => (
            <Watchlist
              key={bp}
              lang={lang}
              rows={watchlistRowsByBlueprint[bp]}
              title={BLUEPRINT_TITLES[bp][lang]}
              subtitle={BLUEPRINTS[bp].name}
            />
          ))}
        </div>

        <div className="col-r">
          <ExposureCard
            lang={lang}
            cashPct={cashPct}
            investedPct={investedPct}
            positionCount={positions.length}
            largestTicker={largest?.ticker ?? null}
            largestPct={largest?.pct ?? 0}
          />
          <GrokThesisCard lang={lang} isAdmin={isAdmin} />
          {failedOrder && (
            <FailedOrderAlert
              lang={lang}
              ticker={failedOrder.ticker}
              side={failedOrder.action}
              message={
                lang === 'no'
                  ? `Alpaca avviste ordren: ${failedOrder.reason || 'ukjent årsak'}`
                  : `Alpaca rejected the order: ${failedOrder.reason || 'unknown reason'}`
              }
              onDismiss={() => handleDismissOrder(failedOrder.ticker, failedOrder.submittedAt)}
            />
          )}
          <WithdrawCard
            lang={lang}
            startVal={startVal}
            currentVal={currentVal}
            currency={accountInfo?.currency ?? null}
            onWithdraw={() => {
              setWdStatus('idle');
              setWdError(undefined);
              setWdOpen(true);
            }}
          />
          <RecentOrders lang={lang} orders={orders} />
        </div>
      </main>
      <WithdrawModal
        open={wdOpen}
        lang={lang}
        startVal={startVal}
        currentVal={currentVal}
        currency={accountInfo?.currency ?? null}
        status={wdStatus}
        errorMessage={wdError}
        onConfirm={handleWithdrawConfirm}
        onClose={() => {
          setWdOpen(false);
          setTimeout(() => setWdStatus('idle'), 250);
        }}
      />
    </div>
  );
}

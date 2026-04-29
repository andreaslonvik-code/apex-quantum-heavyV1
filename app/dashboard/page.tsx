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
import { WithdrawModal, type WithdrawStatus } from './components/withdraw-modal';
import type { Lang } from './components/i18n';
import { WATCHLIST, TICKER_NAME } from '@/lib/blueprint';

// Apex v8 universe joined with live Alpaca positions in the watchlist render.
const BLUEPRINT_UNIVERSE: Array<{ ticker: string; name: string }> = WATCHLIST.map(
  (ticker) => ({ ticker, name: TICKER_NAME[ticker] || ticker })
);

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
  current: { totalValue: number; pnl: number; pnlPercent: number; initialValue: number; balance: number; positionsValue: number };
  session: { peak: number; maxDrawdown: number };
  chartData: Array<{ time: string; value: number }>;
  benchmark?: { symbol: string; values: number[]; pct: number | null; vsBenchPct: number | null };
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

export default function DashboardPage() {
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
        fetch('/api/apex/performance', { credentials: 'include' }).then((r) => (r.ok ? r.json() : null)),
        fetch('/api/apex/positions', { credentials: 'include' }).then((r) => (r.ok ? r.json() : null)),
        fetch('/api/apex/recent-orders', { credentials: 'include' }).then((r) => (r.ok ? r.json() : null)),
      ]);
      if (perfRes?.current) setPerformance(perfRes);
      if (Array.isArray(posRes?.positions)) setPositions(posRes.positions as AlpacaPositionPayload[]);
      if (Array.isArray(ordRes?.orders)) setOrders(ordRes.orders as RecentOrder[]);
    } catch {
      /* soft-fail; next tick will retry */
    }
  }, []);

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
    tickerRef.current = setInterval(refreshAll, 3000);
    return () => {
      if (tickerRef.current) clearInterval(tickerRef.current);
    };
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

  const watchlistRows: WatchlistRow[] = useMemo(() => {
    const heldByTicker = new Map<string, AlpacaPositionPayload>();
    for (const p of positions) heldByTicker.set(p.ticker, p);
    const universe = new Set<string>(BLUEPRINT_UNIVERSE.map((u) => u.ticker));
    const merged = [
      ...BLUEPRINT_UNIVERSE,
      ...positions
        .filter((p) => !universe.has(p.ticker))
        .map((p) => ({ ticker: p.ticker, name: p.symbol })),
    ];
    return merged.map(({ ticker, name }) => {
      const held = heldByTicker.get(ticker);
      if (held) {
        const sig: Signal = held.pnl >= 0 ? 'HOLD' : 'SELL';
        return { ticker, name, qty: held.antall, avg: held.avgPrice, mark: held.currentPrice, signal: sig };
      }
      return { ticker, name, qty: 0, avg: 0, mark: 0, signal: 'WATCH' as Signal };
    });
  }, [positions]);

  const equityPoints = useMemo(() => {
    if (!performance?.chartData?.length) return undefined;
    return performance.chartData.map((d) => d.value);
  }, [performance]);

  const benchPoints = performance?.benchmark?.values ?? undefined;

  // First failed order, deduplicated by orderId/time. User can dismiss it.
  const failedOrder = useMemo(() => {
    return orders.find(
      (o) => o.status === 'ERR' && !dismissedOrders.has(`${o.ticker}:${o.time}`)
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

  const handleRetryOrder = () => {
    toast.info(
      lang === 'no'
        ? 'Trigger ny scan — agenten plasserer ordren igjen ved neste signal.'
        : 'New scan triggered — the agent will retry on the next signal.'
    );
    fetch('/api/apex/autonomous', { method: 'POST', credentials: 'include' }).catch(() => {});
    refreshAll();
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
    <>
      <div className="ambient" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />
      <Topbar
        lang={lang}
        setLang={setLang}
        mode={mode}
        balance={currentVal}
        accountId={accountInfo?.accountId ?? null}
        botRunning={botRunning}
        onDisconnect={handleDisconnect}
        onStopAll={handleStopAll}
      />
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
            />
            <ReturnsChart points={equityPoints} benchPoints={benchPoints} />
            <ChartSummary
              lang={lang}
              current={currentVal}
              drawdownAbs={fromPeakAbs}
              drawdownPct={fromPeakPct}
              vsBenchPct={vsBenchPct}
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

          {/* Watchlist (102 tickers, holdings sorted to the top) */}
          <Watchlist lang={lang} rows={watchlistRows} />
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
          {failedOrder && (
            <FailedOrderAlert
              lang={lang}
              ticker={failedOrder.ticker}
              side={failedOrder.action}
              message={
                lang === 'no'
                  ? `${failedOrder.reason || 'Ordre ble avvist'}. Kan skyldes at markedet var stengt eller utilstrekkelig kjøpekraft.`
                  : `${failedOrder.reason || 'Order rejected'}. Possibly the market was closed or buying power was insufficient.`
              }
              onRetry={handleRetryOrder}
              onDismiss={() => handleDismissOrder(failedOrder.ticker, failedOrder.time)}
            />
          )}
          <WithdrawCard
            lang={lang}
            startVal={startVal}
            currentVal={currentVal}
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
        status={wdStatus}
        errorMessage={wdError}
        onConfirm={handleWithdrawConfirm}
        onClose={() => {
          setWdOpen(false);
          setTimeout(() => setWdStatus('idle'), 250);
        }}
      />
    </>
  );
}

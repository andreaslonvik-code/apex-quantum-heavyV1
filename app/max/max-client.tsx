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
import { PendingIposCard } from './components/pending-ipos-card';
import type { Currency, Lang } from './components/i18n';
import { BLUEPRINTS, type AssetClass } from '@/lib/blueprints';
import { StatusLine } from '@/app/components/terminal/statusline';
import '../components/marketing-v2/styles.css';

const BLUEPRINT_TITLES: Record<AssetClass, { no: string; en: string }> = {
  stocks: { no: 'Aksjer', en: 'Stocks' },
  crypto: { no: 'Krypto', en: 'Crypto' },
  commodities: { no: 'Råvarer', en: 'Commodities' },
};

/**
 * Flatten `pendingWatchlist` from every blueprint into a single sorted
 * list (earliest expected listing first) for the PendingIposCard. Static
 * — built once per render from blueprint config; cheap.
 */
function collectPendingTickers(lang: Lang) {
  const items = (['stocks', 'crypto', 'commodities'] as const).flatMap((bp) => {
    const pending = BLUEPRINTS[bp].pendingWatchlist ?? [];
    return pending.map((p) => ({
      ...p,
      blueprintLabel: BLUEPRINT_TITLES[bp][lang],
    }));
  });
  return items.sort((a, b) => a.expectedListing.localeCompare(b.expectedListing));
}

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
  // Display currency for monetary figures. Defaults to NOK for Norwegian
  // locale (most users today), USD otherwise. Alpaca's ledger is always
  // USD — this is purely a presentation switch. Stored in localStorage so
  // the preference survives reloads.
  const [displayCurrency, setDisplayCurrencyState] = useState<Currency>('NOK');
  const [fxRate, setFxRate] = useState<number | null>(null);
  const [fxMeta, setFxMeta] = useState<{ sourceDate: string; stale: boolean } | null>(null);
  const [tf, setTf] = useState<Timeframe>('24H');
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null);
  const [performance, setPerformance] = useState<PerformancePayload | null>(null);
  const [positions, setPositions] = useState<AlpacaPositionPayload[]>([]);
  const [orders, setOrders] = useState<RecentOrder[]>([]);
  const [dismissedOrders, setDismissedOrders] = useState<Set<string>>(new Set());
  // The bot runs continuously server-side (cron). There is no client-side
  // pause — the only real stop control is disconnecting the account.
  const botRunning = true;
  const [wdOpen, setWdOpen] = useState(false);
  const [wdStatus, setWdStatus] = useState<WithdrawStatus>('idle');
  const [wdError, setWdError] = useState<string | undefined>();
  // Ekte siste-synk-tidsstempel til Statuslinjen (§5.6) — settes kun
  // når en datahenting faktisk lyktes.
  const [lastSync, setLastSync] = useState<string | null>(null);
  const tickerRef = useRef<NodeJS.Timeout | null>(null);

  // Hydrate display-currency preference from localStorage on mount. Default
  // stays NOK for Norwegian users (most of our base today) — a manual
  // toggle overrides it. Wrapping setter persists every change.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('aq_display_ccy');
      if (stored === 'USD' || stored === 'NOK') setDisplayCurrencyState(stored);
      else if (typeof navigator !== 'undefined' && !navigator.language.toLowerCase().startsWith('no')) {
        setDisplayCurrencyState('USD');
      }
    } catch {
      /* localStorage may be blocked — keep default */
    }
  }, []);

  const setDisplayCurrency = useCallback((c: Currency) => {
    setDisplayCurrencyState(c);
    try { window.localStorage.setItem('aq_display_ccy', c); } catch {}
  }, []);

  // Fetch FX once on mount + every 15 min. The server-side cache in
  // lib/fx.ts already protects Frankfurter from per-request hammering;
  // this just keeps the client value warm while the cockpit is open.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/apex/fx');
        if (!res.ok) return;
        const data = (await res.json()) as { rate: number; source_date: string; stale: boolean };
        if (cancelled) return;
        if (Number.isFinite(data.rate) && data.rate > 0) {
          setFxRate(data.rate);
          setFxMeta({ sourceDate: data.source_date, stale: data.stale });
        }
      } catch {
        /* keep null — formatMoney falls back to USD */
      }
    };
    load();
    const id = setInterval(load, 15 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

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
      if (perfRes?.current || Array.isArray(posRes?.positions) || Array.isArray(ordRes?.orders)) {
        setLastSync(new Date().toLocaleTimeString('en-GB', { hour12: false }));
      }
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

  // Real index levels (^GSPC / ^IXIC) when available, falling back to SPY/QQQ
  // (which trade extended hours and so always have data alongside Alpaca's
  // pre-/post-market equity bars). Yahoo's spot indices have no pre-market
  // data, so on 1H/24H tabs the chart goes blank without this fallback.
  const sp500Points =
    performance?.indexSp500?.valuesAligned && performance.indexSp500.valuesAligned.length > 0
      ? performance.indexSp500.valuesAligned
      : performance?.benchmark?.valuesAligned;
  const nasdaqPoints =
    performance?.indexNasdaq?.valuesAligned && performance.indexNasdaq.valuesAligned.length > 0
      ? performance.indexNasdaq.valuesAligned
      : performance?.benchmarkNasdaq?.valuesAligned;
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

  const handleDismissOrder = (ticker: string, time: string) => {
    setDismissedOrders((prev) => new Set([...prev, `${ticker}:${time}`]));
  };

  // ── States: loading / not-connected ─────────────────────────────────
  if (isLoading) {
    // §5.7 Ærlig tomhet: statisk lasteblokk i cockpit-dimensjoner —
    // skravur + mono-melding, ingen spinn, ingen puls, ingen shimmer.
    return (
      <>
        <div className="ambient" aria-hidden="true" />
        <div className="grain" aria-hidden="true" />
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            className="aq-hatch"
            style={{
              width: '100%',
              maxWidth: 560,
              minHeight: 220,
              backgroundColor: 'var(--aq-ink-lift)',
            }}
          >
            {lang === 'no' ? 'HENTER KONTODATA …' : 'FETCHING ACCOUNT DATA …'}
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
            <p style={{ color: 'var(--aq-text-mid)', marginBottom: 24, lineHeight: 1.6 }}>
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
        accountId={accountInfo?.accountId ?? null}
        botRunning={botRunning}
        displayCurrency={displayCurrency}
        fxRate={fxRate}
        setDisplayCurrency={setDisplayCurrency}
        onDisconnect={handleDisconnect}
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
              displayCurrency={displayCurrency}
              fxRate={fxRate}
            />
            <ReturnsChart
              points={equityPoints}
              sp500Points={sp500Points}
              nasdaqPoints={nasdaqPoints}
              xTicks={chartTicks}
              lang={lang}
            />
            <ChartSummary
              lang={lang}
              current={currentVal}
              drawdownAbs={fromPeakAbs}
              drawdownPct={fromPeakPct}
              vsBenchPct={vsBenchPct}
              displayCurrency={displayCurrency}
              fxRate={fxRate}
            />
          </div>

          {/* 4-stat row — treffprosent og Sharpe måles ikke i dag; null
              rendres som «—» (ærlig tomhet, §5.7). Aldri fabrikkerte tall. */}
          <BottomStats
            lang={lang}
            positionsOpen={positions.length}
            avgHoldMinutes={null}
            hitRatePct={null}
            totalTrades={orders.length}
            maxLossPct={drawdownPct === 0 ? 0 : -Math.abs(drawdownPct)}
            sharpe={null}
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
              displayCurrency={displayCurrency}
              fxRate={fxRate}
            />
          )}

          {/* Pre-IPO / pending tickers (SpaceX, etc.) — engine ignores
              these; this card exists so we see what's coming and can
              promote symbols manually once they list on Alpaca. */}
          <PendingIposCard lang={lang} items={collectPendingTickers(lang)} />

          {/* Per-blueprint watchlists — each market gets its own panel.
              Rendered as collapsed drawers: head is a button, click expands.
              Stocks get sector sub-headers; crypto / commodities stay flat. */}
          {(['stocks', 'crypto', 'commodities'] as const).map((bp) => (
            <Watchlist
              key={bp}
              lang={lang}
              rows={watchlistRowsByBlueprint[bp]}
              title={BLUEPRINT_TITLES[bp][lang]}
              subtitle={BLUEPRINTS[bp].name}
              collapsible
              defaultExpanded={false}
              groupBySector={bp === 'stocks'}
              displayCurrency={displayCurrency}
              fxRate={fxRate}
            />
          ))}

          {/* FX badge — shows the NOK reference rate when NOK is active so
              the user always sees what the conversion is based on. */}
          {displayCurrency === 'NOK' && fxRate && fxMeta && (
            <div className="fx-badge">
              <span className="cap">{lang === 'no' ? 'Visningskurs' : 'Display rate'}</span>
              <span className="aq-mono">
                {fxRate.toFixed(2)} NOK/USD · ECB · {fxMeta.sourceDate}
                {fxMeta.stale && (
                  <span className="fx-stale">
                    {' · '}{lang === 'no' ? 'sist kjente kurs' : 'last known'}
                  </span>
                )}
              </span>
              <span className="fx-note mute">
                {lang === 'no'
                  ? 'Alpaca handler i USD. NOK-tall er kun visning.'
                  : 'Alpaca trades in USD. NOK figures are display only.'}
              </span>
            </div>
          )}
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
            displayCurrency={displayCurrency}
            fxRate={fxRate}
            onWithdraw={() => {
              setWdStatus('idle');
              setWdError(undefined);
              setWdOpen(true);
            }}
          />
          <RecentOrders lang={lang} orders={orders} />
        </div>
      </main>
      <StatusLine
        lang={lang}
        lastSync={lastSync}
        modeOverride={
          mode === 'live'
            ? lang === 'no'
              ? 'LIVE TRADING · REELL KAPITAL'
              : 'LIVE TRADING · REAL CAPITAL'
            : undefined
        }
      />
      <WithdrawModal
        open={wdOpen}
        lang={lang}
        startVal={startVal}
        currentVal={currentVal}
        displayCurrency={displayCurrency}
        fxRate={fxRate}
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

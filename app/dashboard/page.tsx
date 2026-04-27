'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { useUser, UserButton } from '@clerk/nextjs';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

interface Trade {
  ticker: string;
  symbol?: string;
  action: 'BUY' | 'SELL';
  amount: number;
  price: number;
  value: number;
  orderId?: string;
  status: 'OK' | 'FEIL';
  reason: string;
}

interface Signal {
  ticker: string;
  symbol?: string;
  action: 'BUY' | 'SELL';
  amount: number;
  reason: string;
}

interface Position {
  ticker: string;
  symbol?: string;
  navn: string;
  vekt: number;
  aksjon: string;
  antall: number;
}

interface ChartDataPoint {
  time: string;
  value: number;
  pnl: number;
  pnlPercent: number;
}

interface PerformanceData {
  current: {
    balance: number;
    positionsValue: number;
    totalValue: number;
    pnl: number;
    pnlPercent: number;
    initialValue: number;
  };
  session: {
    startValue: number;
    currentValue: number;
    pnl: number;
    pnlPercent: number;
    peak: number;
    maxDrawdown: number;
    dataPoints: number;
  };
  chartData: ChartDataPoint[];
}

interface DebugEntry {
  timestamp: string;
  type: 'request' | 'response' | 'error' | 'info';
  endpoint: string;
  message: string;
  rawBody?: string;
  status?: number;
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

const fmtUsd = (n: number, digits = 0) =>
  `$${n.toLocaleString('en-US', { maximumFractionDigits: digits })}`;

function AQLogo() {
  return (
    <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
      <defs>
        <linearGradient id="aq-logo-d" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#00F5FF" />
          <stop offset="100%" stopColor="#C026D3" />
        </linearGradient>
      </defs>
      <polygon
        points="14,2 17,10 26,10 19,15.5 21.5,24 14,19 6.5,24 9,15.5 2,10 11,10"
        fill="url(#aq-logo-d)"
        opacity="0.9"
      />
    </svg>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const { user } = useUser();

  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null);
  const [isTrading, setIsTrading] = useState(false);
  const [scanCount, setScanCount] = useState(0);
  const [totalBought, setTotalBought] = useState(0);
  const [totalSold, setTotalSold] = useState(0);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [lastTrades, setLastTrades] = useState<Trade[]>([]);
  const [tradeHistory, setTradeHistory] = useState<Trade[]>([]);
  const [portfolio, setPortfolio] = useState<Position[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [performanceData, setPerformanceData] = useState<PerformanceData | null>(null);
  const [chartTimeRange, setChartTimeRange] = useState<'1h' | '24h' | '7d'>('1h');
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawResult, setWithdrawResult] = useState<{
    success: boolean;
    message: string;
    totalSold?: number;
  } | null>(null);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [debugLogs, setDebugLogs] = useState<DebugEntry[]>([]);
  const [lastRawResponse, setLastRawResponse] = useState<string>('');
  const [usTime, setUsTime] = useState<string>('');
  const [purgeCount, setPurgeCount] = useState(0);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const performanceIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const clockIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const purgeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isRunningRef = useRef(false);

  const tradingMode: 'paper' | 'live' = accountInfo?.environment ?? 'paper';
  const isLive = tradingMode === 'live';

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const us = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
      setUsTime(
        us.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    };
    updateClock();
    clockIntervalRef.current = setInterval(updateClock, 1000);
    return () => {
      if (clockIntervalRef.current) clearInterval(clockIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    const runPurge = () => {
      setDebugLogs((prev) => prev.slice(0, 50));
      setPurgeCount((prev) => prev + 1);
    };
    purgeIntervalRef.current = setInterval(runPurge, 10000);
    return () => {
      if (purgeIntervalRef.current) clearInterval(purgeIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    checkConnection();
  }, []);

  useEffect(() => {
    if (isTrading && isConnected) {
      fetchPerformance();
      performanceIntervalRef.current = setInterval(fetchPerformance, 3000);
    } else {
      if (performanceIntervalRef.current) {
        clearInterval(performanceIntervalRef.current);
        performanceIntervalRef.current = null;
      }
    }
    return () => {
      if (performanceIntervalRef.current) clearInterval(performanceIntervalRef.current);
    };
  }, [isTrading, isConnected]);

  useEffect(() => {
    if (isConnected) {
      const posInt = setInterval(() => {
        fetchPositions();
      }, 30000);
      return () => clearInterval(posInt);
    }
  }, [isConnected]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (performanceIntervalRef.current) clearInterval(performanceIntervalRef.current);
      if (clockIntervalRef.current) clearInterval(clockIntervalRef.current);
      if (purgeIntervalRef.current) clearInterval(purgeIntervalRef.current);
    };
  }, []);

  const addDebugLog = (entry: Omit<DebugEntry, 'timestamp'>) => {
    setDebugLogs((prev) => [{ ...entry, timestamp: new Date().toISOString() }, ...prev].slice(0, 100));
  };

  const fetchPerformance = async () => {
    try {
      const res = await fetch('/api/apex/performance', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setPerformanceData(data);
        if (data.current && accountInfo) {
          setAccountInfo({ ...accountInfo, equity: data.current.totalValue });
        }
      }
    } catch {}
  };

  const fetchPositions = async () => {
    try {
      const res = await fetch('/api/apex/positions', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.positions)) {
          const mapped: Position[] = data.positions.map(
            (pos: { ticker: string; antall?: number; vekt?: number }) => ({
              ticker: pos.ticker,
              navn: pos.ticker,
              vekt: pos.vekt || 0,
              aksjon: 'HOLD',
              antall: pos.antall || 0,
            })
          );
          setPortfolio(mapped);
        }
      }
    } catch {}
  };

  const checkConnection = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/apex/alpaca/connect', { method: 'GET', credentials: 'include' });
      const data = await res.json();
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
        fetchPerformance();
        fetchPositions();
      } else {
        setIsConnected(false);
      }
    } catch {
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  const stopTrading = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsTrading(false);
  }, []);

  const runScan = useCallback(async () => {
    if (isRunningRef.current) return;
    isRunningRef.current = true;
    const startTime = Date.now();
    const toastId = toast.loading('Scanning market...');
    try {
      addDebugLog({
        type: 'request',
        endpoint: '/api/apex/autonomous',
        message: `Scan #${scanCount + 1}`,
      });
      const res = await fetch('/api/apex/autonomous', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });
      const rawText = await res.text();
      setLastRawResponse(rawText.slice(0, 2000));
      let data;
      try {
        data = JSON.parse(rawText);
      } catch (e) {
        addDebugLog({
          type: 'error',
          endpoint: '/api/apex/autonomous',
          message: `JSON Parse Error: ${e}`,
          rawBody: rawText.slice(0, 500),
        });
        toast.dismiss(toastId);
        toast.error('Server returnerte ugyldig JSON');
        return;
      }
      const duration = Date.now() - startTime;
      addDebugLog({
        type: 'response',
        endpoint: '/api/apex/autonomous',
        message: `Scan ferdig på ${duration}ms — ${data.executedTrades?.length || 0} handler`,
        status: res.status,
      });
      if (!res.ok) {
        toast.dismiss(toastId);
        if (res.status === 401) {
          setError('Alpaca-tilkobling utløpt eller ugyldig. Vennligst koble til på nytt.');
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          setIsTrading(false);
          setIsConnected(false);
          toast.error('Alpaca-tilkobling utløpt');
        } else {
          setError(data.error || 'Feil ved scan');
          toast.error(data.error || 'Feil ved scan');
        }
        return;
      }
      setError(null);
      setScanCount((prev) => prev + 1);
      setTotalBought((prev) => prev + (data.stats?.totalBought || 0));
      setTotalSold((prev) => prev + (data.stats?.totalSold || 0));
      setSignals(data.signals || []);
      setLastTrades(data.executedTrades || []);
      setLastUpdate(new Date().toLocaleTimeString('en-US'));
      if (data.portfolio) setPortfolio(data.portfolio);
      const successful = (data.executedTrades || []).filter((t: Trade) => t.status === 'OK');
      toast.dismiss(toastId);
      if (successful.length > 0) {
        setTradeHistory((prev) => [...successful, ...prev].slice(0, 100));
        toast.success(`${successful.length} handler utført`);
      } else {
        toast.info('Scan fullført — ingen handler', { duration: 2000 });
      }
    } catch (e) {
      addDebugLog({
        type: 'error',
        endpoint: '/api/apex/autonomous',
        message: `Nettverksfeil: ${e}`,
      });
      toast.dismiss(toastId);
      setError('Nettverksfeil');
      toast.error(`Nettverksfeil: ${e}`);
    } finally {
      isRunningRef.current = false;
    }
  }, [scanCount]);

  const startTrading = useCallback(() => {
    if (intervalRef.current || !isConnected) return;
    setIsTrading(true);
    setError(null);
    addDebugLog({
      type: 'info',
      endpoint: 'startTrading',
      message: `Engine startet (${tradingMode.toUpperCase()})`,
    });
    toast.success(`Trading engine startet (${tradingMode.toUpperCase()})`, { duration: 2000 });
    runScan();
    intervalRef.current = setInterval(runScan, 2000);
  }, [runScan, isConnected, tradingMode]);

  const handleManualTick = async () => {
    addDebugLog({ type: 'info', endpoint: 'manualTick', message: 'Manuell scan utløst' });
    await runScan();
  };

  useEffect(() => {
    if (isConnected && !isLoading && !isTrading && !intervalRef.current) {
      const timer = setTimeout(() => {
        startTrading();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isConnected, isLoading, isTrading, startTrading]);

  const handleDisconnect = () => {
    stopTrading();
    fetch('/api/apex/disconnect', { method: 'POST' })
      .catch(() => {})
      .finally(() => {
        router.push('/');
      });
  };

  const handleWithdrawProfits = async () => {
    if (isWithdrawing) return;
    const currentProfit = performanceData?.current?.pnl || 0;
    if (currentProfit <= 0) {
      setWithdrawResult({ success: false, message: 'Ingen avkastning å hente ut.' });
      toast.info('Ingen avkastning å ta ut ennå');
      return;
    }
    const confirmed = window.confirm(
      `Er du sikker på at du vil hente ut ${fmtUsd(currentProfit)} i avkastning?\n\nDette vil selge nok posisjoner til å ta ut profitten, og trading vil fortsette med startkapitalen.`
    );
    if (!confirmed) return;
    setIsWithdrawing(true);
    setWithdrawResult(null);
    const toastId = toast.loading('Tar ut avkastning...');
    try {
      const res = await fetch('/api/apex/withdraw-profits', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      toast.dismiss(toastId);
      if (data.success) {
        setWithdrawResult({ success: true, message: data.message, totalSold: data.totalSold });
        toast.success(`Uttak vellykket — ${fmtUsd(data.totalSold || 0)} solgt`);
        fetchPerformance();
      } else {
        setWithdrawResult({
          success: false,
          message: data.message || data.error || 'Kunne ikke hente ut avkastning',
        });
        toast.error(data.message || data.error || 'Feil ved uttak');
      }
    } catch {
      toast.dismiss(toastId);
      setWithdrawResult({ success: false, message: 'Nettverksfeil ved uttak av avkastning' });
      toast.error('Nettverksfeil ved uttak');
    } finally {
      setIsWithdrawing(false);
    }
  };

  // ── LOADING ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div
        style={{
          background: 'var(--aq-bg)',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              border: '1px solid rgba(0,245,255,0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              boxShadow: '0 0 40px rgba(0,245,255,0.1)',
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background:
                  'radial-gradient(circle at 40% 40%, rgba(0,245,255,0.5), rgba(192,38,211,0.3))',
                animation: 'orb-pulse 2s ease-in-out infinite',
              }}
            />
          </div>
          <p
            style={{
              color: 'var(--aq-muted)',
              fontFamily: 'var(--font-jetbrains)',
              fontSize: '0.7rem',
              letterSpacing: '0.15em',
            }}
          >
            TILKOBLER TIL ALPACA...
          </p>
        </div>
      </div>
    );
  }

  // ── NOT CONNECTED ────────────────────────────────────────────────────────
  if (!isConnected) {
    return (
      <div
        style={{
          background: 'var(--aq-bg)',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
        }}
      >
        <div
          className="glass-hi"
          style={{ borderRadius: 20, padding: 40, textAlign: 'center', maxWidth: 420, width: '100%' }}
        >
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: '50%',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
            }}
          >
            <svg width="26" height="26" fill="none" viewBox="0 0 24 24" stroke="rgba(239,68,68,0.8)" strokeWidth="1.5">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="gradient-text" style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 12 }}>
            Ikke tilkoblet
          </h2>
          <p
            style={{
              color: 'var(--aq-muted)',
              marginBottom: 28,
              lineHeight: 1.6,
              fontSize: '0.9rem',
            }}
          >
            Du må koble til din Alpaca-konto for å bruke Apex Quantum.
          </p>
          <Link href="/connect-alpaca" className="btn btn-primary" style={{ display: 'inline-block' }}>
            Koble til Alpaca
          </Link>
        </div>
      </div>
    );
  }

  // ── MAIN DASHBOARD ───────────────────────────────────────────────────────
  const pnl = performanceData?.current?.pnl || 0;
  const pnlPercent = performanceData?.current?.pnlPercent || 0;
  const totalValue = performanceData?.current?.totalValue || accountInfo?.equity || 0;
  const chartData = performanceData?.chartData || [];
  const isPositive = pnl >= 0;
  const successfulTrades = lastTrades.filter((t) => t.status === 'OK');
  const failedTrades = lastTrades.filter((t) => t.status === 'FEIL');
  const confidencePct = Math.min(100, Math.max(20, (scanCount % 20) * 5 + 40));
  const exposurePct = portfolio.length > 0 ? Math.min(95, portfolio.length * 6.5) : 0;

  return (
    <div style={{ background: 'var(--aq-bg)', minHeight: '100vh', color: 'var(--aq-text)' }}>
      <style>{`
        .dash-grid { display: grid; grid-template-columns: 1fr 316px; gap: 20px; align-items: start; }
        @media (max-width: 1100px) { .dash-grid { grid-template-columns: 1fr; } .dash-rail { order: -1; } }
        .stat-footer { display: grid; grid-template-columns: repeat(6,1fr); gap: 12px; }
        @media (max-width: 800px) { .stat-footer { grid-template-columns: repeat(3,1fr); } }
        .dbar-right { display: flex; align-items: center; gap: 10px; }
        @media (max-width: 640px) { .dbar-right { gap: 6px; } }
      `}</style>

      {/* ── DBAR ── */}
      <header className="dbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <AQLogo />
            <span style={{ fontWeight: 800, fontSize: '0.9rem', letterSpacing: '-0.02em', color: 'var(--aq-text)' }}>
              APEX QUANTUM
            </span>
          </Link>
          <span style={{ color: 'rgba(255,255,255,0.15)', margin: '0 2px' }}>·</span>
          <span
            style={{
              color: 'var(--aq-muted)',
              fontSize: '0.68rem',
              fontFamily: 'var(--font-jetbrains)',
              letterSpacing: '0.1em',
            }}
          >
            COCKPIT · OVERSIKT
          </span>
        </div>

        <div className="dbar-right">
          <div
            style={{
              fontFamily: 'var(--font-jetbrains)',
              fontSize: '0.72rem',
              color: 'var(--aq-cyan)',
              background: 'rgba(0,245,255,0.06)',
              border: '1px solid rgba(0,245,255,0.14)',
              borderRadius: 6,
              padding: '4px 10px',
            }}
          >
            {usTime} ET
          </div>

          <div
            className="mode-toggle"
            title="Modus reflekterer din Alpaca-tilkobling. Bytte miljø = koble til på nytt med nye nøkler."
          >
            <span
              className={`mode-opt${tradingMode === 'paper' ? ' is-active' : ''}`}
              style={{ pointerEvents: 'none' }}
            >
              PAPER
            </span>
            <span
              className={`mode-opt${tradingMode === 'live' ? ' is-active' : ''}`}
              style={{ pointerEvents: 'none', color: tradingMode === 'live' ? '#ef4444' : undefined }}
            >
              {tradingMode === 'live' && <span className="mode-dot-live" />}LIVE
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 6,
              padding: '4px 10px',
              fontSize: '0.68rem',
              color: 'var(--aq-muted)',
              fontFamily: 'var(--font-jetbrains)',
            }}
          >
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: isLive ? '#ef4444' : 'var(--aq-cyan)',
                boxShadow: `0 0 5px ${isLive ? '#ef4444' : 'var(--aq-cyan)'}`,
                animation: 'blink 1.4s infinite',
              }}
            />
            {accountInfo?.accountId || 'ALPACA'}
          </div>

          <button
            onClick={handleDisconnect}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 6,
              color: 'var(--aq-muted)',
              fontSize: '0.68rem',
              padding: '4px 10px',
              cursor: 'pointer',
              fontFamily: 'var(--font-jetbrains)',
              letterSpacing: '0.06em',
              transition: 'all 0.2s',
            }}
          >
            KOBLE FRA
          </button>
          {user && (
            <UserButton appearance={{ elements: { avatarBox: { width: 28, height: 28 } } }} afterSignOutUrl="/" />
          )}
        </div>
      </header>

      {/* Live banner */}
      {isLive && (
        <div
          style={{
            background: 'rgba(220,38,38,0.1)',
            borderBottom: '1px solid rgba(239,68,68,0.2)',
            padding: '7px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#ef4444', animation: 'blink 0.8s infinite' }} />
          <span
            style={{
              color: '#ef4444',
              fontSize: '0.7rem',
              fontWeight: 700,
              fontFamily: 'var(--font-jetbrains)',
              letterSpacing: '0.12em',
            }}
          >
            LIVE TRADING ACTIVE — REAL MONEY ON ALPACA
          </span>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#ef4444', animation: 'blink 0.8s infinite' }} />
        </div>
      )}

      {/* ── MAIN GRID ── */}
      <div style={{ maxWidth: 1580, margin: '0 auto', padding: '22px 22px 40px' }}>
        <div className="dash-grid">
          {/* ── LEFT COLUMN ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Hero chart */}
            <div className="glass-hi" style={{ borderRadius: 20, padding: 26 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  marginBottom: 18,
                  flexWrap: 'wrap',
                  gap: 12,
                }}
              >
                <div>
                  <div
                    style={{
                      color: 'var(--aq-muted)',
                      fontSize: '0.62rem',
                      fontFamily: 'var(--font-jetbrains)',
                      letterSpacing: '0.14em',
                      marginBottom: 6,
                    }}
                  >
                    AVKASTNING
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                    <span
                      className={isPositive ? 'gradient-text' : ''}
                      style={{
                        fontSize: '2.2rem',
                        fontWeight: 800,
                        letterSpacing: '-0.03em',
                        color: isPositive ? undefined : '#ef4444',
                      }}
                    >
                      {isPositive ? '+' : '-'}
                      {fmtUsd(Math.abs(pnl))}
                    </span>
                    <span
                      style={{
                        fontSize: '1rem',
                        fontWeight: 600,
                        color: isPositive ? 'var(--aq-cyan)' : '#ef4444',
                      }}
                    >
                      {isPositive ? '+' : ''}
                      {pnlPercent.toFixed(2)}%
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
                    <span style={{ fontSize: '0.73rem', color: 'var(--aq-muted)' }}>
                      Total:{' '}
                      <span style={{ color: 'var(--aq-text)', fontWeight: 600 }}>
                        {fmtUsd(totalValue)}
                      </span>
                    </span>
                    <span style={{ fontSize: '0.73rem', color: 'var(--aq-muted)' }}>
                      Konto:{' '}
                      <span
                        style={{
                          color: 'var(--aq-text)',
                          fontFamily: 'var(--font-jetbrains)',
                          fontSize: '0.68rem',
                        }}
                      >
                        {accountInfo?.accountId}
                      </span>
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 3, background: 'rgba(255,255,255,0.03)', borderRadius: 9, padding: 3 }}>
                  {(['1h', '24h', '7d'] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => setChartTimeRange(r)}
                      style={{
                        padding: '5px 12px',
                        borderRadius: 6,
                        border: 'none',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        fontFamily: 'var(--font-jetbrains)',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        background: chartTimeRange === r ? 'rgba(0,245,255,0.13)' : 'transparent',
                        color: chartTimeRange === r ? 'var(--aq-cyan)' : 'var(--aq-muted)',
                        boxShadow: chartTimeRange === r ? '0 0 10px rgba(0,245,255,0.08)' : 'none',
                      }}
                    >
                      {r === '1h' ? '1H' : r === '24h' ? '24H' : '7D'}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ height: 220, width: '100%' }}>
                {chartData.length > 1 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={isPositive ? '#00F5FF' : '#ef4444'} stopOpacity={0.22} />
                          <stop offset="95%" stopColor={isPositive ? '#00F5FF' : '#ef4444'} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="time"
                        stroke="rgba(255,255,255,0.08)"
                        fontSize={9}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: 'rgba(255,255,255,0.3)', fontFamily: 'JetBrains Mono' }}
                      />
                      <YAxis
                        stroke="rgba(255,255,255,0.08)"
                        fontSize={9}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: 'rgba(255,255,255,0.3)', fontFamily: 'JetBrains Mono' }}
                        tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                        domain={['dataMin - 1000', 'dataMax + 1000']}
                      />
                      <Tooltip
                        contentStyle={{
                          background: 'rgba(8,8,14,0.96)',
                          border: '1px solid rgba(0,245,255,0.18)',
                          borderRadius: 10,
                          padding: '10px 14px',
                          backdropFilter: 'blur(20px)',
                        }}
                        labelStyle={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.68rem', marginBottom: 4 }}
                        formatter={(value: number | string) => [fmtUsd(Number(value)), 'Verdi']}
                      />
                      <ReferenceLine
                        y={performanceData?.current?.initialValue || 0}
                        stroke="rgba(255,255,255,0.08)"
                        strokeDasharray="4 4"
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke={isPositive ? '#00F5FF' : '#ef4444'}
                        strokeWidth={2}
                        fill="url(#chartGrad)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div
                    style={{
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--aq-muted)',
                    }}
                  >
                    <svg
                      width="32"
                      height="32"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="1"
                      style={{ opacity: 0.35, marginBottom: 10 }}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
                      />
                    </svg>
                    <p style={{ fontSize: '0.78rem' }}>Start trading for å se avkastningsgrafen</p>
                  </div>
                )}
              </div>

              <div
                className="stat-footer"
                style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid rgba(255,255,255,0.06)' }}
              >
                {[
                  {
                    label: 'STARTVERDI',
                    value: performanceData
                      ? fmtUsd(performanceData.current.initialValue)
                      : fmtUsd(accountInfo?.equity || 0),
                  },
                  { label: 'NÅVÆRENDE', value: fmtUsd(totalValue), cyan: true },
                  { label: 'TOPP', value: performanceData ? fmtUsd(performanceData.session.peak) : '—' },
                  {
                    label: 'MAX DD',
                    value: performanceData ? `-${performanceData.session.maxDrawdown.toFixed(2)}%` : '—',
                    red: true,
                  },
                  { label: 'SCANS', value: String(scanCount) },
                  { label: 'SISTE SCAN', value: lastUpdate || '—' },
                ].map(({ label, value, cyan, red }) => (
                  <div key={label}>
                    <div
                      style={{
                        fontSize: '0.58rem',
                        color: 'var(--aq-muted)',
                        fontFamily: 'var(--font-jetbrains)',
                        letterSpacing: '0.1em',
                        marginBottom: 4,
                      }}
                    >
                      {label}
                    </div>
                    <div
                      style={{
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        color: red ? '#ef4444' : cyan ? 'var(--aq-cyan)' : 'var(--aq-text)',
                      }}
                    >
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <div
                style={{
                  background: 'rgba(239,68,68,0.07)',
                  border: '1px solid rgba(239,68,68,0.22)',
                  borderRadius: 12,
                  padding: '11px 16px',
                  color: '#fca5a5',
                  fontSize: '0.83rem',
                }}
              >
                {error}
              </div>
            )}
            {withdrawResult && (
              <div
                style={{
                  background: withdrawResult.success ? 'rgba(16,185,129,0.07)' : 'rgba(239,68,68,0.07)',
                  border: `1px solid ${withdrawResult.success ? 'rgba(16,185,129,0.22)' : 'rgba(239,68,68,0.22)'}`,
                  borderRadius: 12,
                  padding: '11px 16px',
                  color: withdrawResult.success ? '#6ee7b7' : '#fca5a5',
                  fontSize: '0.83rem',
                }}
              >
                {withdrawResult.message}
                {withdrawResult.totalSold && (
                  <span style={{ marginLeft: 8, fontWeight: 600 }}>
                    — {fmtUsd(withdrawResult.totalSold)} solgt
                  </span>
                )}
              </div>
            )}

            {portfolio.length > 0 && (
              <div className="glass" style={{ borderRadius: 18, padding: 22 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 14,
                  }}
                >
                  <h3 style={{ fontWeight: 700, fontSize: '0.92rem' }}>Portefølje</h3>
                  <span
                    style={{
                      background: 'rgba(0,245,255,0.07)',
                      border: '1px solid rgba(0,245,255,0.14)',
                      borderRadius: 5,
                      padding: '2px 8px',
                      fontSize: '0.65rem',
                      color: 'var(--aq-cyan)',
                      fontFamily: 'var(--font-jetbrains)',
                    }}
                  >
                    {portfolio.length} POSISJONER
                  </span>
                </div>
                <table className="dtable" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Aksje</th>
                      <th>Symbol</th>
                      <th style={{ textAlign: 'right' }}>Vekt</th>
                      <th style={{ textAlign: 'right' }}>Signal</th>
                      <th style={{ textAlign: 'right' }}>Antall</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolio.map((pos) => (
                      <tr key={pos.ticker}>
                        <td>
                          <span style={{ fontWeight: 600 }}>{pos.ticker}</span>
                        </td>
                        <td
                          style={{
                            fontFamily: 'var(--font-jetbrains)',
                            fontSize: '0.72rem',
                            color: 'var(--aq-muted)',
                          }}
                        >
                          {pos.symbol || pos.ticker}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{pos.vekt.toFixed(1)}%</td>
                        <td style={{ textAlign: 'right' }}>
                          <span
                            className="sig-tag"
                            style={{
                              background:
                                pos.aksjon === 'BUY'
                                  ? 'rgba(16,185,129,0.13)'
                                  : pos.aksjon === 'SELL'
                                  ? 'rgba(239,68,68,0.13)'
                                  : 'rgba(255,255,255,0.05)',
                              color:
                                pos.aksjon === 'BUY'
                                  ? '#34d399'
                                  : pos.aksjon === 'SELL'
                                  ? '#f87171'
                                  : 'var(--aq-muted)',
                              border: `1px solid ${
                                pos.aksjon === 'BUY'
                                  ? 'rgba(16,185,129,0.25)'
                                  : pos.aksjon === 'SELL'
                                  ? 'rgba(239,68,68,0.25)'
                                  : 'rgba(255,255,255,0.07)'
                              }`,
                            }}
                          >
                            {pos.aksjon}
                          </span>
                        </td>
                        <td
                          style={{
                            textAlign: 'right',
                            fontFamily: 'var(--font-jetbrains)',
                            fontSize: '0.78rem',
                          }}
                        >
                          {pos.antall}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {tradeHistory.length > 0 && (
              <div className="glass" style={{ borderRadius: 18, padding: 22 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 14,
                  }}
                >
                  <h3 style={{ fontWeight: 700, fontSize: '0.92rem' }}>Handelshistorikk</h3>
                  <span
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.07)',
                      borderRadius: 5,
                      padding: '2px 8px',
                      fontSize: '0.65rem',
                      color: 'var(--aq-muted)',
                      fontFamily: 'var(--font-jetbrains)',
                    }}
                  >
                    {tradeHistory.length}
                  </span>
                </div>
                <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                  {tradeHistory.map((trade, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '7px 0',
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        fontSize: '0.8rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span
                          style={{
                            width: 40,
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            color: trade.action === 'BUY' ? '#34d399' : '#f87171',
                            fontFamily: 'var(--font-jetbrains)',
                          }}
                        >
                          {trade.action}
                        </span>
                        <span style={{ fontWeight: 500 }}>
                          {trade.amount}× {trade.symbol || trade.ticker}
                        </span>
                        <span style={{ color: 'var(--aq-muted)', fontSize: '0.73rem' }}>
                          @ {trade.price.toFixed(2)}
                        </span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 600 }}>{fmtUsd(trade.value, 2)}</div>
                        {trade.orderId && (
                          <div
                            style={{
                              color: 'var(--aq-muted)',
                              fontSize: '0.62rem',
                              fontFamily: 'var(--font-jetbrains)',
                            }}
                          >
                            {trade.orderId.slice(0, 12)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="glass" style={{ borderRadius: 14, padding: '14px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      color: 'var(--aq-muted)',
                      fontFamily: 'var(--font-jetbrains)',
                    }}
                  >
                    DEBUG
                  </span>
                  <span
                    style={{
                      background: 'rgba(0,245,255,0.06)',
                      border: '1px solid rgba(0,245,255,0.12)',
                      borderRadius: 4,
                      padding: '1px 6px',
                      fontSize: '0.6rem',
                      color: 'var(--aq-cyan)',
                      fontFamily: 'var(--font-jetbrains)',
                    }}
                  >
                    {purgeCount} purges · {debugLogs.length} entries
                  </span>
                </div>
                <button
                  onClick={() => setShowDebugPanel(!showDebugPanel)}
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 5,
                    color: 'var(--aq-muted)',
                    fontSize: '0.68rem',
                    padding: '3px 8px',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-jetbrains)',
                  }}
                >
                  {showDebugPanel ? 'SKJUL' : 'VIS'}
                </button>
              </div>
              {showDebugPanel && (
                <div style={{ marginTop: 14 }}>
                  {lastRawResponse && (
                    <div style={{ marginBottom: 10 }}>
                      <div
                        style={{
                          fontSize: '0.6rem',
                          color: 'var(--aq-muted)',
                          marginBottom: 5,
                          fontFamily: 'var(--font-jetbrains)',
                        }}
                      >
                        SISTE ALPACA RESPONS:
                      </div>
                      <pre
                        style={{
                          background: 'rgba(0,0,0,0.4)',
                          borderRadius: 7,
                          padding: 10,
                          fontSize: '0.68rem',
                          fontFamily: 'var(--font-jetbrains)',
                          overflowX: 'auto',
                          maxHeight: 110,
                          color: '#6ee7b7',
                        }}
                      >
                        {lastRawResponse}
                      </pre>
                    </div>
                  )}
                  <div
                    style={{
                      background: 'rgba(0,0,0,0.4)',
                      borderRadius: 7,
                      padding: 10,
                      maxHeight: 180,
                      overflowY: 'auto',
                    }}
                  >
                    {debugLogs.length > 0 ? (
                      debugLogs.map((entry, i) => (
                        <div
                          key={i}
                          style={{
                            fontSize: '0.62rem',
                            fontFamily: 'var(--font-jetbrains)',
                            marginBottom: 3,
                            color:
                              entry.type === 'error'
                                ? '#f87171'
                                : entry.type === 'response'
                                ? '#6ee7b7'
                                : entry.type === 'request'
                                ? '#93c5fd'
                                : 'var(--aq-muted)',
                          }}
                        >
                          <span style={{ color: 'var(--aq-muted)', marginRight: 5 }}>
                            [{new Date(entry.timestamp).toLocaleTimeString('en-US')}]
                          </span>
                          [{entry.type.toUpperCase()}] {entry.endpoint}: {entry.message}
                        </div>
                      ))
                    ) : (
                      <p style={{ color: 'var(--aq-muted)', fontSize: '0.68rem' }}>Ingen debug logs ennå</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT RAIL ── */}
          <div className="dash-rail" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="glass-hi" style={{ borderRadius: 20, padding: 22 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 22 }}>
                <div className="agent-orb" style={{ marginBottom: 14 }}>
                  <div className="ao-core" />
                  <div className="ao-ring" />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: '50%',
                      background: isTrading ? 'var(--aq-cyan)' : 'rgba(255,255,255,0.15)',
                      animation: isTrading ? 'blink 1.2s infinite' : 'none',
                    }}
                  />
                  <span
                    style={{
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      fontFamily: 'var(--font-jetbrains)',
                      letterSpacing: '0.12em',
                      color: isTrading ? 'var(--aq-cyan)' : 'var(--aq-muted)',
                    }}
                  >
                    {isTrading ? 'AGENT AKTIV' : 'AGENT STOPPET'}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginBottom: 18 }}>
                {[
                  { label: 'KONFIDENS', pct: confidencePct, color: 'var(--aq-cyan)' },
                  { label: 'EKSPONERING', pct: exposurePct, color: 'var(--aq-magenta)' },
                  { label: 'RISIKO', pct: isLive ? 82 : 28, color: isLive ? '#ef4444' : '#60a5fa' },
                ].map(({ label, pct, color }) => (
                  <div key={label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span
                        style={{
                          fontSize: '0.58rem',
                          color: 'var(--aq-muted)',
                          fontFamily: 'var(--font-jetbrains)',
                          letterSpacing: '0.1em',
                        }}
                      >
                        {label}
                      </span>
                      <span style={{ fontSize: '0.58rem', color, fontFamily: 'var(--font-jetbrains)' }}>
                        {Math.round(pct)}%
                      </span>
                    </div>
                    <div
                      style={{
                        height: 3,
                        background: 'rgba(255,255,255,0.05)',
                        borderRadius: 2,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${pct}%`,
                          background: color,
                          borderRadius: 2,
                          transition: 'width 0.6s ease',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginBottom: 16 }}>
                {[
                  { label: 'SCANS', value: scanCount },
                  { label: 'KJØPT', value: `$${(totalBought / 1000).toFixed(0)}k` },
                  { label: 'SOLGT', value: `$${(totalSold / 1000).toFixed(0)}k` },
                  { label: 'CASH', value: accountInfo ? `$${(accountInfo.cash / 1000).toFixed(0)}k` : '—' },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.05)',
                      borderRadius: 8,
                      padding: '7px 10px',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '0.54rem',
                        color: 'var(--aq-muted)',
                        fontFamily: 'var(--font-jetbrains)',
                        letterSpacing: '0.1em',
                        marginBottom: 2,
                      }}
                    >
                      {label}
                    </div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>{value}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {!isTrading ? (
                  <button
                    onClick={startTrading}
                    className="btn btn-primary"
                    style={{ width: '100%', fontSize: '0.75rem', letterSpacing: '0.06em' }}
                  >
                    START AUTONOM TRADING
                  </button>
                ) : (
                  <button
                    onClick={stopTrading}
                    style={{
                      width: '100%',
                      padding: '10px 0',
                      background: 'rgba(239,68,68,0.09)',
                      border: '1px solid rgba(239,68,68,0.25)',
                      borderRadius: 10,
                      color: '#f87171',
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-jetbrains)',
                      letterSpacing: '0.06em',
                      transition: 'all 0.2s',
                    }}
                  >
                    STOPP TRADING
                  </button>
                )}
                <button
                  onClick={handleManualTick}
                  disabled={!isConnected}
                  className="btn btn-ghost btn-sm"
                  style={{ width: '100%', fontSize: '0.72rem' }}
                >
                  MANUELL SCAN
                </button>
              </div>

              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <button
                  className="kill-btn"
                  style={{ width: '100%' }}
                  onClick={() => {
                    stopTrading();
                    toast.error('NØDSTOPP aktivert — all trading stoppet');
                  }}
                >
                  <span className="kill-dot" />
                  NØDSTOPP
                </button>
              </div>
            </div>

            <div className="glass" style={{ borderRadius: 16, padding: 18 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 12,
                }}
              >
                <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Aktive Signaler</span>
                <span
                  style={{
                    background: signals.length > 0 ? 'rgba(0,245,255,0.07)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${signals.length > 0 ? 'rgba(0,245,255,0.18)' : 'rgba(255,255,255,0.07)'}`,
                    borderRadius: 5,
                    padding: '2px 7px',
                    fontSize: '0.62rem',
                    color: signals.length > 0 ? 'var(--aq-cyan)' : 'var(--aq-muted)',
                    fontFamily: 'var(--font-jetbrains)',
                  }}
                >
                  {signals.length}
                </span>
              </div>
              {signals.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 200, overflowY: 'auto' }}>
                  {signals.map((signal, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '7px 9px',
                        background:
                          signal.action === 'BUY' ? 'rgba(16,185,129,0.05)' : 'rgba(239,68,68,0.05)',
                        border: `1px solid ${signal.action === 'BUY' ? 'rgba(16,185,129,0.18)' : 'rgba(239,68,68,0.18)'}`,
                        borderRadius: 7,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <span
                          className="sig-tag"
                          style={{
                            background:
                              signal.action === 'BUY' ? 'rgba(16,185,129,0.18)' : 'rgba(239,68,68,0.18)',
                            color: signal.action === 'BUY' ? '#34d399' : '#f87171',
                            border: 'none',
                          }}
                        >
                          {signal.action}
                        </span>
                        <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>
                          {signal.amount}× {signal.symbol || signal.ticker}
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: '0.62rem',
                          color: 'var(--aq-muted)',
                          maxWidth: 72,
                          textAlign: 'right',
                          lineHeight: 1.3,
                        }}
                      >
                        {signal.reason}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: 'var(--aq-muted)', fontSize: '0.78rem' }}>Ingen aktive signaler</p>
              )}

              {successfulTrades.length > 0 && (
                <div
                  style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.05)' }}
                >
                  <div
                    style={{
                      fontSize: '0.6rem',
                      color: 'var(--aq-muted)',
                      fontFamily: 'var(--font-jetbrains)',
                      letterSpacing: '0.1em',
                      marginBottom: 7,
                    }}
                  >
                    SISTE UTFØRTE
                  </div>
                  {successfulTrades.slice(0, 4).map((trade, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '4px 0',
                        fontSize: '0.75rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span
                          style={{
                            color: trade.action === 'BUY' ? '#34d399' : '#f87171',
                            fontWeight: 700,
                            fontSize: '0.62rem',
                            fontFamily: 'var(--font-jetbrains)',
                          }}
                        >
                          {trade.action === 'BUY' ? '+' : '-'}
                          {trade.amount}
                        </span>
                        <span style={{ fontWeight: 500 }}>{trade.symbol || trade.ticker}</span>
                      </div>
                      <span style={{ color: 'var(--aq-muted)', fontSize: '0.68rem' }}>
                        {fmtUsd(trade.value, 2)}
                      </span>
                    </div>
                  ))}
                  {failedTrades.length > 0 && (
                    <div
                      style={{
                        marginTop: 5,
                        fontSize: '0.62rem',
                        color: '#f87171',
                        fontFamily: 'var(--font-jetbrains)',
                      }}
                    >
                      {failedTrades.length} feilet
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="glass" style={{ borderRadius: 16, padding: 18 }}>
              <div style={{ marginBottom: 12 }}>
                <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Ta ut avkastning</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '9px 12px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: 8,
                  }}
                >
                  <span style={{ fontSize: '0.73rem', color: 'var(--aq-muted)' }}>Tilgjengelig</span>
                  <span
                    style={{
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      color: pnl > 0 ? '#34d399' : 'var(--aq-muted)',
                    }}
                  >
                    {pnl > 0 ? `+${fmtUsd(pnl)}` : '—'}
                  </span>
                </div>
                <button
                  onClick={handleWithdrawProfits}
                  disabled={isWithdrawing || pnl <= 0}
                  style={{
                    width: '100%',
                    padding: '10px 0',
                    background: pnl > 0 ? 'rgba(245,196,67,0.1)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${pnl > 0 ? 'rgba(245,196,67,0.28)' : 'rgba(255,255,255,0.05)'}`,
                    borderRadius: 10,
                    color: pnl > 0 ? '#F5C443' : 'var(--aq-muted)',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    cursor: pnl > 0 ? 'pointer' : 'not-allowed',
                    fontFamily: 'var(--font-jetbrains)',
                    letterSpacing: '0.06em',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 7,
                  }}
                >
                  {isWithdrawing ? (
                    <>
                      <span
                        style={{
                          width: 12,
                          height: 12,
                          border: '2px solid currentColor',
                          borderTopColor: 'transparent',
                          borderRadius: '50%',
                          animation: 'ring-spin 0.6s linear infinite',
                          display: 'inline-block',
                        }}
                      />
                      HENTER UT...
                    </>
                  ) : (
                    'TA UT AVKASTNING'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

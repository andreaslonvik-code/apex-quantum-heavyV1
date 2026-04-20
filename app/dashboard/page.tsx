'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PortfolioOverview } from './components/portfolio-overview';
import { OpenPositions } from './components/open-positions';
import { TradeLog } from './components/trade-log';
import { SystemStatus } from './components/system-status';
import { WithdrawProfits } from './components/withdraw-profits';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

// ============ TYPES ============
interface Trade {
  ticker: string;
  saxoSymbol?: string;
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
  saxoSymbol?: string;
  action: 'BUY' | 'SELL';
  amount: number;
  reason: string;
}

interface Position {
  ticker: string;
  saxoSymbol?: string;
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

interface SaxoStatus {
  isLiveMode: boolean;
  baseUrl: string;
  hasToken: boolean;
  tokenValid: boolean;
  lastPurge: string;
  cacheSize: number;
  debugLogSize: number;
}

// ============ COMPONENT ============
export default function Dashboard() {
  const router = useRouter();
  
  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [accountInfo, setAccountInfo] = useState<{ accountId: string; balance: number; currency: string } | null>(null);
  
  // Trading mode
  const [tradingMode, setTradingMode] = useState<'sim' | 'live'>('sim');
  const [showLiveWarning, setShowLiveWarning] = useState(false);
  
  // Trading state
  const [isTrading, setIsTrading] = useState(false);
  const [scanCount, setScanCount] = useState(0);
  const [totalBought, setTotalBought] = useState(0);
  const [totalSold, setTotalSold] = useState(0);
  const [lockedProfitsTotal, setLockedProfitsTotal] = useState(0);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [lastTrades, setLastTrades] = useState<Trade[]>([]);
  const [tradeHistory, setTradeHistory] = useState<Trade[]>([]);
  const [portfolio, setPortfolio] = useState<Position[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  
  // Performance chart state
  const [performanceData, setPerformanceData] = useState<PerformanceData | null>(null);
  const [chartTimeRange, setChartTimeRange] = useState<'1h' | '24h' | '7d'>('1h');
  
  // Withdraw profits state
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawResult, setWithdrawResult] = useState<{
    success: boolean;
    message: string;
    totalSold?: number;
  } | null>(null);
  
  // Debug panel state
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [debugLogs, setDebugLogs] = useState<DebugEntry[]>([]);
  const [saxoStatus, setSaxoStatus] = useState<SaxoStatus | null>(null);
  const [lastRawResponse, setLastRawResponse] = useState<string>('');
  
  // CET Clock
  const [cetTime, setCetTime] = useState<string>('');
  
  // Self-cleaning status
  const [lastPurgeTime, setLastPurgeTime] = useState<string>('');
  const [purgeCount, setPurgeCount] = useState(0);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const performanceIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const clockIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const purgeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isRunningRef = useRef(false);

  // Update CET clock every second
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const cetTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Oslo' }));
      setCetTime(cetTime.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    
    updateClock();
    clockIntervalRef.current = setInterval(updateClock, 1000);
    
    return () => {
      if (clockIntervalRef.current) clearInterval(clockIntervalRef.current);
    };
  }, []);

  // Self-cleaning: auto-purge every 10 seconds
  useEffect(() => {
    const runPurge = () => {
      // Clear old logs (keep last 50)
      setDebugLogs(prev => prev.slice(0, 50));
      setLastPurgeTime(new Date().toLocaleTimeString('no-NO'));
      setPurgeCount(prev => prev + 1);
    };
    
    purgeIntervalRef.current = setInterval(runPurge, 10000);
    
    return () => {
      if (purgeIntervalRef.current) clearInterval(purgeIntervalRef.current);
    };
  }, []);

  // Check connection status on mount
  useEffect(() => {
    checkConnection();
  }, []);

  // Fetch performance data every 3 seconds when trading
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
      if (performanceIntervalRef.current) {
        clearInterval(performanceIntervalRef.current);
      }
    };
  }, [isTrading, isConnected]);

  const addDebugLog = (entry: Omit<DebugEntry, 'timestamp'>) => {
    setDebugLogs(prev => [{
      ...entry,
      timestamp: new Date().toISOString(),
    }, ...prev].slice(0, 100));
  };

  const fetchPerformance = async () => {
    try {
      const res = await fetch('/api/apex/performance', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setPerformanceData(data);
        if (data.current) {
          setAccountInfo(prev => prev ? {
            ...prev,
            balance: data.current.totalValue,
          } : prev);
        }
      }
    } catch {}
  };

  const checkConnection = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/apex/connect-saxo', { method: 'GET', credentials: 'include' });
      const data = await res.json();
      
      if (data.connected) {
        setIsConnected(true);
        if (data.accountInfo) {
          setAccountInfo({
            accountId: data.accountInfo.accountId,
            balance: data.accountInfo.balance,
            currency: data.accountInfo.currency || 'NOK',
          });
        } else {
          setAccountInfo({
            accountId: data.accountKey || 'SIM',
            balance: 1000000,
            currency: 'NOK',
          });
        }
        fetchPerformance();
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
    
    try {
      addDebugLog({
        type: 'request',
        endpoint: '/api/apex/autonomous',
        message: `Scan #${scanCount + 1} started (${tradingMode.toUpperCase()} mode)`,
      });
      
      const res = await fetch('/api/apex/autonomous', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ mode: tradingMode }),
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
        setError('Server returnerte ugyldig JSON. Se Debug Info for detaljer.');
        return;
      }
      
      const duration = Date.now() - startTime;
      
      addDebugLog({
        type: 'response',
        endpoint: '/api/apex/autonomous',
        message: `Scan completed in ${duration}ms - ${data.executedTrades?.length || 0} trades`,
        status: res.status,
      });
      
      if (!res.ok) {
        if (res.status === 401) {
          setError('Saxo-tilkobling utlopt. Vennligst koble til pa nytt.');
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          setIsTrading(false);
          setIsConnected(false);
        } else {
          setError(data.error || 'Feil ved scan');
        }
        return;
      }
      
      setError(null);
      setScanCount(prev => prev + 1);
      setTotalBought(prev => prev + (data.stats?.totalBought || 0));
      setTotalSold(prev => prev + (data.stats?.totalSold || 0));
      setLockedProfitsTotal(data.stats?.lockedProfits || 0);
      setSignals(data.signals || []);
      setLastTrades(data.executedTrades || []);
      setLastUpdate(new Date().toLocaleTimeString('no-NO'));
      
      if (data.portfolio) {
        setPortfolio(data.portfolio);
      }
      
      const successful = (data.executedTrades || []).filter((t: Trade) => t.status === 'OK');
      if (successful.length > 0) {
        setTradeHistory(prev => [...successful, ...prev].slice(0, 100));
      }
      
    } catch (e) {
      addDebugLog({
        type: 'error',
        endpoint: '/api/apex/autonomous',
        message: `Network error: ${e}`,
      });
      setError('Nettverksfeil');
    } finally {
      isRunningRef.current = false;
    }
  }, [tradingMode, scanCount]);

  const startTrading = useCallback(() => {
    if (intervalRef.current || !isConnected) return;
    
    setIsTrading(true);
    setError(null);
    
    addDebugLog({
      type: 'info',
      endpoint: 'startTrading',
      message: `Trading engine started in ${tradingMode.toUpperCase()} mode`,
    });
    
    runScan();
    intervalRef.current = setInterval(runScan, 2000);
  }, [runScan, isConnected, tradingMode]);

  const handleManualTick = async () => {
    addDebugLog({
      type: 'info',
      endpoint: 'manualTick',
      message: 'Manual tick triggered',
    });
    await runScan();
  };

  // Auto-start trading when connected
  useEffect(() => {
    if (isConnected && !isLoading && !isTrading && !intervalRef.current) {
      const timer = setTimeout(() => {
        startTrading();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isConnected, isLoading, isTrading, startTrading]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (performanceIntervalRef.current) clearInterval(performanceIntervalRef.current);
      if (clockIntervalRef.current) clearInterval(clockIntervalRef.current);
      if (purgeIntervalRef.current) clearInterval(purgeIntervalRef.current);
    };
  }, []);

  const handleDisconnect = () => {
    stopTrading();
    fetch('/api/apex/disconnect', { method: 'POST' }).then(() => {
      localStorage.removeItem('apex_saxo_connected');
      localStorage.removeItem('apex_saxo_account');
      router.push('/');
    });
  };

  const handleModeToggle = () => {
    if (tradingMode === 'sim') {
      setShowLiveWarning(true);
    } else {
      setTradingMode('sim');
      addDebugLog({
        type: 'info',
        endpoint: 'modeToggle',
        message: 'Switched to SIM mode',
      });
    }
  };

  const confirmLiveMode = () => {
    setTradingMode('live');
    setShowLiveWarning(false);
    addDebugLog({
      type: 'info',
      endpoint: 'modeToggle',
      message: 'WARNING: Switched to LIVE mode',
    });
  };

  const handleWithdrawProfits = async () => {
    if (isWithdrawing) return;
    
    const currentProfit = performanceData?.current?.pnl || 0;
    if (currentProfit <= 0) {
      setWithdrawResult({
        success: false,
        message: 'Ingen avkastning a hente ut. Kontoverdien er under eller lik startkapitalen.',
      });
      return;
    }
    
    const confirmed = window.confirm(
      `Er du sikker pa at du vil hente ut ${currentProfit.toLocaleString('no-NO', { maximumFractionDigits: 0 })} kr i avkastning?\n\nDette vil selge nok posisjoner til a ta ut profitten, og trading vil fortsette med startkapitalen pa 1 000 000 kr.`
    );
    
    if (!confirmed) return;
    
    setIsWithdrawing(true);
    setWithdrawResult(null);
    
    try {
      const res = await fetch('/api/apex/withdraw-profits', {
        method: 'POST',
        credentials: 'include',
      });
      
      const data = await res.json();
      
      if (data.success) {
        setWithdrawResult({
          success: true,
          message: data.message,
          totalSold: data.totalSold,
        });
        fetchPerformance();
      } else {
        setWithdrawResult({
          success: false,
          message: data.message || data.error || 'Kunne ikke hente ut avkastning',
        });
      }
    } catch {
      setWithdrawResult({
        success: false,
        message: 'Nettverksfeil ved uttak av avkastning',
      });
    } finally {
      setIsWithdrawing(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-neon-cyan border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Sjekker tilkobling...</p>
        </div>
      </div>
    );
  }

  // Not connected
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full glass-card rounded-lg p-8 text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold mb-2">Ikke tilkoblet</h2>
          <p className="text-muted-foreground mb-6">
            Du ma koble til din Saxo-konto for a bruke Apex Quantum.
          </p>
          <Link
            href="/saxo-simulation"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-neon-cyan text-black rounded-lg font-medium hover:bg-neon-cyan/90 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            Koble til Saxo
          </Link>
        </div>
      </div>
    );
  }

  // Performance calculations
  const pnl = performanceData?.current?.pnl || 0;
  const pnlPercent = performanceData?.current?.pnlPercent || 0;
  const totalValue = performanceData?.current?.totalValue || accountInfo?.balance || 1000000;
  const chartData = performanceData?.chartData || [];
  const isPositive = pnl >= 0;

  const successfulTrades = lastTrades.filter(t => t.status === 'OK');
  const failedTrades = lastTrades.filter(t => t.status === 'FEIL');

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Live Mode Warning Modal */}
      {showLiveWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="max-w-md w-full mx-4 glass-card rounded-lg p-6 border-2 border-red-500">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-red-400">ADVARSEL: LIVE TRADING</h3>
                <p className="text-sm text-muted-foreground">Reelle penger vil bli brukt</p>
              </div>
            </div>
            
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
              <p className="text-sm text-red-300 mb-2">
                Du er i ferd med a bytte til LIVE modus. Dette betyr:
              </p>
              <ul className="text-sm text-red-200 space-y-1 list-disc list-inside">
                <li>Alle handler vil utfores med ekte penger</li>
                <li>Tap er reelle og ugjenkallelige</li>
                <li>Apex Quantum gir ingen garantier</li>
              </ul>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowLiveWarning(false)}
                className="flex-1 px-4 py-2.5 bg-muted hover:bg-muted/80 rounded-lg font-medium transition-colors"
              >
                Avbryt
              </button>
              <button
                onClick={confirmLiveMode}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
              >
                Bekreft LIVE Modus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-border glass-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl font-bold tracking-tight">
              <span className="neon-text-cyan">A</span>Q
            </span>
            <span className="font-semibold">Apex Quantum</span>
            <span className="text-xs px-2 py-0.5 bg-neon-cyan/20 text-neon-cyan rounded-full font-mono">v7</span>
          </Link>
          
          <div className="flex items-center gap-4">
            {/* CET Clock */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg text-sm font-mono">
              <span className="text-muted-foreground">CET:</span>
              <span className="text-neon-cyan">{cetTime}</span>
            </div>
            
            {/* SIM/LIVE Toggle */}
            <button
              onClick={handleModeToggle}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                tradingMode === 'live'
                  ? 'bg-red-500/20 text-red-400 border border-red-500/50 animate-pulse'
                  : 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${tradingMode === 'live' ? 'bg-red-400' : 'bg-blue-400'}`} />
              {tradingMode === 'live' ? 'LIVE' : 'SIM'}
            </button>
            
            {/* Connection Status */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
              tradingMode === 'live' 
                ? 'bg-red-500/20 text-red-400'
                : 'bg-blue-500/20 text-blue-400'
            }`}>
              <span className={`w-2 h-2 rounded-full ${tradingMode === 'live' ? 'bg-red-400' : 'bg-blue-400'}`} />
              Koblet til Saxo {tradingMode.toUpperCase()}
            </div>
            
            <button
              onClick={handleDisconnect}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Koble fra
            </button>
          </div>
        </div>
      </header>

      {/* Live Mode Warning Banner */}
      {tradingMode === 'live' && (
        <div className="bg-red-500/20 border-b border-red-500/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
            <div className="flex items-center justify-center gap-2 text-red-400 text-sm font-medium">
              <svg className="w-4 h-4 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              LIVE TRADING AKTIV - EKTE PENGER BRUKES
              <svg className="w-4 h-4 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        </div>
      )}

      {/* Status Banner */}
      <div className="bg-accent/10 border-b border-accent/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-center gap-4 flex-wrap text-sm">
            <span className={`font-medium ${tradingMode === 'live' ? 'text-red-400' : 'text-cyan-400'}`}>
              {tradingMode === 'live' ? 'LIVE TRADING' : 'PAPER TRADING'}
            </span>
            <span className="text-muted-foreground">|</span>
            <span className="text-muted-foreground">Markeder:</span>
            <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs">US</span>
            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded text-xs">OSLO</span>
            <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-xs">XETRA</span>
            <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded text-xs">HK/CN</span>
            <span className="text-muted-foreground">|</span>
            <span>Konto: <span className="font-medium">{accountInfo?.accountId}</span></span>
            <span className="text-muted-foreground">|</span>
            <span>Saldo: <span className={`font-medium ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              {totalValue.toLocaleString()} kr
            </span></span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Performance Chart Section */}
        <div className="glass-card rounded-lg p-6 mb-6 neon-cyan-glow">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold mb-1">Avkastning &amp; Performance</h2>
              <div className="flex items-baseline gap-3">
                <span className={`text-3xl font-bold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                  {isPositive ? '+' : '-'}{Math.abs(pnl).toLocaleString()} kr
                </span>
                <span className={`text-lg font-medium ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                  ({isPositive ? '+' : ''}{pnlPercent.toFixed(2)}%)
                </span>
              </div>
            </div>
            
            {/* Time Range Toggle */}
            <div className="flex gap-1 bg-muted/30 rounded-lg p-1">
              {(['1h', '24h', '7d'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setChartTimeRange(range)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    chartTimeRange === range
                      ? 'bg-neon-cyan text-black'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {range === '1h' ? '1 time' : range === '24h' ? '24 timer' : '7 dager'}
                </button>
              ))}
            </div>
          </div>

          {/* Chart */}
          <div className="h-64 w-full">
            {chartData.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={isPositive ? '#10b981' : '#ef4444'} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={isPositive ? '#10b981' : '#ef4444'} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="time" 
                    stroke="#71717a" 
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    stroke="#71717a" 
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}k kr`}
                    domain={['dataMin - 1000', 'dataMax + 1000']}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#18181b',
                      border: '1px solid #27272a',
                      borderRadius: '8px',
                      padding: '12px',
                    }}
                    labelStyle={{ color: '#a1a1aa', marginBottom: '4px' }}
                    formatter={(value, name) => {
                      if (name === 'value' && typeof value === 'number') {
                        return [`${value.toLocaleString()} kr`, 'Total Verdi'];
                      }
                      return [String(value ?? ''), String(name)];
                    }}
                  />
                  <ReferenceLine y={1000000} stroke="#3f3f46" strokeDasharray="3 3" />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={isPositive ? '#10b981' : '#ef4444'}
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorValue)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <div className="w-12 h-12 border-2 border-dashed border-muted-foreground/30 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                    </svg>
                  </div>
                  <p className="text-sm">Start trading for a se avkastningsgrafen</p>
                </div>
              </div>
            )}
          </div>

          {/* Performance Stats */}
          {performanceData && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-border">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Startverdi</div>
                <div className="font-semibold">{performanceData.current.initialValue.toLocaleString()} kr</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Novarende</div>
                <div className="font-semibold">{performanceData.current.totalValue.toLocaleString()} kr</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Topp</div>
                <div className="font-semibold">{performanceData.session.peak.toLocaleString()} kr</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Max Drawdown</div>
                <div className="font-semibold text-red-400">-{performanceData.session.maxDrawdown.toFixed(2)}%</div>
              </div>
            </div>
          )}
        </div>

        {/* Trading Engine Controls */}
        <div className="glass-card rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold">Aktiv Trading Engine</h2>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                isTrading 
                  ? 'bg-emerald-500/20 text-emerald-400' 
                  : 'bg-muted text-muted-foreground'
              }`}>
                <span className={`w-2 h-2 rounded-full ${isTrading ? 'bg-emerald-400 animate-pulse' : 'bg-muted-foreground'}`} />
                {isTrading ? 'AKTIV' : 'STOPPET'}
              </span>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Manual Tick Button */}
              <button
                onClick={handleManualTick}
                disabled={!isConnected}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
              >
                Manual Tick
              </button>
              
              {!isTrading ? (
                <button
                  onClick={startTrading}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition-colors"
                >
                  Start Autonom Trading
                </button>
              ) : (
                <button
                  onClick={stopTrading}
                  className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition-colors"
                >
                  Stopp Trading
                </button>
              )}
              
              {/* Withdraw Profits Button */}
              <button
                onClick={handleWithdrawProfits}
                disabled={isWithdrawing || (performanceData?.current?.pnl || 0) <= 0}
                className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                  (performanceData?.current?.pnl || 0) > 0
                    ? 'bg-amber-600 hover:bg-amber-700 text-white'
                    : 'bg-muted text-muted-foreground cursor-not-allowed'
                }`}
              >
                {isWithdrawing ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Henter ut...
                  </span>
                ) : (
                  `Hent ut avkastning${(performanceData?.current?.pnl || 0) > 0 ? ` (${(performanceData?.current?.pnl || 0).toLocaleString('no-NO', { maximumFractionDigits: 0 })} kr)` : ''}`
                )}
              </button>
            </div>
          </div>

          {/* Withdraw Result Message */}
          {withdrawResult && (
            <div className={`mb-4 p-3 rounded-md text-sm ${
              withdrawResult.success 
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' 
                : 'bg-red-500/10 border border-red-500/30 text-red-400'
            }`}>
              {withdrawResult.message}
              {withdrawResult.totalSold && (
                <span className="ml-2 font-semibold">
                  Solgt for {withdrawResult.totalSold.toLocaleString('no-NO', { maximumFractionDigits: 0 })} kr
                </span>
              )}
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-md text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <div className="bg-muted/30 rounded-lg p-4">
              <div className="text-xs text-muted-foreground mb-1">Scans</div>
              <div className="text-2xl font-bold">{scanCount}</div>
            </div>
            <div className="bg-muted/30 rounded-lg p-4">
              <div className="text-xs text-muted-foreground mb-1">Total Kjopt</div>
              <div className="text-2xl font-bold text-emerald-400">{totalBought.toLocaleString()} kr</div>
            </div>
            <div className="bg-muted/30 rounded-lg p-4">
              <div className="text-xs text-muted-foreground mb-1">Total Solgt</div>
              <div className="text-2xl font-bold text-red-400">{totalSold.toLocaleString()} kr</div>
            </div>
            <div className="bg-muted/30 rounded-lg p-4">
              <div className="text-xs text-muted-foreground mb-1">Netto</div>
              <div className={`text-2xl font-bold ${totalSold - totalBought >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {(totalSold - totalBought).toLocaleString()} kr
              </div>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
              <div className="text-xs text-amber-400 mb-1">Last Profitt</div>
              <div className="text-2xl font-bold text-amber-400">{lockedProfitsTotal.toLocaleString()} kr</div>
            </div>
            <div className="bg-muted/30 rounded-lg p-4">
              <div className="text-xs text-muted-foreground mb-1">Siste Scan</div>
              <div className="text-lg font-medium">{lastUpdate || '-'}</div>
            </div>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid md:grid-cols-2 gap-6">
          
          {/* Active Signals */}
          <div className="glass-card rounded-lg p-6">
            <h3 className="font-semibold mb-4">Aktive Signaler ({signals.length})</h3>
            {signals.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {signals.map((signal, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      signal.action === 'BUY' 
                        ? 'bg-emerald-500/10 border border-emerald-500/30' 
                        : 'bg-red-500/10 border border-red-500/30'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        signal.action === 'BUY' ? 'bg-emerald-500/30 text-emerald-400' : 'bg-red-500/30 text-red-400'
                      }`}>
                        {signal.action}
                      </span>
                      <span className="font-medium">{signal.amount}x {signal.saxoSymbol || signal.ticker}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{signal.reason}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Ingen aktive signaler</p>
            )}
          </div>

          {/* Last Executed */}
          <div className="glass-card rounded-lg p-6">
            <h3 className="font-semibold mb-4">Siste Handler</h3>
            {successfulTrades.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {successfulTrades.map((trade, i) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                    <div className="flex items-center gap-2">
                      <span className={trade.action === 'BUY' ? 'text-emerald-400' : 'text-red-400'}>
                        {trade.action === 'BUY' ? '+' : '-'}{trade.amount}
                      </span>
                      <span className="font-medium">{trade.saxoSymbol || trade.ticker}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm">{trade.value.toFixed(0)} kr</div>
                      <div className="text-xs text-muted-foreground font-mono">{trade.orderId?.slice(0, 10)}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Ingen handler enna</p>
            )}
            
            {failedTrades.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs text-red-400">
                  {failedTrades.length} feilet: {failedTrades.map(t => t.saxoSymbol || t.ticker).join(', ')}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Debug Info Panel */}
        <div className="mt-6 glass-card rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h3 className="font-semibold">Debug Info</h3>
              <span className="px-2 py-0.5 bg-neon-cyan/20 text-neon-cyan rounded text-xs font-mono">
                Self-cleaning: {purgeCount} purges
              </span>
              {lastPurgeTime && (
                <span className="text-xs text-muted-foreground">
                  Last purge: {lastPurgeTime}
                </span>
              )}
            </div>
            <button
              onClick={() => setShowDebugPanel(!showDebugPanel)}
              className="px-3 py-1.5 bg-muted hover:bg-muted/80 rounded text-sm transition-colors"
            >
              {showDebugPanel ? 'Skjul' : 'Vis'} Detaljer
            </button>
          </div>
          
          {/* Quick Status */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-muted/30 rounded-lg p-3">
              <div className="text-xs text-muted-foreground mb-1">Token Status</div>
              <div className={`text-sm font-medium ${isConnected ? 'text-emerald-400' : 'text-red-400'}`}>
                {isConnected ? 'Gyldig' : 'Ugyldig'}
              </div>
            </div>
            <div className="bg-muted/30 rounded-lg p-3">
              <div className="text-xs text-muted-foreground mb-1">Modus</div>
              <div className={`text-sm font-medium ${tradingMode === 'live' ? 'text-red-400' : 'text-blue-400'}`}>
                {tradingMode.toUpperCase()}
              </div>
            </div>
            <div className="bg-muted/30 rounded-lg p-3">
              <div className="text-xs text-muted-foreground mb-1">Debug Log</div>
              <div className="text-sm font-medium">{debugLogs.length} entries</div>
            </div>
            <div className="bg-muted/30 rounded-lg p-3">
              <div className="text-xs text-muted-foreground mb-1">Engine</div>
              <div className={`text-sm font-medium ${isTrading ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                {isTrading ? 'Running' : 'Stopped'}
              </div>
            </div>
          </div>
          
          {showDebugPanel && (
            <>
              {/* Last Raw Response */}
              {lastRawResponse && (
                <div className="mb-4">
                  <div className="text-xs text-muted-foreground mb-2">Last Raw Saxo Response:</div>
                  <pre className="bg-black/50 rounded-lg p-4 text-xs font-mono overflow-x-auto max-h-32 text-emerald-300">
                    {lastRawResponse}
                  </pre>
                </div>
              )}
              
              {/* Debug Log */}
              <div>
                <div className="text-xs text-muted-foreground mb-2">Debug Log (newest first):</div>
                <div className="bg-black/50 rounded-lg p-4 max-h-64 overflow-y-auto">
                  {debugLogs.length > 0 ? (
                    <div className="space-y-2 font-mono text-xs">
                      {debugLogs.map((entry, i) => (
                        <div key={i} className={`${
                          entry.type === 'error' ? 'text-red-400' :
                          entry.type === 'response' ? 'text-emerald-400' :
                          entry.type === 'request' ? 'text-blue-400' :
                          'text-muted-foreground'
                        }`}>
                          <span className="text-muted-foreground">[{new Date(entry.timestamp).toLocaleTimeString('no-NO')}]</span>
                          {' '}<span className="uppercase">[{entry.type}]</span>
                          {' '}{entry.endpoint}: {entry.message}
                          {entry.rawBody && (
                            <div className="ml-4 mt-1 text-muted-foreground truncate">
                              {entry.rawBody.slice(0, 100)}...
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-xs">Ingen debug logs enna</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Portfolio */}
        {portfolio.length > 0 && (
          <div className="mt-6 glass-card rounded-lg p-6">
            <h3 className="font-semibold mb-4">Portefolje Rapport (v7 Blueprint)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Aksje</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Saxo Symbol</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Allokering</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Signal</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Antall</th>
                  </tr>
                </thead>
                <tbody>
                  {portfolio.map((pos) => (
                    <tr key={pos.ticker} className="border-b border-border/50 cyber-table-row">
                      <td className="py-3 px-3">
                        <div className="font-medium">{pos.ticker}</div>
                        <div className="text-xs text-muted-foreground">{pos.navn}</div>
                      </td>
                      <td className="text-right py-3 px-3 font-mono text-xs text-muted-foreground">
                        {pos.saxoSymbol}
                      </td>
                      <td className="text-right py-3 px-3 font-medium">{pos.vekt}%</td>
                      <td className="text-right py-3 px-3">
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          pos.aksjon === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' :
                          pos.aksjon === 'SELL' ? 'bg-red-500/20 text-red-400' :
                          'bg-muted text-muted-foreground'
                        }`}>
                          {pos.aksjon}
                        </span>
                      </td>
                      <td className="text-right py-3 px-3 font-mono">{pos.antall}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Trade History */}
        {tradeHistory.length > 0 && (
          <div className="mt-6 glass-card rounded-lg p-6">
            <h3 className="font-semibold mb-4">Handelshistorikk ({tradeHistory.length})</h3>
            <div className="max-h-64 overflow-y-auto space-y-1">
              {tradeHistory.map((trade, i) => (
                <div key={i} className="flex items-center justify-between py-2 px-3 bg-muted/20 rounded text-sm cyber-table-row">
                  <div className="flex items-center gap-3">
                    <span className={`w-16 text-xs font-medium ${trade.action === 'BUY' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {trade.action}
                    </span>
                    <span>{trade.amount}x {trade.saxoSymbol || trade.ticker}</span>
                    <span className="text-muted-foreground">@ ${trade.price.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-medium">${trade.value.toFixed(0)}</span>
                    <span className="text-xs text-muted-foreground font-mono">{trade.orderId?.slice(0, 10)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

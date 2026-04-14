'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  AreaChart,
} from 'recharts';

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

export default function Dashboard() {
  const router = useRouter();
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [accountInfo, setAccountInfo] = useState<{ accountId: string; balance: number; currency: string } | null>(null);
  
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
  
  // Order status state
  const [lastOrderStatus, setLastOrderStatus] = useState<{
    ticker: string;
    action: 'Buy' | 'Sell';
    amount: number;
    status: 'Placed' | 'Filled' | 'Rejected' | 'Pending' | 'Cancelled';
    errorMessage?: string;
    timestamp: string;
  } | null>(null);
  const [circuitBreakerOpen, setCircuitBreakerOpen] = useState(false);
  
  // Trading mode
  const [tradingMode, setTradingMode] = useState<'SIM' | 'LIVE'>('SIM');
  
  // Portfolio analysis state
  const [portfolioAnalysis, setPortfolioAnalysis] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  
  // Inngest tick status
  const [tickStatus, setTickStatus] = useState<{
    lastTickTime: string | null;
    tickCount: number;
    status: 'RUNNING' | 'PAUSED' | 'RATE_LIMITED' | 'ERROR';
    lastError: string | null;
    grokRateLimited: boolean;
    secondsSinceLastTick: number;
    tokenStatus?: 'VALID' | 'MISSING' | 'EXPIRED' | 'CHECKING';
    tokenPreview?: string | null;
    hasEnvToken?: boolean;
  }>({
    lastTickTime: null,
    tickCount: 0,
    status: 'PAUSED',
    lastError: null,
    grokRateLimited: false,
    secondsSinceLastTick: -1,
    tokenStatus: 'CHECKING',
    tokenPreview: null,
    hasEnvToken: false,
  });
  const [isTriggering, setIsTriggering] = useState(false);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const performanceIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isRunningRef = useRef(false);

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

  const fetchPerformance = async () => {
    try {
      const res = await fetch('/api/apex/performance', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setPerformanceData(data);
        // Update account info with live balance
        if (data.current) {
          setAccountInfo(prev => prev ? {
            ...prev,
            balance: data.current.totalValue,
          } : prev);
        }
      }
      // Also fetch tick status
      fetchTickStatus();
    } catch {}
  };

  // Fetch order status
  const fetchOrderStatus = async () => {
    try {
      const res = await fetch('/api/apex/order-status', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (data.lastOrder) {
          setLastOrderStatus(data.lastOrder);
        }
        if (data.circuitBreaker) {
          setCircuitBreakerOpen(data.circuitBreaker.isOpen);
        }
      }
    } catch {}
  };

  // Fetch portfolio analysis from Grok
  const fetchPortfolioAnalysis = async () => {
    if (isAnalyzing) return;
    
    setIsAnalyzing(true);
    setAnalysisError(null);
    setPortfolioAnalysis('');
    
    try {
      const res = await fetch('/api/apex/portfolio-analysis', {
        method: 'POST',
        credentials: 'include',
      });
      
      if (!res.ok) {
        throw new Error('Kunne ikke hente analyse');
      }
      
      // Handle streaming response
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';
      
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          fullResponse += chunk;
          setPortfolioAnalysis(fullResponse);
        }
      }
    } catch (err) {
      setAnalysisError('Kunne ikke generere porteføljeanalyse');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Fetch Inngest tick status
  const fetchTickStatus = async () => {
    try {
      const res = await fetch('/api/inngest/trigger', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setTickStatus(data);
      }
    } catch {}
  };

  // Manual trigger tick
  const triggerManualTick = async () => {
    if (isTriggering) return;
    
    setIsTriggering(true);
    try {
      const res = await fetch('/api/inngest/trigger', {
        method: 'POST',
        credentials: 'include',
      });
      
      const data = await res.json();
      
      if (data.success) {
        // Refresh status and run a scan
        await fetchTickStatus();
        await runScan();
      } else {
        setError(data.error || 'Tick trigger failed');
      }
    } catch (err) {
      setError('Failed to trigger tick');
    } finally {
      setIsTriggering(false);
    }
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
        // Initial performance fetch
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

  // Define stopTrading first so it can be used in runScan
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
    
    try {
      const res = await fetch('/api/apex/autonomous', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ mode: 'paper' }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        if (res.status === 401) {
          setError('Saxo-tilkobling utlopt. Vennligst koble til pa nytt.');
          // Stop trading on auth error
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
      
      // Add successful trades to history
      const successful = (data.executedTrades || []).filter((t: Trade) => t.status === 'OK');
      if (successful.length > 0) {
        setTradeHistory(prev => [...successful, ...prev].slice(0, 100));
      }
      
      // Fetch order status after scan
      fetchOrderStatus();
      
    } catch {
      setError('Nettverksfeil');
    } finally {
      isRunningRef.current = false;
    }
  }, []);

const startTrading = useCallback(() => {
  if (intervalRef.current || !isConnected) return;
  
  setIsTrading(true);
  setError(null);
  
  runScan();
  intervalRef.current = setInterval(runScan, 2000);
  }, [runScan, isConnected]);

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
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (performanceIntervalRef.current) {
        clearInterval(performanceIntervalRef.current);
      }
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

  // Withdraw profits handler
  const handleWithdrawProfits = async () => {
    if (isWithdrawing) return;
    
    const currentProfit = performanceData?.current?.pnl || 0;
    if (currentProfit <= 0) {
      setWithdrawResult({
        success: false,
        message: 'Ingen avkastning å hente ut. Kontoverdien er under eller lik startkapitalen.',
      });
      return;
    }
    
    const confirmed = window.confirm(
      `Er du sikker på at du vil hente ut ${currentProfit.toLocaleString('no-NO', { maximumFractionDigits: 0 })} kr i avkastning?\n\nDette vil selge nok posisjoner til å ta ut profitten, og trading vil fortsette med startkapitalen på 1 000 000 kr.`
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
        // Refresh performance data
        fetchPerformance();
      } else {
        setWithdrawResult({
          success: false,
          message: data.message || data.error || 'Kunne ikke hente ut avkastning',
        });
      }
    } catch (err) {
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
          <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Sjekker tilkobling...</p>
        </div>
      </div>
    );
  }

  // Not connected
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-card border border-border rounded-lg p-8 text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold mb-2">Ikke tilkoblet</h2>
          <p className="text-muted-foreground mb-6">
            Du ma koble til din Saxo Simulation-konto for a bruke Apex Quantum.
          </p>
          <Link
            href="/saxo-simulation"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-accent text-accent-foreground rounded-lg font-medium hover:bg-accent/90 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            Koble til Saxo Simulation
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
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl font-bold tracking-tight">
              <span className="text-accent">A</span>Q
            </span>
            <span className="font-semibold">Apex Quantum</span>
          </Link>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded-full text-sm">
              <span className="w-2 h-2 bg-blue-400 rounded-full" />
              Koblet til Saxo SIM
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

      {/* Status Banner */}
      <div className="bg-accent/10 border-b border-accent/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-center gap-4 flex-wrap text-sm">
            <span className="text-cyan-400 font-medium">PAPER TRADING</span>
            <span className="text-muted-foreground">|</span>
            <span className="text-muted-foreground">Markeder:</span>
            <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs">US</span>
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
        <div className="bg-card border border-border rounded-lg p-6 mb-6">
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
                      ? 'bg-accent text-accent-foreground'
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
        <div className="bg-card border border-border rounded-lg p-6 mb-6">
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

            {/* Manual Trigger Tick Button */}
            <button
              onClick={triggerManualTick}
              disabled={isTriggering || tickStatus.grokRateLimited}
              className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 ${
                tickStatus.grokRateLimited
                  ? 'bg-orange-600/50 text-orange-200 cursor-not-allowed'
                  : 'bg-cyan-600 hover:bg-cyan-700 text-white'
              }`}
            >
              {isTriggering ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Trigger...
                </>
              ) : tickStatus.grokRateLimited ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Rate Limited
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Manual Tick
                </>
              )}
            </button>
          </div>

          {/* Inngest Tick Status Bar */}
          <div className="mt-4 p-3 bg-muted/30 border border-border rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  tickStatus.status === 'RUNNING' ? 'bg-emerald-500 animate-pulse' :
                  tickStatus.status === 'RATE_LIMITED' ? 'bg-orange-500' :
                  tickStatus.status === 'ERROR' ? 'bg-red-500' :
                  'bg-gray-500'
                }`} />
                <span className="text-sm font-medium">
                  Status: <span className={
                    tickStatus.status === 'RUNNING' ? 'text-emerald-400' :
                    tickStatus.status === 'RATE_LIMITED' ? 'text-orange-400' :
                    tickStatus.status === 'ERROR' ? 'text-red-400' :
                    'text-muted-foreground'
                  }>{tickStatus.status}</span>
                </span>
              </div>
              
              <div className="text-sm text-muted-foreground">
                Siste tick: {tickStatus.secondsSinceLastTick >= 0 ? `${tickStatus.secondsSinceLastTick}s siden` : 'Aldri'}
              </div>
              
              <div className="text-sm text-muted-foreground">
                Totalt: {tickStatus.tickCount} ticks
              </div>
              
              {/* Token Status */}
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  tickStatus.tokenStatus === 'VALID' 
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : tickStatus.tokenStatus === 'MISSING' || tickStatus.tokenStatus === 'EXPIRED'
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                }`}>
                  Token: {tickStatus.tokenStatus || 'CHECKING'}
                </span>
                {tickStatus.tokenPreview && (
                  <span className="text-xs text-muted-foreground font-mono">
                    {tickStatus.tokenPreview}
                  </span>
                )}
              </div>
            </div>
            
            {/* Error/Warning Messages */}
            <div className="flex flex-col items-end gap-1">
              {tickStatus.tokenStatus === 'MISSING' && (
                <div className="text-xs text-red-400 px-2 py-1 bg-red-500/10 rounded border border-red-500/30">
                  Token not loaded - check Vercel Environment Variables
                </div>
              )}
              {tickStatus.tokenStatus === 'EXPIRED' && (
                <div className="text-xs text-orange-400 px-2 py-1 bg-orange-500/10 rounded border border-orange-500/30">
                  Token expired - click Manual Tick to retry
                </div>
              )}
              {tickStatus.lastError && (
                <div className="text-xs text-red-400 max-w-md truncate">
                  {tickStatus.lastError}
                </div>
              )}
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

          {/* Last Order Status Panel */}
          <div className="mt-4 p-4 rounded-lg border border-border bg-muted/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Siste Ordre Status</div>
                  {lastOrderStatus ? (
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        lastOrderStatus.status === 'Placed' || lastOrderStatus.status === 'Filled'
                          ? 'bg-emerald-500/30 text-emerald-400'
                          : lastOrderStatus.status === 'Rejected' || lastOrderStatus.status === 'Cancelled'
                          ? 'bg-red-500/30 text-red-400'
                          : 'bg-amber-500/30 text-amber-400'
                      }`}>
                        {lastOrderStatus.status === 'Placed' ? 'OK' : 
                         lastOrderStatus.status === 'Filled' ? 'FYLT' :
                         lastOrderStatus.status === 'Rejected' ? 'AVVIST' :
                         lastOrderStatus.status === 'Cancelled' ? 'ANNULLERT' : 'VENTER'}
                      </span>
                      <span className="font-medium">
                        {lastOrderStatus.action === 'Buy' ? '+' : '-'}{lastOrderStatus.amount} {lastOrderStatus.ticker}
                      </span>
                      {lastOrderStatus.errorMessage && (
                        <span className="text-xs text-red-400 ml-2">
                          {lastOrderStatus.errorMessage}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Ingen ordre sendt</span>
                  )}
                </div>
                
                {/* Circuit Breaker Status */}
                {circuitBreakerOpen && (
                  <div className="px-3 py-1 bg-red-500/20 border border-red-500/50 rounded text-red-400 text-xs">
                    CIRCUIT BREAKER AKTIV - For mange feil
                  </div>
                )}
              </div>
              
              {/* SIM/LIVE Toggle */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Mode:</span>
                <div className="flex items-center bg-muted rounded-lg p-1">
                  <button
                    onClick={() => setTradingMode('SIM')}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                      tradingMode === 'SIM'
                        ? 'bg-amber-500 text-white'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    SIM
                  </button>
                  <button
                    onClick={() => setTradingMode('LIVE')}
                    disabled
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                      tradingMode === 'LIVE'
                        ? 'bg-emerald-500 text-white'
                        : 'text-muted-foreground/50 cursor-not-allowed'
                    }`}
                    title="LIVE trading krever godkjenning"
                  >
                    LIVE
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid md:grid-cols-2 gap-6">
          
          {/* Active Signals */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="font-semibold mb-4">Aktive Signaler ({signals.length})</h3>
            {signals.length > 0 ? (
              <div className="space-y-2">
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
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="font-semibold mb-4">Siste Handler</h3>
            {successfulTrades.length > 0 ? (
              <div className="space-y-2">
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

        {/* APEX QUANTUM Portfolio Analysis */}
        <div className="mt-6 bg-card border border-border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold">APEX QUANTUM Porteføljerapport</h3>
                <p className="text-xs text-muted-foreground">AI-drevet analyse av din portefølje</p>
              </div>
            </div>
            <button
              onClick={fetchPortfolioAnalysis}
              disabled={isAnalyzing}
              className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isAnalyzing ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Analyserer...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Generer Rapport
                </>
              )}
            </button>
          </div>
          
          {analysisError && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {analysisError}
            </div>
          )}
          
          {portfolioAnalysis ? (
            <div className="prose prose-invert prose-sm max-w-none">
              <div className="bg-muted/30 rounded-lg p-4 whitespace-pre-wrap text-sm leading-relaxed">
                {portfolioAnalysis}
              </div>
            </div>
          ) : !isAnalyzing && (
            <div className="text-center py-8 text-muted-foreground">
              <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm">Klikk &quot;Generer Rapport&quot; for AI-analyse av porteføljen</p>
            </div>
          )}
        </div>

        {/* Portfolio */}
        {portfolio.length > 0 && (
          <div className="mt-6 bg-card border border-border rounded-lg p-6">
            <h3 className="font-semibold mb-4">AI-Portefolje (v6.1 Blueprint)</h3>
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
                    <tr key={pos.ticker} className="border-b border-border/50">
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
          <div className="mt-6 bg-card border border-border rounded-lg p-6">
            <h3 className="font-semibold mb-4">Handelshistorikk ({tradeHistory.length})</h3>
            <div className="max-h-64 overflow-y-auto space-y-1">
              {tradeHistory.map((trade, i) => (
                <div key={i} className="flex items-center justify-between py-2 px-3 bg-muted/20 rounded text-sm">
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

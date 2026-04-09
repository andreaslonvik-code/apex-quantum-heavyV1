'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Header } from './components/header';
import { Hero } from './components/hero';
import { Features } from './components/features';
import { LiveReport } from './components/live-report';
import { BrokerConnect } from './components/broker-connect';
import { Footer } from './components/footer';
import { ActiveTrader } from './components/active-trader';
import { Suspense } from 'react';

function StatusBanner({ accountInfo }: { accountInfo: { accountId: string; balance: number; currency: string } | null }) {
  const [nextScan, setNextScan] = useState<number>(10);

  useEffect(() => {
    // Calculate minutes until next 10-minute interval
    const now = new Date();
    const minutesPast = now.getMinutes() % 10;
    const initialMinutes = minutesPast === 0 ? 10 : 10 - minutesPast;
    setNextScan(initialMinutes);

    const interval = setInterval(() => {
      setNextScan(prev => (prev <= 1 ? 10 : prev - 1));
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  if (!accountInfo) return null;
  
  return (
    <div className="bg-accent/10 border-b border-accent/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-center gap-4 flex-wrap text-sm">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-accent font-medium">Koblet til Saxo Simulation</span>
          </div>
          <span className="text-muted-foreground hidden sm:inline">•</span>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
            </span>
            <span className="text-foreground">24/7 Autonom Drift Aktiv</span>
          </div>
          <span className="text-muted-foreground hidden sm:inline">•</span>
          <span className="text-cyan-400 font-medium">Paper Trading</span>
          <span className="text-muted-foreground hidden sm:inline">•</span>
          <span className="text-muted-foreground">
            Neste scan om <span className="text-foreground font-medium">{nextScan} min</span>
          </span>
          <span className="text-muted-foreground hidden sm:inline">•</span>
          <span className="text-muted-foreground">
            Saldo: <span className="text-foreground font-medium">{accountInfo.balance.toLocaleString('no-NO')} {accountInfo.currency}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function ApexQuantumContent() {
  const searchParams = useSearchParams();
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [language, setLanguage] = useState<'no' | 'en'>('no');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [accountInfo, setAccountInfo] = useState<{ accountId: string; balance: number; currency: string } | null>(null);
  const [portfolio, setPortfolio] = useState<Array<{ ticker: string; navn: string; vekt: number; aksjon: string; antall: number }>>([]);

  // Check connection status and load stored data
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      
      // Dev bypass
      if (params.get('dev') === '1') {
        setIsSubscribed(true);
      }
      
      // Check if coming from successful connection
      const connected = params.get('connected') === '1' || localStorage.getItem('apex_saxo_connected') === 'true';
      const tradingActive = localStorage.getItem('apex_trading_active') === 'true';
      
      if (connected) {
        setIsConnected(true);
        setIsSubscribed(true); // Grant access when connected
        
        // Load account info
        const storedAccount = localStorage.getItem('apex_saxo_account');
        if (storedAccount) {
          try {
            setAccountInfo(JSON.parse(storedAccount));
          } catch (e) {
            console.error('Failed to parse account info');
          }
        }
        
        // Load first report and portfolio if available
        const firstReport = localStorage.getItem('apex_first_report');
        const storedPortfolio = localStorage.getItem('apex_portfolio');
        if (firstReport && tradingActive) {
          setContent(firstReport);
          setIsLoading(false);
        }
        if (storedPortfolio) {
          try {
            setPortfolio(JSON.parse(storedPortfolio));
          } catch (e) {
            console.error('Failed to parse portfolio');
          }
        }
      }
    }
  }, [searchParams]);

  const fetchUpdate = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/apex/autonomous', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          language,
          mode: isConnected ? 'paper' : undefined,
        }),
      });
      const data = await res.json();
      setContent(data.message);
      
      // Update portfolio if available
      if (data.portfolio && data.portfolio.length > 0) {
        setPortfolio(data.portfolio);
        if (typeof window !== 'undefined') {
          localStorage.setItem('apex_portfolio', JSON.stringify(data.portfolio));
        }
      }
      
      // Update stored report
      if (typeof window !== 'undefined' && isConnected) {
        localStorage.setItem('apex_first_report', data.message);
      }
    } catch {
      setContent(
        language === 'no' ? 'Feil ved henting av data' : 'Error fetching data'
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Only fetch data if connected
    if (!isConnected) return;
    
    // Only auto-fetch if we don't have a stored report
    const hasStoredReport = typeof window !== 'undefined' && localStorage.getItem('apex_first_report');
    if (!hasStoredReport) {
      fetchUpdate();
    }
    
    const interval = setInterval(fetchUpdate, 600000); // Refresh every 10 minutes
    return () => clearInterval(interval);
  }, [language, isConnected]);

  // If not connected, show landing page only (paywall)
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Header language={language} onLanguageChange={setLanguage} />
        <main>
          <Hero language={language} />
          <Features language={language} />
          <BrokerConnect language={language} />
        </main>
        <Footer language={language} />
      </div>
    );
  }

  // Connected - show full dashboard with ActiveTrader and reports
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header language={language} onLanguageChange={setLanguage} />
      <StatusBanner accountInfo={accountInfo} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Active Trading Engine - runs every 2 seconds when started */}
        <ActiveTrader 
          autoStart={true}
          intervalMs={2000}
          onTradeExecuted={(trades) => {
            console.log('[v0] Trades executed:', trades);
          }}
        />
        
        {/* Live Report Section */}
        <LiveReport
          content={content}
          isLoading={isLoading}
          language={language}
          onRefresh={fetchUpdate}
          isSubscribed={true}
          portfolio={portfolio}
        />
      </main>
      <Footer language={language} />
    </div>
  );
}

export default function ApexQuantum() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ApexQuantumContent />
    </Suspense>
  );
}

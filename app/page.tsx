'use client';

import { useState, useEffect } from 'react';
import { Header } from './components/header';
import { Hero } from './components/hero';
import { Features } from './components/features';
import { LiveReport } from './components/live-report';
import { Footer } from './components/footer';

export default function ApexQuantum() {
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [language, setLanguage] = useState<'no' | 'en'>('no');
  const [isSubscribed, setIsSubscribed] = useState(false);

  // Dev bypass: Add ?dev=1 to URL to bypass paywall
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('dev') === '1') {
      setIsSubscribed(true);
    }
  }, []);

  const fetchUpdate = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/apex/autonomous', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language }),
      });
      const data = await res.json();
      setContent(data.message);
    } catch {
      setContent(
        language === 'no' ? 'Feil ved henting av data' : 'Error fetching data'
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUpdate();
    const interval = setInterval(fetchUpdate, 600000);
    return () => clearInterval(interval);
  }, [language]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header language={language} onLanguageChange={setLanguage} />
      <main>
        <Hero language={language} />
        <Features language={language} />
        <LiveReport
          content={content}
          isLoading={isLoading}
          language={language}
          onRefresh={fetchUpdate}
          isSubscribed={isSubscribed}
        />
      </main>
      <Footer language={language} />
    </div>
  );
}

'use client';
import { useState, useEffect } from 'react';

export default function ApexQuantum() {
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [language, setLanguage] = useState<'no' | 'en'>('no');

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
    } catch (err) {
      setContent('Feil ved henting av data');
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
    <div className="min-h-screen bg-[#050507] text-white">
      <div className="max-w-7xl mx-auto px-8 pt-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-16">
          <img src="/aq-logo.png" alt="Apex Quantum" className="h-36" />
          <div className="flex items-center gap-8">
            <button onClick={() => setLanguage('no')} className={`text-3xl transition-all ${language === 'no' ? 'scale-110' : 'opacity-60 hover:opacity-100'}`}>🇳🇴</button>
            <button onClick={() => setLanguage('en')} className={`text-3xl transition-all ${language === 'en' ? 'scale-110' : 'opacity-60 hover:opacity-100'}`}>🇬🇧</button>
            <button 
              onClick={() => window.location.href = '/api/stripe/checkout'}
              className="bg-cyan-400 hover:bg-cyan-300 text-black font-semibold px-8 py-4 rounded-2xl transition-all"
            >
              Få tilgang nå – 499 kr/mnd
            </button>
          </div>
        </div>

        {/* Hero */}
        <div className="text-center mb-20">
          <h1 className="text-7xl font-bold tracking-tighter leading-none">
            The AI that never sleeps.<br />
            <span className="text-cyan-400">The edge that never stops.</span>
          </h1>
          <p className="mt-6 text-2xl text-gray-400 max-w-2xl mx-auto">
            Autonom AI-aksjerobot. 24/7 global scanning. Null menneskelig inngripen.
          </p>
        </div>

        {/* Live rapport */}
        <div className="bg-[#0a0a0a] border border-gray-800 rounded-3xl p-10 min-h-[70vh]">
          {content && <div className="prose prose-invert max-w-none">{content}</div>}
        </div>
      </div>
    </div>
  );
}
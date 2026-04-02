'use client';
import { useState, useEffect } from 'react';

export default function ApexQuantum() {
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const fetchUpdate = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/apex/autonomous', { method: 'POST' });
      const data = await res.json();
      setContent(data.message || 'Ingen data mottatt');
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
  }, []);

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans">
      <div className="max-w-7xl mx-auto px-8 pt-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-6">
            <div className="text-[92px] font-black tracking-[-8px] leading-none flex items-baseline">
              A<span className="text-cyan-400">Q</span>
            </div>
            <div>
              <div className="text-4xl font-semibold tracking-tight">APEX QUANTUM</div>
              <div className="text-xs text-gray-400 -mt-1">v6.1 • GLOBAL 24/7 EXTREME GROWTH</div>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-[#111] border border-gray-700 px-5 py-2.5 rounded-3xl">
            <div className="w-3 h-3 bg-emerald-400 rounded-full animate-pulse"></div>
            <span className="text-emerald-400 font-medium text-sm tracking-widest">FULL AUTONOM DRIFT • LIVE</span>
          </div>
        </div>

        {/* Hovedinnhold */}
        <div className="bg-[#0a0a0a] border border-gray-800 rounded-3xl p-10 min-h-[78vh] shadow-2xl">
          {isLoading && (
            <div className="flex flex-col items-center justify-center h-full py-24 text-emerald-400">
              <div className="text-6xl animate-pulse mb-8">◉</div>
              <p className="text-2xl font-light">Apex Quantum scanner markedet...</p>
            </div>
          )}

          {content && (
            <div className="prose prose-invert max-w-none">
              <div className="whitespace-pre-wrap text-[17px] leading-relaxed text-gray-100 font-light">
                {content}
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-500 mt-10">
          Dette er ikke finansiell rådgivning. Investeringer innebærer risiko for tap av kapital.
        </p>
      </div>
    </div>
  );
}
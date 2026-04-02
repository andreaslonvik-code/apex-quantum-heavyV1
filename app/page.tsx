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

    const interval = setInterval(() => {
      fetchUpdate();
    }, 600000); // hvert 10. minutt

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-6xl mx-auto px-8 pt-10">

        {/* Header med AQ-logo */}
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-5">
            <div className="text-8xl font-black tracking-[-6px] leading-none flex items-baseline">
              A<span className="text-cyan-400">Q</span>
            </div>
            <div className="text-5xl font-bold tracking-tighter">APEX QUANTUM</div>
          </div>

          <div className="flex items-center gap-3 bg-gray-900 border border-gray-700 px-6 py-3 rounded-3xl">
            <div className="w-3 h-3 bg-emerald-400 rounded-full animate-pulse"></div>
            <span className="text-emerald-400 font-medium text-sm">FULL AUTONOM DRIFT • LIVE</span>
          </div>
        </div>

        {/* Hovedboks - premium dark fintech look */}
        <div className="bg-[#0a0a0a] border border-gray-800 rounded-3xl p-10 min-h-[72vh] overflow-auto shadow-2xl">
          {isLoading && (
            <div className="flex flex-col items-center justify-center h-full py-20 text-emerald-400">
              <div className="text-5xl animate-pulse mb-6">◉</div>
              <p className="text-xl">Apex Quantum scanner markedet nå...</p>
            </div>
          )}

          {content && (
            <div className="prose prose-invert max-w-none text-[17px] leading-relaxed">
              <div className="whitespace-pre-wrap font-light text-gray-100">
                {content}
              </div>
            </div>
          )}
        </div>

        {/* Disclaimer */}
        <p className="text-center text-xs text-gray-500 mt-12">
          Dette er ikke finansiell rådgivning. Investeringer innebærer risiko for tap av kapital.
        </p>
      </div>
    </div>
  );
}
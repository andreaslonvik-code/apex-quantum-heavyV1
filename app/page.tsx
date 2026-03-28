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
      <div className="max-w-6xl mx-auto px-6 pt-8">
        
        {/* Header med AQ-logo */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            {/* AQ Logo */}
            <div className="text-7xl font-black tracking-[-4px] leading-none">
              A<span className="text-cyan-400">Q</span>
            </div>
            <div className="text-5xl font-bold tracking-tighter">APEX QUANTUM</div>
          </div>

          <div className="flex items-center gap-2 bg-gray-900 px-5 py-2.5 rounded-2xl border border-gray-800">
            <div className="w-3 h-3 bg-emerald-400 rounded-full animate-pulse"></div>
            <span className="text-emerald-400 text-sm font-medium">FULL AUTONOM DRIFT • LIVE</span>
          </div>
        </div>

        {/* Hovedrapport-boks */}
        <div className="bg-gray-950 border border-gray-800 rounded-3xl p-8 min-h-[72vh] overflow-auto">
          {isLoading && (
            <div className="flex flex-col items-center justify-center h-full text-emerald-400 py-20">
              <div className="animate-pulse text-4xl mb-4">◉</div>
              <p className="text-lg">Apex Quantum scanner markedet nå...</p>
            </div>
          )}

          {content && (
            <div className="prose prose-invert max-w-none">
              <div className="whitespace-pre-wrap text-[17px] leading-relaxed font-light text-gray-200">
                {content}
              </div>
            </div>
          )}
        </div>

        {/* Disclaimer */}
        <p className="text-center text-xs text-gray-500 mt-10">
          Dette er ikke finansiell rådgivning. Investeringer innebærer risiko for tap av kapital.
        </p>
      </div>
    </div>
  );
}
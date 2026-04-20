'use client';

import React from 'react';

interface FeaturesProps {
  language: 'no' | 'en';
}

export function Features({ language }: FeaturesProps) {
  const content = {
    no: {
      sectionTitle: 'Kraftige Funksjoner',
      sectionSubtitle: 'Alt du trenger for automatisk aksjehandel',
      features: [
        {
          icon: 'chart',
          title: '🇳🇴 Oslo Børs Handler',
          description: 'Apex Quantum handler norske og internasjonale aksjer på Oslo Børs (XOSL), NASDAQ og XETRA.',
        },
        {
          icon: 'stock',
          title: '📊 Kun Aksjehandel',
          description: 'Fokusert på aksjer (equities). Ingen CFD, futures, options eller andre derivater.',
        },
        {
          icon: 'ai',
          title: '🤖 Grok-4-Heavy AI',
          description: 'Bruker xAI Grok-4-Heavy for markedsanalyse, signaldeteksjon og porteføljoptimalisering.',
        },
        {
          icon: 'speed',
          title: '⚡ Automatisk Handling',
          description: 'Handler hver 2. sekund med optimaliserte selskapsstrategi og risikostyring.',
        },
        {
          icon: 'graph',
          title: '📈 Porteføljegraf',
          description: 'Se porteføljeverdi over tid, avkastning i % og NOK, live P&L per posisjon.',
        },
        {
          icon: 'withdraw',
          title: '💰 Ta ut Avkastning',
          description: 'Realisér gevinster på ett klikk. Selg posisjoner og sett kontoen tilbake til startkapital.',
        },
      ],
    },
    en: {
      sectionTitle: 'Powerful Features',
      sectionSubtitle: 'Everything you need for autonomous equity trading',
      features: [
        {
          icon: 'chart',
          title: '🇳🇴 Oslo Stock Exchange',
          description: 'Apex Quantum trades Norwegian and international stocks on Oslo (XOSL), NASDAQ, and XETRA.',
        },
        {
          icon: 'stock',
          title: '📊 Equities Only',
          description: 'Focused on stocks (equities). No CFD, futures, options or other derivatives.',
        },
        {
          icon: 'ai',
          title: '🤖 Grok-4-Heavy AI',
          description: 'Uses xAI Grok-4-Heavy for market analysis, signal detection and portfolio optimization.',
        },
        {
          icon: 'speed',
          title: '⚡ Autonomous Trading',
          description: 'Trades every 2 seconds with optimized strategies and risk management.',
        },
        {
          icon: 'graph',
          title: '📈 Portfolio Chart',
          description: 'See portfolio value over time, returns in % and NOK, live P&L per position.',
        },
        {
          icon: 'withdraw',
          title: '💰 Withdraw Profits',
          description: 'Realize gains with one click. Sell positions and reset account to starting capital.',
        },
      ],
    },
  };

  const t = content[language];
  const icons: Record<string, React.JSX.Element> = {
    chart: (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 3v18h18" />
        <path d="M18 17V9M13 17V5M8 17V11" />
      </svg>
    ),
    stock: (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="1" />
        <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" />
        <path d="M12 7v10M7 12h10" />
      </svg>
    ),
    ai: (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 2l3.5 6.5 7 1-5.5 5 1.5 7-6.5-3.5-6.5 3.5 1.5-7-5.5-5 7-1 3.5-6.5z" />
        <circle cx="12" cy="12" r="2" />
      </svg>
    ),
    speed: (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth="1.5">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
    graph: (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth="1.5">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 17" />
        <polyline points="17 6 23 6 23 12" />
      </svg>
    ),
    withdraw: (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth="1.5">
        <rect x="1" y="4" width="22" height="16" rx="2" />
        <path d="M1 10h22" />
      </svg>
    ),
  };

  return (
    <section id="features" className="py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">{t.sectionTitle}</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">{t.sectionSubtitle}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {t.features.map((feature, index) => (
            <div
              key={index}
              className="glass-card border border-border rounded-xl p-6 hover:border-neon-cyan/30 transition-all hover:neon-cyan-glow-subtle"
            >
              <div className="text-3xl mb-4">{feature.icon.split(' ')[0]}</div>
              <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>

        {/* Additional info section */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="glass-card rounded-xl p-8 border border-border">
            <h3 className="text-2xl font-bold mb-4">🛡️ Sikkert og Sertifisert</h3>
            <ul className="space-y-3 text-muted-foreground">
              <li className="flex items-start gap-3">
                <span className="text-neon-cyan mt-1">✓</span>
                <span>Integrasjon med Saxo Bank via OAuth 2.0</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-neon-cyan mt-1">✓</span>
                <span>Rate-limiting og DDoS-beskyttelse</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-neon-cyan mt-1">✓</span>
                <span>Strukturert logging for revisjon</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-neon-cyan mt-1">✓</span>
                <span>Legale ansvarsfraskrivelser inkludert</span>
              </li>
            </ul>
          </div>

          <div className="glass-card rounded-xl p-8 border border-border">
            <h3 className="text-2xl font-bold mb-4">📊 Åpenhet og Kontroll</h3>
            <ul className="space-y-3 text-muted-foreground">
              <li className="flex items-start gap-3">
                <span className="text-neon-cyan mt-1">✓</span>
                <span>Live dashboard med porteføljeoversikt</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-neon-cyan mt-1">✓</span>
                <span>Handelslogg og performance-metrikkern</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-neon-cyan mt-1">✓</span>
                <span>Velg mellom Sim og Live trading</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-neon-cyan mt-1">✓</span>
                <span>Av-koblings mulighet når som helst</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

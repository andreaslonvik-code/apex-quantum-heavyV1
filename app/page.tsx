'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { SignedIn, SignedOut, SignOutButton } from '@clerk/nextjs';

// ── Logo mark ──────────────────────────────────────────────────────────────
function AQLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="aqG" x1="10" y1="4" x2="54" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#E9FBFF" />
          <stop offset="0.45" stopColor="#00F5FF" />
          <stop offset="1" stopColor="#C026D3" />
        </linearGradient>
      </defs>
      <path d="M32 3 L38.84 22.95 L59.84 23.33 L42.96 35.85 L49.11 56.58 L32 44.6 L14.89 56.58 L21.04 35.85 L4.16 23.33 L25.16 22.95 Z" fill="url(#aqG)" />
      <path d="M32 49.4 L28.63 38.9 L17.62 38.9 L26.5 32.4 L23.13 21.9 L32 28.4 L40.87 21.9 L37.5 32.4 L46.38 38.9 L35.37 38.9 Z" fill="#05050A" />
    </svg>
  );
}

// ── 29 Modules data ────────────────────────────────────────────────────────
const MODULES = [
  { id: '01', name: 'Multi-venue tick ingestion',     pillar: 'P' },
  { id: '02', name: 'Vector sentiment engine',        pillar: 'P' },
  { id: '03', name: 'On-chain flow reader',           pillar: 'P' },
  { id: '04', name: 'Macro regime classifier',        pillar: 'P' },
  { id: '05', name: 'Derivatives gamma map',          pillar: 'P' },
  { id: '06', name: 'News semantic stream',           pillar: 'P' },
  { id: '07', name: 'Cross-asset correlation mesh',   pillar: 'P' },
  { id: '08', name: 'Transformer strategy graph',     pillar: 'C' },
  { id: '09', name: 'Reinforcement-learning core',    pillar: 'C' },
  { id: '10', name: 'Monte Carlo scenario tree',      pillar: 'C' },
  { id: '11', name: 'Counter-hypothesis checker',     pillar: 'C' },
  { id: '12', name: 'Regime-aware allocator',         pillar: 'C' },
  { id: '13', name: 'Bayesian confidence meter',      pillar: 'C' },
  { id: '14', name: 'Self-evolving genome',           pillar: 'C' },
  { id: '15', name: 'Smart-route order engine',       pillar: 'E' },
  { id: '16', name: 'Sub-millisecond matching',       pillar: 'E' },
  { id: '17', name: 'Iceberg & TWAP/VWAP',            pillar: 'E' },
  { id: '18', name: 'Liquidity sniper',               pillar: 'E' },
  { id: '19', name: 'Dark-pool access',               pillar: 'E' },
  { id: '20', name: 'Slippage auto-minimiser',        pillar: 'E' },
  { id: '21', name: 'Multi-exchange bridge',          pillar: 'E' },
  { id: '22', name: 'Quantum risk parity',            pillar: 'D' },
  { id: '23', name: 'Draw-down guardian',             pillar: 'D' },
  { id: '24', name: 'Black-swan circuit breaker',     pillar: 'D' },
  { id: '25', name: 'Stress-test simulator',          pillar: 'D' },
  { id: '26', name: 'Position-level stop matrix',     pillar: 'D' },
  { id: '27', name: 'Cold-wallet custody link',       pillar: 'D' },
  { id: '28', name: 'Human kill-switch',              pillar: 'D' },
  { id: '29', name: 'Immutable audit trail',          pillar: 'D' },
];

const PILLAR_COLOR: Record<string, string> = {
  P: 'rgba(0,245,255,0.15)',
  C: 'rgba(192,38,211,0.12)',
  E: 'rgba(245,196,67,0.12)',
  D: 'rgba(16,185,129,0.12)',
};
const PILLAR_BORDER: Record<string, string> = {
  P: 'rgba(0,245,255,0.2)',
  C: 'rgba(192,38,211,0.2)',
  E: 'rgba(245,196,67,0.2)',
  D: 'rgba(16,185,129,0.2)',
};

// ── Terminal lines ─────────────────────────────────────────────────────────
const TERMINAL_LINES = [
  { time: '14:32:06.812', tag: 'SCAN',   tagColor: '#00F5FF', text: 'Ingested 9 214 802 ticks across 412 venues' },
  { time: '14:32:06.889', tag: 'THINK',  tagColor: '#C026D3', text: 'Regime shift detected — vol cluster forming, NDX' },
  { time: '14:32:06.932', tag: 'EVOLVE', tagColor: '#F5C443', text: 'Mutated strategy σ-17 · fitness +0,42' },
  { time: '14:32:06.981', tag: 'RISK',   tagColor: '#10b981', text: 'Exposure re-parity · VaR 1,84% · within mandate' },
  { time: '14:32:07.044', tag: 'EXEC',   tagColor: '#00F5FF', text: 'LONG NVDA · 1,4% port · limit 924,10' },
  { time: '14:32:07.102', tag: 'EXEC',   tagColor: '#C026D3', text: 'SHORT USD/JPY · 0,8% port · 152,44' },
  { time: '14:32:07.188', tag: 'SCAN',   tagColor: '#00F5FF', text: 'Sentiment vector +0,62 · crypto · bullish' },
  { time: '14:32:07.233', tag: 'THINK',  tagColor: '#C026D3', text: 'Counter-hypothesis rejected · p=0,008' },
  { time: '14:32:07.301', tag: 'EVOLVE', tagColor: '#F5C443', text: 'Strategy σ-03 promoted · live' },
  { time: '14:32:07.389', tag: 'EXEC',   tagColor: '#00F5FF', text: 'LONG ETH · 2,1% port · mkt 3 924,80' },
];

// ── Main component ─────────────────────────────────────────────────────────
export default function LandingPage() {
  const [navScrolled, setNavScrolled] = useState(false);
  const [visibleLines, setVisibleLines] = useState(0);
  const terminalRef = useRef<HTMLDivElement>(null);

  // Nav scroll effect
  useEffect(() => {
    const handler = () => setNavScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  // Terminal typewriter
  useEffect(() => {
    if (visibleLines >= TERMINAL_LINES.length) return;
    const t = setTimeout(() => setVisibleLines(v => v + 1), 320 + Math.random() * 180);
    return () => clearTimeout(t);
  }, [visibleLines]);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [visibleLines]);

  return (
    <>
      {/* Background layers */}
      <div className="ambient" aria-hidden="true" />
      <div className="grain"  aria-hidden="true" />

      {/* ── NAV ──────────────────────────────────────────── */}
      <header
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
        style={{
          background: navScrolled ? 'rgba(5,5,10,0.9)' : 'transparent',
          backdropFilter: navScrolled ? 'blur(20px)' : 'none',
          borderBottom: navScrolled ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
        }}
      >
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Logo */}
          <a href="#top" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <AQLogo size={28} />
            <span style={{ fontWeight: 700, fontSize: '0.95rem', letterSpacing: '0.06em', color: 'var(--aq-text)' }}>
              APEX <em style={{ fontStyle: 'normal', color: 'var(--aq-cyan)' }}>QUANTUM</em>
            </span>
          </a>

          {/* Links */}
          <nav style={{ display: 'flex', gap: 32, alignItems: 'center' }} className="hidden md:flex">
            {['#intelligence', '#capabilities', '#core', '#performance', '#security', '#pricing'].map((href, i) => (
              <a key={i} href={href} style={{ color: 'var(--aq-muted)', textDecoration: 'none', fontSize: '0.875rem', transition: 'color 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--aq-text)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--aq-muted)')}>
                {['Intelligence', 'Capabilities', 'Core', 'Performance', 'Security', 'Pricing'][i]}
              </a>
            ))}
          </nav>

          {/* CTA */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Link href="/dashboard" className="btn btn-ghost btn-sm">Dashboard</Link>
            <SignedIn>
              <SignOutButton redirectUrl="/">
                <button type="button" className="btn btn-ghost btn-sm">Logg ut</button>
              </SignOutButton>
            </SignedIn>
            <SignedOut>
              <a href="#pricing" className="btn btn-primary btn-sm">
                Get access
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </a>
            </SignedOut>
          </div>
        </div>
      </header>

      <div className="relative" style={{ zIndex: 2 }}>

        {/* ── HERO ─────────────────────────────────────── */}
        <section id="top" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', paddingTop: 96 }}>
          <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px', width: '100%' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }} className="hero-grid">

              {/* Copy */}
              <div>
                <div className="tag tag-live" style={{ marginBottom: 28 }}>
                  <span className="dot" />
                  v6.2 · Global 24/7 Extreme Growth Edition
                </div>

                <h1 style={{ fontSize: 'clamp(2.8rem,5vw,4.2rem)', fontWeight: 700, lineHeight: 1.1, marginBottom: 24, letterSpacing: '-0.02em' }}>
                  The market<br />
                  <span className="gradient-text">thinks in light.</span><br />
                  So do we.
                </h1>

                <p style={{ color: 'var(--aq-muted)', fontSize: '1.1rem', lineHeight: 1.7, marginBottom: 36, maxWidth: 480 }}>
                  Apex Quantum is a self-directing AI trading system that scans nine million
                  signals a second, evolves its own strategies in real time, and compounds
                  capital with surgical risk control — around the clock, without you lifting a finger.
                </p>

                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 48 }}>
                  <a href="#pricing" className="btn btn-primary">
                    Activate live trading
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </a>
                  <Link href="/dashboard" className="btn btn-ghost">See the cockpit</Link>
                </div>

                {/* Stats */}
                <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
                  {[
                    { label: 'YTD compounded',    val: '+187,34%' },
                    { label: 'Asymmetric score',  val: '9,5 / 10' },
                    { label: 'Signals / sec',     val: '9,2 M' },
                    { label: 'Max drawdown',      val: '–4,7%' },
                  ].map(s => (
                    <div key={s.label}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--aq-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4, fontFamily: 'var(--font-jetbrains)' }}>{s.label}</div>
                      <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: '1.1rem', fontWeight: 600, color: 'var(--aq-cyan)' }}>{s.val}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Hero showcase card */}
              <div className="glass glass-hi" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Card header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--aq-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="tag tag-live"><span className="dot" />LIVE AUTONOMOUS</span>
                    <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: '0.65rem', color: 'var(--aq-muted)', letterSpacing: '0.08em' }}>APEX · PORTFOLIO</span>
                  </div>
                  <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: '0.65rem', color: 'var(--aq-muted)' }}>24H · 7D · 30D · <b style={{ color: 'var(--aq-text)' }}>MAX</b></span>
                </div>

                {/* Return */}
                <div style={{ padding: '20px 20px 0' }}>
                  <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: '0.65rem', color: 'var(--aq-muted)', letterSpacing: '0.1em', marginBottom: 6 }}>COMPOUNDED RETURN · YTD</div>
                  <div style={{ fontSize: '2.8rem', fontWeight: 700, lineHeight: 1, marginBottom: 6 }}>
                    <span className="gradient-text">+187,34</span>
                    <span style={{ fontSize: '1.4rem', color: 'var(--aq-muted)' }}>%</span>
                  </div>
                  <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: '0.72rem', color: '#10b981' }}>▲ +4,21% · siste 24t</div>
                </div>

                {/* Equity SVG */}
                <div style={{ padding: '12px 0 0' }}>
                  <svg viewBox="0 0 800 180" preserveAspectRatio="none" style={{ width: '100%', height: 180, display: 'block' }}>
                    <defs>
                      <linearGradient id="hFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="#00F5FF" stopOpacity="0.4" />
                        <stop offset="0.5" stopColor="#C026D3" stopOpacity="0.12" />
                        <stop offset="1" stopColor="#C026D3" stopOpacity="0" />
                      </linearGradient>
                      <linearGradient id="hStroke" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0" stopColor="#00F5FF" />
                        <stop offset="1" stopColor="#C026D3" />
                      </linearGradient>
                      <filter id="hGlow">
                        <feGaussianBlur stdDeviation="2.5" result="b" />
                        <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                      </filter>
                    </defs>
                    <g stroke="rgba(255,255,255,0.05)" strokeWidth="1">
                      <line x1="0" y1="40" x2="800" y2="40" />
                      <line x1="0" y1="90" x2="800" y2="90" />
                      <line x1="0" y1="140" x2="800" y2="140" />
                    </g>
                    <path d="M0,165 C 50,162 100,158 160,145 S 280,118 360,96 S 470,68 550,48 S 660,28 760,18 L800,15 L800,180 L0,180 Z" fill="url(#hFill)" />
                    <path d="M0,165 C 50,162 100,158 160,145 S 280,118 360,96 S 470,68 550,48 S 660,28 760,18 L800,15" stroke="url(#hStroke)" strokeWidth="2" fill="none" filter="url(#hGlow)" />
                    <circle cx="800" cy="15" r="4" fill="#00F5FF" />
                    <circle cx="800" cy="15" r="10" fill="none" stroke="#00F5FF" strokeOpacity="0.4">
                      <animate attributeName="r" from="4" to="18" dur="1.8s" repeatCount="indefinite" />
                      <animate attributeName="stroke-opacity" from="0.6" to="0" dur="1.8s" repeatCount="indefinite" />
                    </circle>
                    {/* Signal markers */}
                    {[[130, 143], [280, 114], [430, 74], [580, 42], [720, 20]].map(([x, y], i) => (
                      <circle key={i} cx={x} cy={y} r="3" fill={i % 2 === 0 ? '#F5C443' : '#00F5FF'} />
                    ))}
                  </svg>
                  {/* X axis */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 16px 12px', fontFamily: 'var(--font-jetbrains)', fontSize: '0.6rem', color: 'var(--aq-muted)' }}>
                    {['JAN','FEB','MAR','APR','MAI','JUN','JUL','NÅ'].map(m => <span key={m}>{m}</span>)}
                  </div>
                </div>

                {/* Footer chips */}
                <div style={{ display: 'flex', borderTop: '1px solid var(--aq-border)' }}>
                  {[
                    { k: 'POS',     v: '14 open' },
                    { k: 'WIN%',    v: '73,4' },
                    { k: 'SHARPE',  v: '4,12' },
                    { k: 'LATENCY', v: '1,8 ms' },
                  ].map(c => (
                    <div key={c.k} style={{ flex: 1, padding: '12px 16px', borderRight: '1px solid var(--aq-border)', textAlign: 'center' }}>
                      <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: '0.6rem', color: 'var(--aq-muted)', marginBottom: 3 }}>{c.k}</div>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{c.v}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── CAPABILITY MARQUEE ───────────────────────── */}
        <div className="marquee-outer" style={{ padding: '20px 0', borderTop: '1px solid var(--aq-border)', borderBottom: '1px solid var(--aq-border)', background: 'rgba(255,255,255,0.02)' }}>
          <div className="marquee-track">
            {[
              'REINFORCEMENT LEARNING CORE','VECTOR SENTIMENT ENGINE','MULTI-EXCHANGE ROUTING',
              'QUANTUM RISK PARITY','SELF-EVOLVING STRATEGIES','24/7 AUTONOMY',
              'SUB-MILLISECOND EXECUTION','DARK-POOL ACCESS','BAYESIAN CONFIDENCE',
              'REINFORCEMENT LEARNING CORE','VECTOR SENTIMENT ENGINE','MULTI-EXCHANGE ROUTING',
              'QUANTUM RISK PARITY','SELF-EVOLVING STRATEGIES','24/7 AUTONOMY',
              'SUB-MILLISECOND EXECUTION','DARK-POOL ACCESS','BAYESIAN CONFIDENCE',
            ].map((item, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 20, paddingRight: 40, fontFamily: 'var(--font-jetbrains)', fontSize: '0.7rem', letterSpacing: '0.12em', color: 'var(--aq-muted)', whiteSpace: 'nowrap' }}>
                {item}
                {i < 17 && <span style={{ color: 'rgba(0,245,255,0.3)', fontSize: '0.5rem' }}>◆</span>}
              </span>
            ))}
          </div>
        </div>

        {/* ── INTELLIGENCE ─────────────────────────────── */}
        <section id="intelligence" style={{ padding: '120px 24px' }}>
          <div style={{ maxWidth: 1280, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 72 }}>
              <div className="tag" style={{ marginBottom: 20, display: 'inline-flex' }}>
                <span className="dot-pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--aq-cyan)', animation: 'blink 1.6s infinite' }} />
                THE QUANTUM CORE
              </div>
              <h2 style={{ fontSize: 'clamp(2rem,4vw,3rem)', fontWeight: 700, lineHeight: 1.15, marginBottom: 16, letterSpacing: '-0.02em' }}>
                An intelligence that{' '}
                <span className="gradient-text-gold">evolves itself</span>.
              </h2>
              <p style={{ color: 'var(--aq-muted)', maxWidth: 560, margin: '0 auto', lineHeight: 1.7 }}>
                Every millisecond Apex refactors its own strategy graph. It reads the tape,
                rewrites its risk models, tests thousands of counter-hypotheses — and only then commits capital.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }} className="intel-grid">
              {/* Terminal */}
              <div className="glass" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid var(--aq-border)' }}>
                  <span className="tag tag-live"><span className="dot" />AGENT · THINKING</span>
                  <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: '0.6rem', color: 'var(--aq-muted)' }}>core.apex/v6.2</span>
                </div>
                <div ref={terminalRef} style={{ padding: '16px 18px', height: 340, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {TERMINAL_LINES.slice(0, visibleLines).map((line, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', animation: 'fade-up 0.3s ease-out', fontSize: '0.78rem' }}>
                      <span style={{ fontFamily: 'var(--font-jetbrains)', color: 'var(--aq-muted)', fontSize: '0.68rem', flexShrink: 0, paddingTop: 1 }}>{line.time}</span>
                      <span style={{ background: `${line.tagColor}18`, border: `1px solid ${line.tagColor}30`, color: line.tagColor, borderRadius: 4, padding: '1px 6px', fontFamily: 'var(--font-jetbrains)', fontSize: '0.62rem', fontWeight: 700, flexShrink: 0 }}>{line.tag}</span>
                      <span style={{ color: 'var(--aq-text)', lineHeight: 1.5 }}>{line.text}</span>
                    </div>
                  ))}
                  {visibleLines < TERMINAL_LINES.length && (
                    <div style={{ display: 'flex', gap: 4, paddingTop: 4 }}>
                      {[0, 1, 2].map(i => (
                        <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--aq-cyan)', opacity: 0.5, animation: `blink 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Quantum Core visual */}
              <div className="glass" style={{ padding: 24, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                  <span className="tag">QUANTUM CORE</span>
                  <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: '0.6rem', color: 'var(--aq-muted)' }}>RL · TRANSFORMER · GRAPH</span>
                </div>

                {/* Animated rings */}
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', minHeight: 260 }}>
                  {[180, 140, 108, 80].map((size, i) => (
                    <div key={i} style={{
                      position: 'absolute', width: size, height: size, borderRadius: '50%',
                      border: `1px solid rgba(0,245,255,${0.06 + i * 0.04})`,
                      animation: `ring-spin ${6 + i * 4}s linear ${i % 2 === 0 ? '' : 'reverse'} infinite`,
                    }} />
                  ))}
                  {/* Core orb */}
                  <div style={{
                    position: 'relative', zIndex: 2,
                    width: 60, height: 60, borderRadius: '50%',
                    background: 'linear-gradient(135deg, rgba(0,245,255,0.3), rgba(192,38,211,0.3))',
                    boxShadow: '0 0 30px rgba(0,245,255,0.3), 0 0 60px rgba(192,38,211,0.2)',
                    animation: 'orb-pulse 2.5s ease-in-out infinite',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    textAlign: 'center',
                  }}>
                    <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: '0.55rem', fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>APEX<br/>v6.2</span>
                  </div>
                  {/* Orbit labels */}
                  {[
                    { label: 'SCAN',   angle: 0,   r: 94 },
                    { label: 'RISK',   angle: 90,  r: 74 },
                    { label: 'EVOLVE', angle: 180, r: 94 },
                    { label: 'EXEC',   angle: 270, r: 74 },
                  ].map(({ label, angle, r }) => {
                    const rad = (angle * Math.PI) / 180;
                    return (
                      <div key={label} style={{
                        position: 'absolute',
                        left: '50%', top: '50%',
                        transform: `translate(calc(-50% + ${Math.cos(rad) * r}px), calc(-50% + ${Math.sin(rad) * r}px))`,
                        background: 'rgba(0,245,255,0.1)', border: '1px solid rgba(0,245,255,0.2)',
                        borderRadius: 6, padding: '2px 8px',
                        fontFamily: 'var(--font-jetbrains)', fontSize: '0.6rem', fontWeight: 700,
                        color: 'var(--aq-cyan)', whiteSpace: 'nowrap',
                      }}>{label}</div>
                    );
                  })}
                </div>

                {/* Metrics row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginTop: 16 }}>
                  {[
                    { k: 'UPTIME',  v: '99,998%' },
                    { k: 'VENUES',  v: '412' },
                    { k: 'MODELS',  v: '29 live' },
                    { k: 'LATENCY', v: '1,8 ms' },
                  ].map(m => (
                    <div key={m.k} style={{ textAlign: 'center', background: 'var(--aq-surface)', borderRadius: 8, padding: '10px 6px' }}>
                      <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: '0.58rem', color: 'var(--aq-muted)', marginBottom: 4, letterSpacing: '0.08em' }}>{m.k}</div>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{m.v}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── v6.2 CAPABILITY UPLIFT ─────────────────── */}
        <section id="capabilities" style={{ padding: '40px 24px 120px', borderTop: '1px solid var(--aq-border)' }}>
          <div style={{ maxWidth: 1280, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 56, paddingTop: 60 }}>
              <div className="tag" style={{ marginBottom: 20, display: 'inline-flex' }}>
                <span className="dot-pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--aq-cyan)', animation: 'blink 1.6s infinite' }} />
                v6.2 · CAPABILITY UPLIFT
              </div>
              <h2 style={{ fontSize: 'clamp(1.8rem,3.5vw,2.8rem)', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 12 }}>
                Twelve new engines.{' '}
                <span className="gradient-text">One asymmetric edge.</span>
              </h2>
              <p style={{ color: 'var(--aq-muted)', maxWidth: 600, margin: '0 auto', lineHeight: 1.7 }}>
                v6.2 lifts the global asymmetric-upside score to <span style={{ color: 'var(--aq-cyan)', fontFamily: 'var(--font-jetbrains)' }}>9,5 / 10</span> — measured against every benchmarked AI trader on the Alpha Arena leaderboard.
                Each engine below describes a capability surface, not an algorithm.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {[
                { name: 'Meta-Cognition Layer',          role: 'Self-rates confidence, regime fit and counter-hypotheses before any capital is committed.' },
                { name: 'Self-Evolution Engine',         role: 'Mutates and promotes strategy variants every 24 hours under adaptive fitness scoring.' },
                { name: 'Purge Module',                  role: 'Hard-clears stale state, cached signals and overhang every cycle — no decision drift.' },
                { name: 'Recursive Summarization',       role: 'Compresses live context into compounding embeddings so 24/7 reasoning stays bounded.' },
                { name: 'Crisis Relocation Engine',      role: 'Rotates exposure into pre-vetted hedge baskets the instant a regime-shift signal fires.' },
                { name: 'Global Best-Portfolio Rule',    role: 'Continuously enforces that current holdings stay on the asymmetric-upside frontier.' },
                { name: 'Adaptive Kelly Optimisation',   role: 'Sizes positions against rolling edge and live volatility — no static allocation rules.' },
                { name: 'Real-Time Tool Integration',    role: 'Live data, futures, news and on-chain feeds pulled fresh per scan. No template carry-over.' },
                { name: 'Profit-Taking Engine',          role: 'Locks gains in tranches, tuned per asset volatility regime.' },
                { name: 'Dynamic Trailing-Stop',         role: 'Stop ratchets toward break-even as unrealised P/L grows; re-arms on re-entry.' },
                { name: 'Dynamic Rebalancing',           role: 'Drifts the live book back toward target weights without forced churn.' },
                { name: 'Adaptive Growth Engine',        role: 'Re-tunes risk budget and compounding cadence to match the live volatility regime.' },
              ].map((c, i) => (
                <div key={c.name} className="glass" style={{ padding: 20, position: 'relative' }}>
                  <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: '0.58rem', color: 'var(--aq-muted)', letterSpacing: '0.1em', marginBottom: 8 }}>
                    {String(i + 1).padStart(2, '0')} · ENGINE
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: 10, color: 'var(--aq-text)' }}>
                    {c.name}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--aq-muted)', lineHeight: 1.55 }}>
                    {c.role}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 29 MODULES ───────────────────────────────── */}
        <section id="modules" style={{ padding: '80px 24px 120px' }}>
          <div style={{ maxWidth: 1280, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 64 }}>
              <div className="tag" style={{ marginBottom: 20, display: 'inline-flex' }}>THE 29 MODULES</div>
              <h2 style={{ fontSize: 'clamp(1.8rem,3.5vw,2.8rem)', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 12 }}>Every module, orchestrated.</h2>
              <p style={{ color: 'var(--aq-muted)', maxWidth: 520, margin: '0 auto', lineHeight: 1.6 }}>
                Twenty-nine specialised engines, each world-class on its own, continuously negotiating the next move.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
              {MODULES.map(m => (
                <div key={m.id}
                  style={{
                    padding: '14px 16px',
                    borderRadius: 10,
                    background: PILLAR_COLOR[m.pillar],
                    border: `1px solid ${PILLAR_BORDER[m.pillar]}`,
                    display: 'flex', alignItems: 'center', gap: 12,
                    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
                    (e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 24px ${PILLAR_BORDER[m.pillar]}`;
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLDivElement).style.transform = '';
                    (e.currentTarget as HTMLDivElement).style.boxShadow = '';
                  }}
                >
                  <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: '0.62rem', color: 'var(--aq-muted)', flexShrink: 0, width: 22 }}>{m.id}</span>
                  <span style={{ fontSize: '0.83rem', color: 'var(--aq-text)' }}>{m.name}</span>
                </div>
              ))}
            </div>

            {/* Pillar legend */}
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 32, flexWrap: 'wrap' }}>
              {[
                { k: 'P', label: 'Perception', color: '#00F5FF' },
                { k: 'C', label: 'Cognition',  color: '#C026D3' },
                { k: 'E', label: 'Execution',  color: '#F5C443' },
                { k: 'D', label: 'Defense',    color: '#10b981' },
              ].map(p => (
                <div key={p.k} style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-jetbrains)', fontSize: '0.7rem', color: 'var(--aq-muted)' }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: p.color }} />
                  {p.label}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── PROPRIETARY CORE (gatekeep) ──────────────── */}
        <section id="core" style={{ padding: '80px 24px 120px', borderTop: '1px solid var(--aq-border)', background: 'rgba(255,255,255,0.015)' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 56, alignItems: 'center' }} className="core-grid">
              <div>
                <div className="tag" style={{ marginBottom: 20, display: 'inline-flex' }}>
                  <span className="dot-pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: '#F5C443', animation: 'blink 1.6s infinite' }} />
                  THE PROPRIETARY CORE
                </div>
                <h2 style={{ fontSize: 'clamp(1.8rem,3.5vw,2.6rem)', fontWeight: 700, lineHeight: 1.15, marginBottom: 20, letterSpacing: '-0.02em' }}>
                  We show you{' '}
                  <span className="gradient-text-gold">what it does.</span><br/>
                  Not the recipe.
                </h2>
                <p style={{ color: 'var(--aq-muted)', lineHeight: 1.7, marginBottom: 24 }}>
                  Apex Quantum's edge is the choreography between the engines above — how confidence is rated, how positions are sized, how regime-shifts are detected, which signals are weighted and why. That choreography is the IP.
                </p>
                <p style={{ color: 'var(--aq-muted)', lineHeight: 1.7 }}>
                  You see the capability surface, the audited track record, and the live telemetry on your own dashboard. The model weights, prompt graphs, threshold matrices and self-evolution scoring stay inside the core. Operators trade the results, not the recipe.
                </p>
              </div>

              <div className="glass glass-hi" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid var(--aq-border)' }}>
                  <span className="tag">DISCLOSURE BOUNDARY</span>
                  <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: '0.6rem', color: 'var(--aq-muted)' }}>core.apex/v6.2</span>
                </div>
                <div style={{ padding: '4px 0' }}>
                  {[
                    { k: 'Capability surface',         shown: true,  note: 'Twelve engines, named and described.' },
                    { k: 'Live telemetry',             shown: true,  note: 'Streaming on your dashboard 24/7.' },
                    { k: 'Audited performance',        shown: true,  note: 'Independently attested every month.' },
                    { k: 'Model weights & prompts',    shown: false, note: 'Stay inside the core. Always.' },
                    { k: 'Threshold matrices',         shown: false, note: 'Calibrated continuously, never published.' },
                    { k: 'Self-evolution scoring',     shown: false, note: 'Internal fitness function, not exposed.' },
                    { k: 'Crisis playbook composition', shown: false, note: 'Hedge baskets are pre-vetted, not disclosed.' },
                  ].map((row) => (
                    <div key={row.k} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 18px', borderBottom: '1px solid var(--aq-border)' }}>
                      <div style={{
                        width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: row.shown ? 'rgba(16,185,129,0.15)' : 'rgba(245,196,67,0.12)',
                        border: `1px solid ${row.shown ? 'rgba(16,185,129,0.4)' : 'rgba(245,196,67,0.35)'}`,
                      }}>
                        {row.shown ? (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        ) : (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M5 12h14" stroke="#F5C443" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        )}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--aq-text)' }}>{row.k}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--aq-muted)', marginTop: 2 }}>{row.note}</div>
                      </div>
                      <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: '0.6rem', letterSpacing: '0.08em', color: row.shown ? '#10b981' : '#F5C443' }}>
                        {row.shown ? 'PUBLIC' : 'SEALED'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── PERFORMANCE ──────────────────────────────── */}
        <section id="performance" style={{ padding: '80px 24px 120px', borderTop: '1px solid var(--aq-border)' }}>
          <div style={{ maxWidth: 1280, margin: '0 auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }} className="perf-grid">
              <div>
                <div className="tag" style={{ marginBottom: 20, display: 'inline-flex' }}>
                  <span className="dot-pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--aq-cyan)', animation: 'blink 1.6s infinite' }} />
                  VERIFIED TRACK RECORD
                </div>
                <h2 style={{ fontSize: 'clamp(1.8rem,3.5vw,2.8rem)', fontWeight: 700, lineHeight: 1.15, marginBottom: 20, letterSpacing: '-0.02em' }}>
                  Compounding,<br/>not promising.
                </h2>
                <p style={{ color: 'var(--aq-muted)', lineHeight: 1.7, marginBottom: 40 }}>
                  Live-audited by independent third parties. Trades, fills, fees — publicly attested every month on-chain.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                  {[
                    { val: '+187,34%', label: 'YTD · net of fees', gradient: true },
                    { val: '4,12',     label: 'Sharpe · trailing 12m' },
                    { val: '–4,7%',    label: 'Max drawdown · 2025–26' },
                    { val: '73,4%',    label: 'Win rate · 284 312 trades' },
                  ].map(k => (
                    <div key={k.label}>
                      <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: '1.6rem', fontWeight: 700, marginBottom: 4 }}>
                        {k.gradient ? <span className="gradient-text">{k.val}</span> : k.val}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--aq-muted)' }}>{k.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Performance chart card */}
              <div className="glass glass-hi" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--aq-border)' }}>
                  <span className="tag">APEX vs BENCHMARKS</span>
                  <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: '0.6rem', color: 'var(--aq-muted)' }}>JAN 2025 – NÅ</span>
                </div>
                <svg viewBox="0 0 560 220" preserveAspectRatio="none" style={{ width: '100%', height: 220, display: 'block' }}>
                  <defs>
                    <linearGradient id="pFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="#00F5FF" stopOpacity="0.3" />
                      <stop offset="1" stopColor="#C026D3" stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id="pStroke" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0" stopColor="#00F5FF" />
                      <stop offset="1" stopColor="#C026D3" />
                    </linearGradient>
                  </defs>
                  <g stroke="rgba(255,255,255,0.05)">
                    {[40,80,120,160].map(y => <line key={y} x1="0" y1={y} x2="560" y2={y} />)}
                  </g>
                  {/* BTC */}
                  <path d="M0,200 C 60,196 120,200 180,186 S 280,172 340,180 S 440,155 500,138 L560,128" stroke="rgba(245,196,67,0.5)" strokeWidth="1.4" fill="none" strokeDasharray="3 3" />
                  {/* S&P */}
                  <path d="M0,202 C 80,200 160,198 240,195 S 380,190 440,183 L560,178" stroke="rgba(255,255,255,0.25)" strokeWidth="1.2" fill="none" strokeDasharray="2 4" />
                  {/* Apex area + line */}
                  <path d="M0,202 C 60,192 120,180 180,158 S 280,118 340,90 S 420,55 480,35 L560,22 L560,220 L0,220 Z" fill="url(#pFill)" />
                  <path d="M0,202 C 60,192 120,180 180,158 S 280,118 340,90 S 420,55 480,35 L560,22" stroke="url(#pStroke)" strokeWidth="2" fill="none" />
                </svg>
                <div style={{ display: 'flex', gap: 20, padding: '12px 18px', borderTop: '1px solid var(--aq-border)' }}>
                  {[
                    { color: '#00F5FF', label: 'APEX +187,34%' },
                    { color: '#F5C443', label: 'BTC +62,1%' },
                    { color: 'rgba(255,255,255,0.5)', label: 'S&P +14,8%' },
                  ].map(l => (
                    <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-jetbrains)', fontSize: '0.68rem', color: 'var(--aq-muted)' }}>
                      <div style={{ width: 10, height: 2, borderRadius: 1, background: l.color }} />{l.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── TESTIMONIALS ─────────────────────────────── */}
        <section style={{ padding: '80px 24px 120px' }}>
          <div style={{ maxWidth: 1280, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 64 }}>
              <div className="tag" style={{ marginBottom: 20, display: 'inline-flex' }}>OPERATORS</div>
              <h2 style={{ fontSize: 'clamp(1.8rem,3.5vw,2.8rem)', fontWeight: 700, letterSpacing: '-0.02em' }}>
                What the people running real money say.
              </h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }} className="voice-grid">
              {[
                { quote: 'I\'ve run discretionary books for eleven years. Apex is the first system where I genuinely feel like the second-best trader in the room.', name: 'J. Hellström', role: 'PM · Nordic Macro Fund', avatar: 'JH' },
                { quote: 'It self-hedged a position sixty seconds before the announcement hit Reuters. We\'re still not sure how, honestly.', name: 'A. Mehta', role: 'CIO · Veridian Partners', avatar: 'AM' },
                { quote: 'The dashboard is almost boring — in the best way. A single number, a single curve. You just let it cook.', name: 'S. Vatnehaug', role: 'Family Office · Oslo', avatar: 'SV' },
              ].map((t, i) => (
                <div key={i} className="glass" style={{ padding: 28 }}>
                  <blockquote style={{ fontSize: '0.95rem', lineHeight: 1.7, color: 'var(--aq-text)', marginBottom: 24, fontStyle: 'italic' }}>
                    "{t.quote}"
                  </blockquote>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: '50%',
                      background: `linear-gradient(135deg, rgba(0,245,255,0.2), rgba(192,38,211,0.2))`,
                      border: '1px solid var(--aq-border-hi)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--font-jetbrains)', fontSize: '0.7rem', fontWeight: 700, color: 'var(--aq-cyan)',
                    }}>{t.avatar}</div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{t.name}</div>
                      <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: '0.65rem', color: 'var(--aq-muted)' }}>{t.role}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── SECURITY ─────────────────────────────────── */}
        <section id="security" style={{ padding: '80px 24px 120px', borderTop: '1px solid var(--aq-border)' }}>
          <div style={{ maxWidth: 1280, margin: '0 auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }} className="sec-grid">
              <div>
                <div className="tag" style={{ marginBottom: 20, display: 'inline-flex' }}>SECURITY & CUSTODY</div>
                <h2 style={{ fontSize: 'clamp(1.8rem,3.5vw,2.8rem)', fontWeight: 700, lineHeight: 1.15, marginBottom: 20, letterSpacing: '-0.02em' }}>
                  Non-custodial.<br/><span className="gradient-text-gold">By design.</span>
                </h2>
                <p style={{ color: 'var(--aq-muted)', lineHeight: 1.7 }}>
                  Apex executes on your exchange & brokerage accounts.
                  Keys never leave your vault. We never hold a single krone of your capital.
                </p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { icon: '🛡', title: 'SOC 2 Type II', desc: 'Annually audited controls, continuous attestation.' },
                  { icon: '🔑', title: 'Read / trade-only keys', desc: 'No withdrawal permissions. Ever. Enforced at the router.' },
                  { icon: '⚡', title: 'Human kill-switch', desc: 'One tap halts every engine, globally, in under 100 ms.' },
                  { icon: '🔗', title: 'Immutable audit trail', desc: 'Every decision hashed on-chain. Verifiable forever.' },
                ].map(s => (
                  <div key={s.title} className="glass" style={{ padding: 20 }}>
                    <div style={{ fontSize: '1.5rem', marginBottom: 10 }}>{s.icon}</div>
                    <div style={{ fontWeight: 600, marginBottom: 6, fontSize: '0.9rem' }}>{s.title}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--aq-muted)', lineHeight: 1.5 }}>{s.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── PRICING ──────────────────────────────────── */}
        <section id="pricing" style={{ padding: '80px 24px 120px' }}>
          <div style={{ maxWidth: 800, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 56 }}>
              <div className="tag" style={{ marginBottom: 20, display: 'inline-flex' }}>ACCESS</div>
              <h2 style={{ fontSize: 'clamp(1.8rem,3.5vw,2.8rem)', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 12 }}>
                One tier. <span className="gradient-text">Everything inside.</span>
              </h2>
              <p style={{ color: 'var(--aq-muted)', lineHeight: 1.6, maxWidth: 440, margin: '0 auto' }}>
                Apex is a single product, fully loaded. No seats, no upsells, no surprises. Cancel in one tap.
              </p>
            </div>

            <div className="glass glass-hi" style={{ padding: 0, overflow: 'hidden', position: 'relative' }}>
              {/* Price glow */}
              <div style={{ position: 'absolute', top: -60, left: '50%', transform: 'translateX(-50%)', width: 300, height: 120, background: 'radial-gradient(ellipse, rgba(0,245,255,0.1), transparent)', borderRadius: '50%', pointerEvents: 'none' }} />

              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', padding: '32px 36px', borderBottom: '1px solid var(--aq-border)' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: '0.65rem', color: 'var(--aq-muted)', letterSpacing: '0.1em', marginBottom: 8 }}>APEX QUANTUM · OPERATOR LICENSE</div>
                  <h3 style={{ fontWeight: 700, fontSize: '1.2rem' }}>Full autonomous intelligence</h3>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                    <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: '1rem', color: 'var(--aq-muted)' }}>kr</span>
                    <span className="gradient-text" style={{ fontFamily: 'var(--font-jetbrains)', fontSize: '2.8rem', fontWeight: 700 }}>4 990</span>
                    <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: '0.85rem', color: 'var(--aq-muted)' }}>/ mnd</span>
                  </div>
                  <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: '0.65rem', color: 'var(--aq-muted)' }}>14-dagers prøveperiode inkludert</div>
                </div>
              </div>

              {/* Features */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
                {[
                  'Alle 29 moduler · live',
                  'Sub-millisecond ordrerutning',
                  'Ubegrenset antall børser & meglere',
                  'Revidert historikk, månedlig',
                  'Selvevolverende strategigenome',
                  'Mobil dashboard + desktop cockpit',
                  '24/7 autonom eksekusjon',
                  'On-chain immutable audit trail',
                  'Live & demo modus',
                  'Privat Signal-rom (kun operatører)',
                  'Risk-parity + drawdown guardian',
                  'Menneskelig nødstopp, alltid',
                ].map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 24px', borderBottom: i < 10 ? '1px solid var(--aq-border)' : 'none', borderRight: i % 2 === 0 ? '1px solid var(--aq-border)' : 'none' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    <span style={{ fontSize: '0.85rem', color: 'var(--aq-text)' }}>{f}</span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <div style={{ padding: '28px 36px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid var(--aq-border)' }}>
                <Link href="/connect-alpaca" className="btn btn-primary" style={{ fontSize: '1rem', padding: '14px 28px' }}>
                  Aktiver live trading
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </Link>
                <Link href="/dashboard" className="btn btn-ghost">Prøv demo modus</Link>
                <span style={{ fontFamily: 'var(--font-jetbrains)', fontSize: '0.68rem', color: 'var(--aq-muted)', marginLeft: 'auto' }}>
                  Avbryt når som helst · MVA inkl. · Norsk support
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ── FINAL CTA ─────────────────────────────────── */}
        <section style={{ padding: '80px 24px 140px', textAlign: 'center', borderTop: '1px solid var(--aq-border)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 60% at 50% 100%, rgba(0,245,255,0.06), transparent)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative', maxWidth: 640, margin: '0 auto' }}>
            <h2 style={{ fontSize: 'clamp(2.2rem,5vw,3.8rem)', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.02em', marginBottom: 32 }}>
              The market doesn't sleep.<br/>
              <span className="gradient-text">Neither should your edge.</span>
            </h2>
            <Link href="/connect-alpaca" className="btn btn-primary" style={{ fontSize: '1.05rem', padding: '15px 32px' }}>
              Kom i gang nå
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </Link>
          </div>
        </section>

        {/* ── FOOTER ───────────────────────────────────── */}
        <footer style={{ borderTop: '1px solid var(--aq-border)', padding: '48px 24px 24px' }}>
          <div style={{ maxWidth: 1280, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 48, flexWrap: 'wrap', gap: 32 }}>
              <div style={{ maxWidth: 280 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <AQLogo size={24} />
                  <span style={{ fontWeight: 700, fontSize: '0.88rem', letterSpacing: '0.06em' }}>APEX <em style={{ fontStyle: 'normal', color: 'var(--aq-cyan)' }}>QUANTUM</em></span>
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--aq-muted)', lineHeight: 1.6 }}>
                  Autonomous trading intelligence.<br/>Oslo · London · Zürich.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 48, flexWrap: 'wrap' }}>
                {[
                  { head: 'PRODUCT', links: [['#intelligence','Intelligence'],['#modules','Modules'],['#performance','Performance'],['/dashboard','Dashboard']] },
                  { head: 'COMPANY', links: [['#','Om oss'],['#','Presse'],['#','Karriere'],['#','Kontakt']] },
                  { head: 'LEGAL',   links: [['#','Vilkår'],['#','Personvern'],['#','Risiko'],['#','MiFID II']] },
                ].map(col => (
                  <div key={col.head}>
                    <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: '0.62rem', letterSpacing: '0.1em', color: 'var(--aq-muted)', marginBottom: 14, textTransform: 'uppercase' }}>{col.head}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {col.links.map(([href, label]) => (
                        <a key={label} href={href} style={{ fontSize: '0.85rem', color: 'var(--aq-muted)', textDecoration: 'none', transition: 'color 0.15s' }}
                          onMouseEnter={e => (e.currentTarget.style.color = 'var(--aq-text)')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'var(--aq-muted)')}>
                          {label}
                        </a>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 20, borderTop: '1px solid var(--aq-border)', fontFamily: 'var(--font-jetbrains)', fontSize: '0.65rem', color: 'var(--aq-muted)', flexWrap: 'wrap', gap: 8 }}>
              <span>© 2026 APEX QUANTUM AS · ORG 934 218 441</span>
              <span>v6.2 · BUILD 20260427.01</span>
            </div>
          </div>
        </footer>

      </div>

      {/* Responsive grid overrides */}
      <style>{`
        @media (max-width: 900px) {
          .hero-grid, .intel-grid, .perf-grid, .sec-grid, .core-grid { grid-template-columns: 1fr !important; }
          .voice-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 640px) {
          .perf-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  );
}

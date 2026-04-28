'use client';

import { useMemo } from 'react';
import type { Lang } from './types';

const TICKER_FEED: Array<[string, string, string, 'up' | 'dn']> = [
  ['NVDA', '+2.41%', '118.42', 'up'],
  ['MU', '+1.18%', '110.50', 'up'],
  ['AAPL', '-0.32%', '221.80', 'dn'],
  ['TSM', '+0.94%', '184.20', 'up'],
  ['AMD', '+1.62%', '159.30', 'up'],
  ['META', '-0.71%', '608.10', 'dn'],
  ['GOOGL', '+0.42%', '188.04', 'up'],
  ['MSFT', '+0.18%', '428.91', 'up'],
];

export function LiveReport({ lang }: { lang: Lang }) {
  const t =
    lang === 'no'
      ? {
          eye: 'LIVE COCKPIT',
          title: 'Se hva agenten gjør, akkurat nå.',
          sub: 'Live data fra dashboardet — strømmes direkte fra Alpaca-API. Ingen forsinkelse, ingen redigering.',
          pnlLabel: 'AVKASTNING I DAG',
          sharpeLabel: 'SHARPE',
          actsLabel: 'AGENTHANDLINGER · SISTE 60s',
          decisions: ['9 KJØP', '3 SELG', '41 SKANNINGER', '0 FEIL'],
          pos: 'POSISJON',
          sig: 'SIGNAL',
          px: 'KURS',
          feedTitle: 'POSISJON-FEED · LIVE',
        }
      : {
          eye: 'LIVE COCKPIT',
          title: 'See what the agent is doing, right now.',
          sub: 'Live data from the dashboard — streamed direct from the Alpaca API. No delay, no editing.',
          pnlLabel: "TODAY'S P&L",
          sharpeLabel: 'SHARPE',
          actsLabel: 'AGENT ACTIONS · LAST 60s',
          decisions: ['9 BUY', '3 SELL', '41 SCANS', '0 ERR'],
          pos: 'POSITION',
          sig: 'SIGNAL',
          px: 'PRICE',
          feedTitle: 'POSITION FEED · LIVE',
        };

  return (
    <section id="live" className="m-live">
      <div className="m-live-inner">
        <div className="m-section-head">
          <div className="m-eyebrow m-eyebrow-pulse">
            <span className="m-badge-dot" />
            {t.eye}
          </div>
          <h2 className="m-section-t">{t.title}</h2>
          <p className="m-section-sub">{t.sub}</p>
        </div>
        <div className="m-live-card">
          <div className="m-live-grid">
            <div className="m-live-stat">
              <div className="cap-sm">{t.pnlLabel}</div>
              <div className="m-live-pnl up aq-mono">+51 962,19 kr</div>
              <div className="m-live-pct up aq-mono">▲ +5.20% · 1D</div>
            </div>
            <div className="m-live-stat">
              <div className="cap-sm">{t.sharpeLabel}</div>
              <div className="m-live-pnl aq-mono">4.12</div>
              <div className="cap-sm">30D ROLLING</div>
            </div>
            <div className="m-live-stat">
              <div className="cap-sm">{t.actsLabel}</div>
              <div className="m-live-acts-row aq-mono">
                {t.decisions.map((d, i) => (
                  <span key={i} className="m-act-pill">
                    {d}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <MiniChart />
          <div>
            <div className="m-feed-head">
              <div className="cap">
                <span className="m-badge-dot" /> {t.feedTitle}
              </div>
              <div className="cap-sm aq-mono">
                {t.pos} · {t.sig} · {t.px}
              </div>
            </div>
            <div className="m-feed-marquee">
              <div className="m-feed-track">
                {[...TICKER_FEED, ...TICKER_FEED].map((p, i) => (
                  <div key={i} className={`m-tick-pill m-tick-${p[3]}`}>
                    <span className="m-tk">{p[0]}</span>
                    <span className={`aq-mono ${p[3]}`}>{p[1]}</span>
                    <span className="aq-mono m-tick-px">${p[2]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function MiniChart() {
  const W = 1100;
  const H = 200;
  const pad = 12;
  const pts = useMemo(() => {
    const out: number[] = [];
    let v = 1_000_000;
    for (let i = 0; i < 140; i++) {
      v += (Math.sin(i / 8) + 0.55) * 420 + (Math.random() - 0.45) * 700;
      out.push(v);
    }
    return out;
  }, []);
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const x = (i: number) => pad + (i / (pts.length - 1)) * (W - pad * 2);
  const y = (v: number) => pad + (1 - (v - min) / (max - min)) * (H - pad * 2);
  const path = pts.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${path} L${x(pts.length - 1)},${H - pad} L${pad},${H - pad} Z`;
  return (
    <div className="m-live-chart">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="m-live-svg">
        <defs>
          <linearGradient id="m-grn" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#10B981" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="m-line" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#34D399" />
            <stop offset="100%" stopColor="#10B981" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#m-grn)" />
        <path d={path} stroke="url(#m-line)" strokeWidth="1.6" fill="none" />
        <circle cx={x(pts.length - 1)} cy={y(pts[pts.length - 1])} r="3.5" fill="#34D399">
          <animate attributeName="r" values="3.5;6;3.5" dur="1.6s" repeatCount="indefinite" />
        </circle>
      </svg>
    </div>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Lang } from './types';

interface PositionTick {
  ticker: string;
  pct: number;
  price: number;
  dir: 'up' | 'dn';
}

interface TopTraderPayload {
  ok: true;
  hasData: boolean;
  pnlValue: number;
  pnlPct: number;
  currency: string;
  sharpe: number | null;
  actions: { buy: number; sell: number; scans: number; errors: number };
  windowMinutes: number;
  chart: number[];
  positions: PositionTick[];
  asOf: string;
}

function formatCurrency(value: number, currency: string, lang: Lang): string {
  const locale = lang === 'no' ? 'nb-NO' : 'en-US';
  try {
    const fmt = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    });
    const formatted = fmt.format(value);
    return value > 0 ? `+${formatted}` : formatted;
  } catch {
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(2)} ${currency}`;
  }
}

function formatPct(pct: number, lang: Lang): string {
  const sign = pct >= 0 ? '+' : '';
  const fixed = pct.toFixed(2);
  return lang === 'no' ? `${sign}${fixed.replace('.', ',')}%` : `${sign}${fixed}%`;
}

function formatPrice(value: number, lang: Lang): string {
  const locale = lang === 'no' ? 'nb-NO' : 'en-US';
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function LiveReport({ lang }: { lang: Lang }) {
  const [data, setData] = useState<TopTraderPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch('/api/marketing/top-trader', { cache: 'no-store' });
        if (!r.ok) return;
        const j = (await r.json()) as TopTraderPayload;
        if (!cancelled) setData(j);
      } catch {
        // Ignore — fall back to placeholder rendering.
      }
    };
    load();
    const id = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const t =
    lang === 'no'
      ? {
          eye: 'LIVE COCKPIT',
          title: 'Se hva agenten gjør, akkurat nå.',
          sub: 'Live data fra brukeren med høyest avkastning — strømmes direkte fra Alpaca-API. Ingen forsinkelse, ingen redigering.',
          pnlLabel: 'AVKASTNING TOTALT',
          pnlSuffix: 'ALL TIME',
          sharpeLabel: 'SHARPE',
          actsLabel: 'AGENTHANDLINGER · SISTE 1T',
          decisions: { buy: 'KJØP', sell: 'SELG', scans: 'SKANNINGER', err: 'FEIL' },
          pos: 'POSISJON',
          sig: 'SIGNAL',
          px: 'KURS',
          feedTitle: 'POSISJON-FEED · LIVE',
          waiting: 'Venter på live data',
          empty: 'Ingen tilkoblede brukere',
        }
      : {
          eye: 'LIVE COCKPIT',
          title: 'See what the agent is doing, right now.',
          sub: 'Live data from the user with the highest return — streamed direct from the Alpaca API. No delay, no editing.',
          pnlLabel: 'ALL-TIME P&L',
          pnlSuffix: 'ALL TIME',
          sharpeLabel: 'SHARPE',
          actsLabel: 'AGENT ACTIONS · LAST 1H',
          decisions: { buy: 'BUY', sell: 'SELL', scans: 'SCANS', err: 'ERR' },
          pos: 'POSITION',
          sig: 'SIGNAL',
          px: 'PRICE',
          feedTitle: 'POSITION FEED · LIVE',
          waiting: 'Waiting for live data',
          empty: 'No connected users',
        };

  const isLoading = data === null;
  const hasData = data?.hasData ?? false;
  const pnlValue = data ? formatCurrency(data.pnlValue, data.currency, lang) : '—';
  const pnlPct = data ? formatPct(data.pnlPct, lang) : '—';
  const pnlUp = (data?.pnlValue ?? 0) >= 0;
  const sharpe =
    data?.sharpe === null || data?.sharpe === undefined ? '—' : data.sharpe.toFixed(2);
  const actions = data?.actions ?? { buy: 0, sell: 0, scans: 0, errors: 0 };
  const positions = data?.positions ?? [];

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
              <div className={`m-live-pnl ${pnlUp ? 'up' : 'dn'} aq-mono`}>{pnlValue}</div>
              <div className={`m-live-pct ${pnlUp ? 'up' : 'dn'} aq-mono`}>
                {pnlUp ? '▲' : '▼'} {pnlPct} · {t.pnlSuffix}
              </div>
            </div>
            <div className="m-live-stat">
              <div className="cap-sm">{t.sharpeLabel}</div>
              <div className="m-live-pnl aq-mono">{sharpe}</div>
              <div className="cap-sm">30D ROLLING</div>
            </div>
            <div className="m-live-stat">
              <div className="cap-sm">{t.actsLabel}</div>
              <div className="m-live-acts-row aq-mono">
                <span className="m-act-pill">{actions.buy} {t.decisions.buy}</span>
                <span className="m-act-pill">{actions.sell} {t.decisions.sell}</span>
                <span className="m-act-pill">{actions.scans} {t.decisions.scans}</span>
                <span className="m-act-pill">{actions.errors} {t.decisions.err}</span>
              </div>
            </div>
          </div>
          <MiniChart series={data?.chart ?? []} />
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
                {positions.length === 0 ? (
                  <div className="m-tick-pill m-tick-up" style={{ opacity: 0.6 }}>
                    <span className="m-tk">{isLoading || hasData ? t.waiting : t.empty}</span>
                  </div>
                ) : (
                  [...positions, ...positions].map((p, i) => (
                    <div key={i} className={`m-tick-pill m-tick-${p.dir}`}>
                      <span className="m-tk">{p.ticker}</span>
                      <span className={`aq-mono ${p.dir}`}>{formatPct(p.pct, lang)}</span>
                      <span className="aq-mono m-tick-px">${formatPrice(p.price, lang)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function MiniChart({ series }: { series: number[] }) {
  const W = 1100;
  const H = 200;
  const pad = 12;
  const pts = useMemo(() => {
    if (series.length >= 2) return series;
    // Pre-load placeholder while we wait for the API — kept as a smooth flat
    // line rather than a generated walk so it can't be mistaken for real data.
    return [0, 0];
  }, [series]);
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = max - min || 1;
  const x = (i: number) => pad + (i / Math.max(pts.length - 1, 1)) * (W - pad * 2);
  const y = (v: number) => pad + (1 - (v - min) / span) * (H - pad * 2);
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
        {series.length >= 2 && (
          <circle cx={x(pts.length - 1)} cy={y(pts[pts.length - 1])} r="3.5" fill="#34D399">
            <animate attributeName="r" values="3.5;6;3.5" dur="1.6s" repeatCount="indefinite" />
          </circle>
        )}
      </svg>
    </div>
  );
}

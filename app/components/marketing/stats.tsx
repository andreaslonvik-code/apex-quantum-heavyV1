'use client';

import type { Lang } from './types';

const STATS = {
  no: [
    ['+187,4%', 'Avkastning siden lansering', 'YTD'],
    ['4,12', 'Sharpe Ratio', '30D rolling'],
    ['73,4%', 'Win rate', 'siste 1 240 trades'],
    ['9,2M', 'Signaler skannet', 'per sekund · 24/7'],
  ],
  en: [
    ['+187.4%', 'Returns since launch', 'YTD'],
    ['4.12', 'Sharpe Ratio', '30D rolling'],
    ['73.4%', 'Win rate', 'last 1,240 trades'],
    ['9.2M', 'Signals scanned', 'per second · 24/7'],
  ],
} as const;

export function Stats({ lang }: { lang: Lang }) {
  return (
    <section className="m-stats">
      <div className="m-stats-inner">
        {STATS[lang].map(([n, l, s], i) => (
          <div key={i} className="m-stat">
            <div className="m-stat-num aq-mono">{n}</div>
            <div className="m-stat-l">{l}</div>
            <div className="m-stat-s aq-mono">{s}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

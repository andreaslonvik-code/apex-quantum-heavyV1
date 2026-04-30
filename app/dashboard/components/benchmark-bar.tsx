'use client';

import type { Lang } from './i18n';

export interface BenchmarkBarPayload {
  apexPct: number;
  spyPct: number | null;
  qqqPct: number | null;
}

interface Props {
  lang: Lang;
  data: BenchmarkBarPayload | null;
}

interface Card {
  label: string;
  symbol: string;
  pct: number | null;
}

function rankClass(card: Card, ranked: Card[]): string {
  // Cards sorted by pct desc with nulls at bottom.
  const valid = ranked.filter((c) => c.pct !== null);
  if (valid.length === 0 || card.pct === null) return 'bench-card-mute';
  const idx = valid.findIndex((c) => c.symbol === card.symbol);
  if (idx === 0) return 'bench-card-best';
  if (idx === valid.length - 1) return 'bench-card-worst';
  return 'bench-card-mid';
}

function fmtPct(pct: number | null): string {
  if (pct === null || !Number.isFinite(pct)) return '—';
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}

export function BenchmarkBar({ lang, data }: Props) {
  const cards: Card[] = [
    { label: 'APEX QUANTUM', symbol: 'APEX', pct: data?.apexPct ?? null },
    { label: 'S&P 500', symbol: 'SPY', pct: data?.spyPct ?? null },
    { label: 'NASDAQ 100', symbol: 'QQQ', pct: data?.qqqPct ?? null },
  ];

  // Rank by pct (highest first, nulls last) — drives green/red coloring.
  const ranked = [...cards].sort((a, b) => {
    if (a.pct === null && b.pct === null) return 0;
    if (a.pct === null) return 1;
    if (b.pct === null) return -1;
    return b.pct - a.pct;
  });

  const hasData = cards.some((c) => c.pct !== null);
  const apexBeating =
    data?.apexPct !== undefined &&
    data?.spyPct !== null &&
    data?.qqqPct !== null &&
    data.apexPct > (data.spyPct ?? -Infinity) &&
    data.apexPct > (data.qqqPct ?? -Infinity);

  return (
    <div className="bench-bar">
      {cards.map((c) => {
        const cls = rankClass(c, ranked);
        const isApex = c.symbol === 'APEX';
        return (
          <div key={c.symbol} className={`bench-card ${cls} ${isApex ? 'bench-card-apex' : ''}`}>
            <div className="bench-label">{c.label}</div>
            <div className="bench-pct">{fmtPct(c.pct)}</div>
            {isApex && hasData && apexBeating && (
              <div className="bench-tag">
                {lang === 'no' ? 'LEDER MARKEDET' : 'LEADING MARKET'}
              </div>
            )}
            {isApex && hasData && !apexBeating && data?.apexPct !== undefined && (
              <div className="bench-tag bench-tag-mute">
                {lang === 'no' ? 'Sesjon i dag' : 'Today’s session'}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

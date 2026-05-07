'use client';

import { I18N, type Lang } from './i18n';

interface Props {
  lang: Lang;
  cashPct: number;        // 0..100
  investedPct: number;    // 0..100
  positionCount: number;
  largestTicker: string | null;
  largestPct: number;     // 0..100
}

export function ExposureCard({ lang, cashPct, investedPct, positionCount, largestTicker, largestPct }: Props) {
  const t = I18N[lang];
  const fill = Math.max(0, Math.min(100, investedPct));
  return (
    <div className="panel">
      <div className="exposure-head">
        <div className="exposure-title">{t.exposureTitle}</div>
        <div className="exposure-count">
          {positionCount} {positionCount === 1 ? t.posSingular : t.posPlural}
        </div>
      </div>
      <div className="exposure-bar" aria-hidden="true">
        <div className="exposure-bar-fill" style={{ width: `${fill}%` }} />
      </div>
      <div className="exposure-legend">
        <span className="invested">{t.invested} {Math.round(investedPct)}%</span>
        <span className="cash">{t.cash} {Math.round(cashPct)}%</span>
      </div>
      <div className="exposure-largest">
        <span className="exposure-largest-label">{t.largestPosition}</span>
        <span className="exposure-largest-val">
          {largestTicker ? `${largestTicker} · ${largestPct.toFixed(1)}%` : '—'}
        </span>
      </div>
    </div>
  );
}

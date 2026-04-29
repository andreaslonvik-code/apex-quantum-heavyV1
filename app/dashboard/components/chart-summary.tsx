'use client';

import { I18N, fmtMoney, moneySuffix, type Lang } from './i18n';

interface Props {
  lang: Lang;
  /** Current portfolio value. */
  current: number;
  /** Distance from session peak in absolute and pct terms (both positive). */
  drawdownAbs: number;
  drawdownPct: number;
  /** Performance vs S&P 500 in pct, e.g. +0.41 (positive = outperforming). */
  vsBenchPct: number | null;
}

export function ChartSummary({ lang, current, drawdownAbs, drawdownPct, vsBenchPct }: Props) {
  const t = I18N[lang];
  return (
    <div className="chart-summary">
      <div className="chart-summary-cell">
        <div className="chart-summary-label">{t.chartNow}</div>
        <div className="chart-summary-value">{fmtMoney(current, lang)}</div>
        <div className="chart-summary-sub">{moneySuffix(lang)}</div>
      </div>
      <div className="chart-summary-cell">
        <div className="chart-summary-label">{t.chartFromPeak}</div>
        <div className="chart-summary-value dn">−{fmtMoney(drawdownAbs, lang)}</div>
        <div className="chart-summary-sub dn">−{drawdownPct.toFixed(2)}%</div>
      </div>
      <div className="chart-summary-cell">
        <div className="chart-summary-label">{t.chartVsBench}</div>
        {vsBenchPct === null ? (
          <>
            <div className="chart-summary-value mute">—</div>
            <div className="chart-summary-sub">—</div>
          </>
        ) : (
          <>
            <div className={`chart-summary-value ${vsBenchPct >= 0 ? 'up' : 'dn'}`}>
              {vsBenchPct >= 0 ? '+' : ''}{vsBenchPct.toFixed(2)}%
            </div>
            <div className="chart-summary-sub">{lang === 'no' ? 'mot S&P 500' : 'vs S&P 500'}</div>
          </>
        )}
      </div>
    </div>
  );
}

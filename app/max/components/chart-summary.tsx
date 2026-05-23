'use client';

import { I18N, formatMoney, currencyLabel, type Currency, type Lang } from './i18n';

interface Props {
  lang: Lang;
  /** Current portfolio value in USD (Alpaca-native). */
  current: number;
  /** Distance from session peak (positive) in USD. */
  drawdownAbs: number;
  drawdownPct: number;
  /** Performance vs S&P 500 in pct, e.g. +0.41 (positive = outperforming). */
  vsBenchPct: number | null;
  displayCurrency: Currency;
  fxRate: number | null;
}

export function ChartSummary({ lang, current, drawdownAbs, drawdownPct, vsBenchPct, displayCurrency, fxRate }: Props) {
  const t = I18N[lang];
  // omitSuffix → the unit goes in `chart-summary-sub` so it never duplicates
  // inline with the value above. NÅ shows unit; NED FRA TOPP shows pct.
  const currentStr = formatMoney(current, displayCurrency, fxRate, { decimals: 0, omitSuffix: true });
  const ddStr = formatMoney(-drawdownAbs, displayCurrency, fxRate, { decimals: 0, omitSuffix: true });
  const unitLabel = currencyLabel(displayCurrency);
  return (
    <div className="chart-summary">
      <div className="chart-summary-cell">
        <div className="chart-summary-label">{t.chartNow}</div>
        <div className="chart-summary-value">{currentStr}</div>
        <div className="chart-summary-sub">{unitLabel}</div>
      </div>
      <div className="chart-summary-cell">
        <div className="chart-summary-label">{t.chartFromPeak}</div>
        <div className="chart-summary-value dn">{ddStr}</div>
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

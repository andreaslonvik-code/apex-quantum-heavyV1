'use client';

import { I18N, formatMoney, currencyLabel, type Currency, type Lang } from './i18n';

export type Timeframe = '1H' | '24H' | '7D' | '30D' | 'MTD' | 'YTD' | 'ALL';

// 7D er midlertidig skjult fra UI: paper Alpaca's portfolio_history kan
// inneholde phantom-inflated equity-samples under store rebalanseringer
// som ga falsk "topp"-verdi på charten. 7D-typen og API-entry-en beholdes
// så ingen consumer brekker, men knappen vises ikke før vi har en pålitelig
// fix.
const TF_KEYS: Timeframe[] = ['1H', '24H', '30D', 'MTD', 'YTD', 'ALL'];

interface Props {
  lang: Lang;
  tf: Timeframe;
  onTf: (tf: Timeframe) => void;
  /** P&L in USD (Alpaca-native). Rendered in displayCurrency. */
  profit: number;
  profitPct: number;
  mode: 'sim' | 'live';
  displayCurrency: Currency;
  fxRate: number | null;
}

export function PortfolioHeader({ lang, tf, onTf, profit, profitPct, mode, displayCurrency, fxRate }: Props) {
  const t = I18N[lang];
  // Split number body and unit so the existing CSS treatment for
  // .ph-num (big Fraunces) and .ph-suffix (small mono) keeps working.
  // omitSuffix tells formatMoney to drop "kr" / "$" so we can render the
  // unit in a separate styled span.
  const numBody = formatMoney(profit, displayCurrency, fxRate, { decimals: 2, signed: true, omitSuffix: true });
  const suffix = currencyLabel(displayCurrency);
  return (
    <>
      <div className="ph">
        <div className="ph-l">
          <div className="cap">{t.eyebrowByTf[tf] ?? t.eyebrow}</div>
          <div className="ph-row">
            <h1 className={`ph-num ${profit >= 0 ? 'up' : 'dn'}`}>{numBody}</h1>
            <span className="ph-suffix">{suffix}</span>
            <span className={`ph-pct ${profit >= 0 ? 'up' : 'dn'}`}>
              {profitPct >= 0 ? '+' : ''}{profitPct.toFixed(2)}%
            </span>
            <span className="tag tag-live">
              <span className="dot" />
              {t.liveTag}
            </span>
          </div>
          <div className="ph-sub">{mode === 'live' ? t.liveCaveat : t.simCaveat}</div>
        </div>
        <div className="ph-tfwrap-inline">
          <div className="tfgrp">
            {TF_KEYS.map((k) => (
              <button key={k} className={`tf ${tf === k ? 'is-active' : ''}`} onClick={() => onTf(k)}>
                {t.timeframes[k]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

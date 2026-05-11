'use client';

import { I18N, fmtMoney, moneySuffix, type Lang } from './i18n';

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
  profit: number;
  profitPct: number;
  mode: 'sim' | 'live';
  currency: string | null;
}

export function PortfolioHeader({ lang, tf, onTf, profit, profitPct, mode, currency }: Props) {
  const t = I18N[lang];
  return (
    <>
      <div className="ph">
        <div className="ph-l">
          <div className="cap">{t.eyebrowByTf[tf] ?? t.eyebrow}</div>
          <div className="ph-row">
            <h1 className={`ph-num ${profit >= 0 ? 'up' : 'dn'}`}>
              {profit >= 0 ? '+' : '−'}
              {fmtMoney(Math.abs(profit), lang)}
            </h1>
            <span className="ph-suffix">{moneySuffix(lang, currency)}</span>
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

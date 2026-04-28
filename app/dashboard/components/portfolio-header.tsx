'use client';

import { I18N, fmtMoney, moneySuffix, type Lang } from './i18n';

export type Timeframe = '1H' | '24H' | '7D' | '30D' | 'MTD' | 'YTD' | 'ALL';

const TF_KEYS: Timeframe[] = ['1H', '24H', '7D', '30D', 'MTD', 'YTD', 'ALL'];

interface Props {
  lang: Lang;
  tf: Timeframe;
  onTf: (tf: Timeframe) => void;
  profit: number;
  profitPct: number;
  profitable: boolean;
  onWithdraw: () => void;
  lastUpdate: string;
}

export function PortfolioHeader({ lang, tf, onTf, profit, profitPct, profitable, onWithdraw, lastUpdate }: Props) {
  const t = I18N[lang];
  return (
    <>
      <div className="ph">
        <div className="ph-l">
          <div className="cap">📊 {t.eyebrow}</div>
          <div className="ph-row">
            <h1 className={`ph-num ${profit >= 0 ? 'up' : 'dn'}`}>
              {profit >= 0 ? '+' : '−'}
              {fmtMoney(Math.abs(profit), lang)} {moneySuffix(lang)}
            </h1>
            <span className={`ph-pct ${profit >= 0 ? 'up' : 'dn'}`}>
              ({profitPct >= 0 ? '+' : ''}{profitPct.toFixed(2)}%)
            </span>
            <span className="tag tag-live">
              <span className="dot" />
              {t.liveTag}
            </span>
          </div>
          <div className="ph-sub">
            {t.lastUpdate} <span className="aq-mono cy">{lastUpdate || '—'}</span> · {t.nextScan}{' '}
            <span className="aq-mono">2.0s</span>
          </div>
        </div>
        <div className="ph-controls">
          <button
            className={`withdraw-btn ${profitable ? '' : 'is-disabled'}`}
            onClick={onWithdraw}
            disabled={!profitable}
          >
            <span className="withdraw-glow" />
            <span className="withdraw-icon">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v12" />
                <path d="M7 10l5 5 5-5" />
                <path d="M5 21h14" />
              </svg>
            </span>
            <span className="withdraw-text">
              <span className="withdraw-l1">{t.withdraw}</span>
              <span className="withdraw-l2">{t.withdrawSub}</span>
            </span>
          </button>
        </div>
      </div>
      <div className="ph-tfwrap">
        <div className="tfgrp">
          {TF_KEYS.map((k) => (
            <button key={k} className={`tf ${tf === k ? 'is-active' : ''}`} onClick={() => onTf(k)}>
              {t.timeframes[k]}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

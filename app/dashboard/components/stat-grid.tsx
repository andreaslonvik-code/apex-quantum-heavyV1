'use client';

import { I18N, fmtMoney, moneySuffix, type Lang } from './i18n';

interface Props {
  lang: Lang;
  startVal: number;
  currentVal: number;
  peakVal: number;
  drawdownPct: number;
  drawdownAbs: number;
  depositLabel?: string;
  peakLabel?: string;
}

export function StatGrid({ lang, startVal, currentVal, peakVal, drawdownPct, drawdownAbs, depositLabel, peakLabel }: Props) {
  const t = I18N[lang];
  const profit = currentVal - startVal;
  return (
    <div className="stat-grid">
      <div className="stat">
        <div className="cap">{t.startVal}</div>
        <div className="stat-num aq-mono">
          {fmtMoney(startVal, lang)} <span className="cur">{moneySuffix(lang)}</span>
        </div>
        <div className="stat-sub">{depositLabel ? `${t.deposit} ${depositLabel}` : t.deposit}</div>
      </div>
      <div className="stat">
        <div className="cap">{t.nowVal}</div>
        <div className="stat-num aq-mono">
          {fmtMoney(currentVal, lang)} <span className="cur">{moneySuffix(lang)}</span>
        </div>
        <div className={`stat-sub ${profit >= 0 ? 'up' : 'dn'}`}>
          {profit >= 0 ? '+' : '−'}
          {fmtMoney(Math.abs(profit), lang)} {moneySuffix(lang)}
        </div>
      </div>
      <div className="stat">
        <div className="cap">{t.peak}</div>
        <div className="stat-num aq-mono gold-text">
          {fmtMoney(peakVal, lang)} <span className="cur">{moneySuffix(lang)}</span>
        </div>
        <div className="stat-sub">{peakLabel || '—'}</div>
      </div>
      <div className="stat">
        <div className="cap">{t.drawdown}</div>
        <div className="stat-num aq-mono dn">{drawdownPct.toFixed(2)}%</div>
        <div className="stat-sub dn">
          −{fmtMoney(Math.abs(drawdownAbs), lang)} {moneySuffix(lang)} · {t.withinRisk}
        </div>
      </div>
    </div>
  );
}

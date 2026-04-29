'use client';

import { I18N, type Lang } from './i18n';

interface Props {
  lang: Lang;
  positionsOpen: number;
  /** Average hold time in minutes (null when unknown / thin data). */
  avgHoldMinutes: number | null;
  hitRatePct: number | null;
  totalTrades: number;
  /** Max session drawdown as a NEGATIVE percent number (e.g. -0.05). */
  maxLossPct: number;
  /** Sharpe over the displayed window. Null hides the value. */
  sharpe: number | null;
  /** Whether the user is in SIM mode (drives the (SIM) tag on metrics). */
  sim: boolean;
  /** True when sample size is too small for the metric to be reliable. */
  thinData: boolean;
}

function fmtHold(minutes: number | null, lang: Lang): string {
  if (minutes === null) return '—';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (lang === 'no') return h > 0 ? `${h}t ${m}m` : `${m}m`;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function BottomStats({ lang, positionsOpen, avgHoldMinutes, hitRatePct, totalTrades, maxLossPct, sharpe, sim, thinData }: Props) {
  const t = I18N[lang];
  const simTag = <span className="bstat-tag">{t.sim}</span>;
  return (
    <div className="bstats">
      <div className="bstat">
        <div className="bstat-label">
          <span>{t.statPosOpen}</span>
        </div>
        <div className="bstat-val">{positionsOpen}</div>
        <div className="bstat-sub">
          {t.statHoldTime} {fmtHold(avgHoldMinutes, lang)}
        </div>
      </div>
      <div className="bstat">
        <div className="bstat-label">
          <span>{t.statHitRate}</span>
          {sim && simTag}
        </div>
        <div className="bstat-val">{hitRatePct === null ? '—' : `${hitRatePct.toFixed(1)}%`}</div>
        <div className="bstat-sub">
          {t.statHitRateOf} {totalTrades} {t.statHitRateOfTrades}
        </div>
      </div>
      <div className="bstat">
        <div className="bstat-label">
          <span>{t.statMaxLoss}</span>
        </div>
        <div className="bstat-val dn">{maxLossPct.toFixed(2)}%</div>
        <div className="bstat-sub">{t.statWithinTarget}</div>
      </div>
      <div className="bstat">
        <div className="bstat-label">
          <span>{t.statSharpe}</span>
          {sim && simTag}
        </div>
        <div className="bstat-val">
          {sharpe === null ? '—' : sharpe.toFixed(2)}
          {sharpe !== null && <span className="bstat-tag" style={{ marginLeft: 8 }}>{t.statSharpeWindow}</span>}
        </div>
        <div className="bstat-sub">{thinData ? t.statThinData : t.statSharpeWindow}</div>
      </div>
    </div>
  );
}

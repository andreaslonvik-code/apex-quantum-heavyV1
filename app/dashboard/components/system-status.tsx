'use client';

import { I18N, type Lang } from './i18n';

interface Props {
  lang: Lang;
  scanCount: number;
  uptimePct?: number;
  sharpe?: number;
  winRatePct?: number;
  lastDecisionMs?: number;
}

export function SystemStatus({
  lang,
  scanCount,
  uptimePct = 99.997,
  sharpe = 4.12,
  winRatePct = 73.4,
  lastDecisionMs = 240,
}: Props) {
  const t = I18N[lang];
  return (
    <div className="panel sys">
      <div className="panel-head">
        <div className="cap">⚙️ {t.sysTitle}</div>
        <span className="tag tag-live">
          <span className="dot" />
          {t.botRunning}
        </span>
      </div>
      <div className="agent-row">
        <div className="orb">
          <div className="orb-ring2" />
          <div className="orb-ring" />
          <div className="orb-core" />
        </div>
        <div>
          <div className="agent-t1">{t.agentLabel}</div>
          <div className="agent-t2">
            Grok-4-Heavy · {t.scanning} <span className="cy aq-mono">9.2M {t.signalsPerSec}</span>
          </div>
          <div className="agent-t3">
            {t.lastDecision} <span className="aq-mono">{lastDecisionMs}ms</span> {t.ago}
          </div>
        </div>
      </div>
      <div className="kpi">
        <div>
          <div className="cap-sm">{t.scanNum}</div>
          <div className="kpi-num cy aq-mono">{scanCount.toLocaleString('en-US')}</div>
        </div>
        <div>
          <div className="cap-sm">{t.uptime}</div>
          <div className="kpi-num aq-mono">{uptimePct.toFixed(3)}%</div>
        </div>
        <div>
          <div className="cap-sm">{t.sharpe}</div>
          <div className="kpi-num aq-mono">{sharpe.toFixed(2)}</div>
        </div>
        <div>
          <div className="cap-sm">{t.winRate}</div>
          <div className="kpi-num up aq-mono">{winRatePct.toFixed(1)}%</div>
        </div>
      </div>
      <div>
        <div className="cap-sm">📊 {t.activeExch}</div>
        <div className="exch-row">
          {(['NASDAQ', 'NYSE', 'ARCA', 'AMEX'] as const).map((e) => (
            <span key={e} className="exch-tag">
              <span className="ed" />
              {e}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

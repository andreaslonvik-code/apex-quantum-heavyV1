'use client';

import { I18N, type Lang } from './i18n';

interface Props {
  lang: Lang;
  ticker: string;
  side: 'BUY' | 'SELL';
  message: string;
  onRetry: () => void;
  onDismiss: () => void;
}

export function FailedOrderAlert({ lang, ticker, side, message, onRetry, onDismiss }: Props) {
  const t = I18N[lang];
  const sideLabel = side === 'BUY' ? t.buy.toLowerCase() : t.sell.toLowerCase();
  return (
    <div className="fail-card">
      <span className="fail-icon">!</span>
      <div className="fail-body">
        <div className="fail-title">
          {t.failTitle} · {ticker} {sideLabel}
        </div>
        <div className="fail-desc">{message}</div>
        <div className="fail-actions">
          <button type="button" className="fail-btn-primary" onClick={onRetry}>
            {t.failRetry}
          </button>
          <button type="button" className="fail-btn-ghost" onClick={onDismiss}>
            {t.failDismiss}
          </button>
        </div>
      </div>
    </div>
  );
}

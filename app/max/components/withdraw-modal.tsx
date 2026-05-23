'use client';

import { I18N, formatMoney, type Currency, type Lang } from './i18n';

export type WithdrawStatus = 'idle' | 'pending' | 'done' | 'error';

interface Props {
  open: boolean;
  lang: Lang;
  /** Starting capital in USD (Alpaca-native). */
  startVal: number;
  /** Current portfolio total in USD. */
  currentVal: number;
  /** User's display preference — affects the headline number. */
  displayCurrency: Currency;
  fxRate: number | null;
  status: WithdrawStatus;
  errorMessage?: string;
  onConfirm: () => void;
  onClose: () => void;
}

export function WithdrawModal({
  open,
  lang,
  startVal,
  currentVal,
  displayCurrency,
  fxRate,
  status,
  errorMessage,
  onConfirm,
  onClose,
}: Props) {
  if (!open) return null;
  const t = I18N[lang];
  const profit = currentVal - startVal;
  const pct = startVal > 0 ? (profit / startVal) * 100 : 0;
  const profitable = profit > 0 && (status === 'idle' || status === 'pending');

  // Helper: when NOK is the display preference, show the NOK estimate
  // first and the USD amount in parentheses — Alpaca actually moves USD,
  // so the user must always see what hits the broker.
  const dual = (usdAmount: number): { primary: string; secondary: string | null } => {
    if (displayCurrency === 'NOK' && fxRate && Number.isFinite(fxRate)) {
      return {
        primary: formatMoney(usdAmount, 'NOK', fxRate, { decimals: 0 }),
        secondary: formatMoney(usdAmount, 'USD', null, { decimals: 0 }),
      };
    }
    return { primary: formatMoney(usdAmount, 'USD', null, { decimals: 0 }), secondary: null };
  };

  const profitPrimary = formatMoney(profit, displayCurrency, fxRate, { decimals: 0, signed: true });
  const profitUsdNote =
    displayCurrency === 'NOK' && fxRate
      ? ` (${formatMoney(profit, 'USD', null, { decimals: 0, signed: true })})`
      : '';

  return (
    <div className="wd-overlay" onClick={onClose}>
      <div className="wd-modal" onClick={(e) => e.stopPropagation()}>
        <div className="wd-glow" />
        <button className="wd-close" onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 6l12 12M18 6l-12 12" />
          </svg>
        </button>

        {status === 'done' ? (
          <div className="wd-done">
            <div className="wd-done-orb">
              <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 className="wd-t">{t.withdrawDone}</h2>
            <p className="wd-sub">
              {formatMoney(profit, displayCurrency, fxRate, { decimals: 0 })}
              {profitUsdNote && <span className="mute"> {profitUsdNote}</span>} {t.transferDone}
            </p>
            <button className="btn-primary-v8 btn-lg wd-ok" onClick={onClose}>OK</button>
          </div>
        ) : status === 'error' ? (
          <div className="wd-empty">
            <div className="wd-empty-glyph wd-empty-glyph-err">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="13" />
                <line x1="12" y1="16.5" x2="12" y2="16.501" />
              </svg>
            </div>
            <h2 className="wd-t">{errorMessage || 'Error'}</h2>
            <button className="btn-ghost-v8 btn-lg" onClick={onClose}>{t.withdrawCancel}</button>
          </div>
        ) : !profitable ? (
          <div className="wd-empty">
            <div className="wd-empty-glyph">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="20" x2="21" y2="20" />
                <line x1="6" y1="16" x2="6" y2="13" />
                <line x1="11" y1="16" x2="11" y2="9" />
                <line x1="16" y1="16" x2="16" y2="6" />
              </svg>
            </div>
            <h2 className="wd-t">{t.withdrawNothing}</h2>
            <p className="wd-sub">{t.emptySub}</p>
            <button className="btn-ghost-v8 btn-lg" onClick={onClose}>{t.withdrawCancel}</button>
          </div>
        ) : (
          <>
            <div className="cap wd-eye">{t.withdraw.toUpperCase()}</div>
            <h2 className="wd-t">{t.withdrawAmount}</h2>
            <div className="wd-amount aq-mono">{profitPrimary}</div>
            {profitUsdNote && (
              <div className="wd-sub mute" style={{ marginTop: -8, marginBottom: 6 }}>
                {lang === 'no' ? 'tilsvarer' : 'equals'}{profitUsdNote}
              </div>
            )}
            <div className="wd-pct aq-mono">▲ +{pct.toFixed(2)}% {t.abovePrincipal}</div>
            <p className="wd-desc">
              {t.withdrawDesc}{' '}
              <b>{formatMoney(startVal, displayCurrency, fxRate, { decimals: 0 })}</b>.
            </p>
            <div className="wd-rows">
              <Row label={t.startVal.toLowerCase()} {...dual(startVal)} />
              <Row label={t.nowVal.toLowerCase()} {...dual(currentVal)} />
              <Row label={t.payout} tone="up" {...dual(profit)} prefix="+" />
              <Row label={t.remaining} {...dual(startVal)} />
            </div>
            <div className="wd-cta">
              <button className="btn-ghost-v8 btn-lg" onClick={onClose} disabled={status === 'pending'}>
                {t.withdrawCancel}
              </button>
              <button className="btn-primary-v8 btn-lg" onClick={onConfirm} disabled={status === 'pending'}>
                {status === 'pending' ? '...' : t.withdrawConfirm}
                {status !== 'pending' && (
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                )}
              </button>
            </div>
            <p className="wd-fine">{t.fineprint}</p>
          </>
        )}
      </div>
    </div>
  );
}

function Row({
  label,
  primary,
  secondary,
  tone,
  prefix,
}: {
  label: string;
  primary: string;
  secondary: string | null;
  tone?: 'up';
  prefix?: string;
}) {
  return (
    <div className={`wd-row${tone === 'up' ? ' wd-row-out' : ''}`}>
      <span>{label}</span>
      <span className={`aq-mono${tone === 'up' ? ' up' : ''}`}>
        {prefix ?? ''}{primary}
        {secondary && <span className="mute" style={{ marginLeft: 6, fontSize: '0.85em' }}>({prefix ?? ''}{secondary})</span>}
      </span>
    </div>
  );
}

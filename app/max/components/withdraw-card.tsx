'use client';

import { I18N, formatMoney, type Currency, type Lang } from './i18n';

interface Props {
  lang: Lang;
  /** Starting capital in USD (Alpaca-native). */
  startVal: number;
  /** Current portfolio total in USD. */
  currentVal: number;
  displayCurrency: Currency;
  fxRate: number | null;
  onWithdraw: () => void;
}

export function WithdrawCard({ lang, startVal, currentVal, displayCurrency, fxRate, onWithdraw }: Props) {
  const t = I18N[lang];
  const profit = currentVal - startVal;
  const profitable = profit > 0;
  return (
    <div className="wd-card">
      <div className="wd-card-head">
        <div className="wd-card-title">{t.withdrawCardTitle}</div>
        <div className={`wd-card-avail ${profitable ? '' : 'mute'}`}>
          {profitable ? formatMoney(profit, displayCurrency, fxRate, { decimals: 0, signed: true }) : '—'}
          {profitable ? ` ${t.withdrawAvailable}` : ''}
        </div>
      </div>
      <p className="wd-card-desc">
        {t.withdrawCardDesc}{' '}
        <b>{formatMoney(startVal, displayCurrency, fxRate, { decimals: 0 })}</b>{' '}
        {t.withdrawCardDescTail}
      </p>
      <button
        type="button"
        className={`wd-card-btn ${profitable ? '' : 'is-disabled'}`}
        disabled={!profitable}
        onClick={onWithdraw}
      >
        {profitable
          ? `${t.withdrawCta} ${formatMoney(profit, displayCurrency, fxRate, { decimals: 0 })}`
          : t.withdrawNothing}
      </button>
    </div>
  );
}

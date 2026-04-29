'use client';

import { I18N, fmtMoney, moneySuffix, type Lang } from './i18n';

interface Props {
  lang: Lang;
  startVal: number;
  currentVal: number;
  currency: string | null;
  onWithdraw: () => void;
}

export function WithdrawCard({ lang, startVal, currentVal, currency, onWithdraw }: Props) {
  const t = I18N[lang];
  const profit = currentVal - startVal;
  const profitable = profit > 0;
  return (
    <div className="wd-card">
      <div className="wd-card-head">
        <div className="wd-card-title">{t.withdrawCardTitle}</div>
        <div className={`wd-card-avail ${profitable ? '' : 'mute'}`}>
          {profitable ? `+${fmtMoney(profit, lang)}` : '—'} {profitable ? t.withdrawAvailable : ''}
        </div>
      </div>
      <p className="wd-card-desc">
        {t.withdrawCardDesc} <b>{fmtMoney(startVal, lang)} {moneySuffix(lang, currency)}</b> {t.withdrawCardDescTail}
      </p>
      <button
        type="button"
        className={`wd-card-btn ${profitable ? '' : 'is-disabled'}`}
        disabled={!profitable}
        onClick={onWithdraw}
      >
        {profitable
          ? `${t.withdrawCta} ${fmtMoney(profit, lang)} ${moneySuffix(lang, currency)}`
          : t.withdrawNothing}
      </button>
    </div>
  );
}

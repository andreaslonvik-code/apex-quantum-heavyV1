'use client';

import { I18N, type Lang } from './i18n';

export function KillSwitch({ lang, onKill }: { lang: Lang; onKill: () => void }) {
  const t = I18N[lang];
  return (
    <button className="kill-btn" onClick={onKill}>
      <span className="kill-dot" />
      {t.killBtn}
    </button>
  );
}

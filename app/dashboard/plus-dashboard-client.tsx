'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SignOutButton, useUser } from '@clerk/nextjs';
import { PLUS_LANGS, PLUS_LANG_LABELS, type PlusLang } from '@/lib/i18n/plus-lang';
import { SignalsView } from './views/signals-view';
import { AskView } from './views/ask-view';
import { WatchlistView } from './views/watchlist-view';
import { ReportsView } from './views/reports-view';
import { LearnView } from './views/learn-view';
import { JournalView } from './views/journal-view';
import { OnboardingModal } from './views/onboarding-modal';

type ViewKey = 'signals' | 'ask' | 'watchlist' | 'reports' | 'learn' | 'journal';

interface NavItem {
  key: ViewKey;
  icon: string;
}

const NAV: ReadonlyArray<NavItem> = [
  { key: 'signals', icon: 'pulse' },
  { key: 'ask', icon: 'chat' },
  { key: 'watchlist', icon: 'list' },
  { key: 'reports', icon: 'doc' },
  { key: 'learn', icon: 'book' },
  { key: 'journal', icon: 'edit' },
];

const NAV_LABELS: Record<ViewKey, Record<PlusLang, string>> = {
  signals: { no: 'Signaler', en: 'Signals', de: 'Signale', es: 'Señales', zh: '信号' },
  ask: { no: 'Spør AI', en: 'Ask AI', de: 'KI fragen', es: 'Preguntar IA', zh: '问AI' },
  watchlist: { no: 'Watchlist', en: 'Watchlist', de: 'Watchlist', es: 'Lista', zh: '观察清单' },
  reports: { no: 'Rapporter', en: 'Reports', de: 'Berichte', es: 'Informes', zh: '报告' },
  learn: { no: 'Læring', en: 'Learn', de: 'Lernen', es: 'Aprender', zh: '学习' },
  journal: { no: 'Min journal', en: 'My journal', de: 'Mein Journal', es: 'Mi diario', zh: '日志' },
};

const COPY = {
  no: {
    productTag: 'APEX QUANTUM +',
    maxCardEye: 'ALLOWLIST',
    maxCardTitle: 'Apex Quantum Max',
    maxCardSub: 'Du har full tilgang som tidlig bruker.',
    maxCardCta: 'Åpne Max',
    signOut: 'Logg ut',
    manageSub: 'Administrer abonnement',
    manageError: 'Klarte ikke åpne Stripe',
  },
  en: {
    productTag: 'APEX QUANTUM +',
    maxCardEye: 'ALLOWLIST',
    maxCardTitle: 'Apex Quantum Max',
    maxCardSub: 'You have full access as an early user.',
    maxCardCta: 'Open Max',
    signOut: 'Sign out',
    manageSub: 'Manage subscription',
    manageError: 'Could not open Stripe',
  },
  de: {
    productTag: 'APEX QUANTUM +',
    maxCardEye: 'ALLOWLIST',
    maxCardTitle: 'Apex Quantum Max',
    maxCardSub: 'Sie haben als früher Nutzer vollen Zugang.',
    maxCardCta: 'Max öffnen',
    signOut: 'Abmelden',
    manageSub: 'Abonnement verwalten',
    manageError: 'Konnte Stripe nicht öffnen',
  },
  es: {
    productTag: 'APEX QUANTUM +',
    maxCardEye: 'ALLOWLIST',
    maxCardTitle: 'Apex Quantum Max',
    maxCardSub: 'Tienes acceso total como usuario temprano.',
    maxCardCta: 'Abrir Max',
    signOut: 'Cerrar sesión',
    manageSub: 'Administrar suscripción',
    manageError: 'No se pudo abrir Stripe',
  },
  zh: {
    productTag: 'APEX QUANTUM +',
    maxCardEye: '白名单',
    maxCardTitle: 'Apex Quantum Max',
    maxCardSub: '作为早期用户，您拥有完全访问权限。',
    maxCardCta: '打开 Max',
    signOut: '登出',
    manageSub: '管理订阅',
    manageError: '无法打开 Stripe',
  },
} as const;

interface Props {
  allowlisted: boolean;
  hasSubscription: boolean;
}

export default function PlusDashboardClient({ allowlisted, hasSubscription }: Props) {
  const [lang, setLang] = useState<PlusLang>('no');
  const [view, setView] = useState<ViewKey>('signals');
  const [navOpen, setNavOpen] = useState(false);
  const [manageBusy, setManageBusy] = useState(false);
  const [signalCount, setSignalCount] = useState<number | null>(null);
  const { user } = useUser();
  const t = COPY[lang];

  // Fetch today's signal count once on mount so the sidebar badge can show
  // an at-a-glance number. SignalsView still does its own fetch — keeping
  // it independent so each view stays self-contained.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/plus/signals/today', { credentials: 'include' });
        const data = await res.json();
        if (cancelled) return;
        if (data.ok && Array.isArray(data.signals)) {
          setSignalCount(data.signals.length);
        }
      } catch {
        /* ignore — badge just won't show */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const openPortal = async () => {
    setManageBusy(true);
    try {
      const res = await fetch('/api/plus/portal', { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error(data.error || 'unknown');
    } catch {
      window.alert(t.manageError);
      setManageBusy(false);
    }
  };

  const renderView = () => {
    switch (view) {
      case 'signals':
        return <SignalsView lang={lang} />;
      case 'ask':
        return <AskView lang={lang} />;
      case 'watchlist':
        return <WatchlistView lang={lang} />;
      case 'reports':
        return <ReportsView lang={lang} />;
      case 'learn':
        return <LearnView lang={lang} />;
      case 'journal':
        return <JournalView lang={lang} />;
    }
  };

  return (
    <div className="aqp-shell">
      <button
        type="button"
        className="aqp-mobile-toggle"
        aria-label="Toggle navigation"
        onClick={() => setNavOpen((v) => !v)}
      >
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 6h18M3 12h18M3 18h18" />
        </svg>
      </button>

      <aside className={`aqp-sidebar ${navOpen ? 'is-open' : ''}`}>
        <div className="aqp-brand">
          <Link href="/" className="aqp-brand-link">
            <span className="aqp-brand-mk">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/aq-logo.png" alt="" />
            </span>
            <span className="aqp-brand-wm">
              <span style={{ color: 'rgba(255,255,255,0.55)' }}>APEX</span>{' '}
              <span style={{ color: 'var(--aq-cyan)' }}>QUANTUM</span>
              <span className="aqp-plus-tag">+</span>
            </span>
          </Link>
        </div>

        <nav className="aqp-nav">
          {NAV.map((item) => {
            const label = NAV_LABELS[item.key][lang];
            const isActive = view === item.key;
            const showCount = item.key === 'signals' && signalCount !== null && signalCount > 0;
            return (
              <button
                key={item.key}
                type="button"
                className={`aqp-nav-item ${isActive ? 'is-active' : ''}`}
                onClick={() => {
                  setView(item.key);
                  setNavOpen(false);
                }}
              >
                <NavIcon type={item.icon} />
                <span className="aqp-nav-label">{label}</span>
                {showCount && <span className="aqp-nav-badge aqp-nav-badge--count">{signalCount}</span>}
              </button>
            );
          })}
        </nav>

        {allowlisted && (
          <div className="aqp-max-card">
            <div className="aqp-max-eye">
              <span className="aqp-max-dot" />
              {t.maxCardEye}
            </div>
            <div className="aqp-max-title">{t.maxCardTitle}</div>
            <div className="aqp-max-sub">{t.maxCardSub}</div>
            <Link href="/max" className="aqp-max-cta">
              {t.maxCardCta}
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        )}

        <div className="aqp-foot">
          <div className="aqp-lang-row">
            {PLUS_LANGS.map((l) => (
              <button
                key={l}
                type="button"
                className={`aqp-lang ${lang === l ? 'is-on' : ''}`}
                onClick={() => setLang(l)}
              >
                {PLUS_LANG_LABELS[l]}
              </button>
            ))}
          </div>
          <div className="aqp-user">
            <div className="aqp-user-name">
              {user?.firstName ?? user?.username ?? user?.emailAddresses[0]?.emailAddress ?? ''}
            </div>
            {hasSubscription && (
              <button
                type="button"
                className="aqp-signout"
                onClick={openPortal}
                disabled={manageBusy}
                style={{ marginBottom: 6 }}
              >
                {t.manageSub}
              </button>
            )}
            <SignOutButton redirectUrl="/">
              <button type="button" className="aqp-signout">
                {t.signOut}
              </button>
            </SignOutButton>
          </div>
        </div>
      </aside>

      <main className="aqp-main">{renderView()}</main>

      <OnboardingModal lang={lang} />
    </div>
  );
}

function NavIcon({ type }: { type: string }) {
  switch (type) {
    case 'pulse':
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 12h3l3-9 4 18 3-9h7" />
        </svg>
      );
    case 'chat':
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
    case 'list':
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <line x1="3" y1="6" x2="3.01" y2="6" />
          <line x1="3" y1="12" x2="3.01" y2="12" />
          <line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>
      );
    case 'doc':
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      );
    case 'book':
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
      );
    case 'edit':
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4z" />
        </svg>
      );
    default:
      return null;
  }
}

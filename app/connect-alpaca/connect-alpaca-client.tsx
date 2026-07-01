'use client';

/**
 * /connect-alpaca — terminal-dialekt (§10) med FULLSIDE-samtykkesteg
 * (§6 lag 4b) FØR nøkkelskjemaet: fullstendig risikotekst fra
 * lib/legal-copy (ATTESTATION + ATTESTATION_MAX_EXTRA), checkbox og
 * lagring i Clerk publicMetadata { riskAttestedAt, riskVersion } via
 * den delte ruten /api/attest-risk (§6 lag 4a/4b — samme versjonering).
 * Allerede attestert (riktig versjon) → steget hoppes over.
 * All tilkoblingslogikk (validering, POST til
 * /api/apex/alpaca/connect, redirect til /max) er uendret.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { useUser } from '@clerk/nextjs';
import type { Lang } from '@/app/components/marketing/types';
import { readLangCookie } from '@/lib/i18n/lang-cookie';
import { ATTESTATION, ATTESTATION_MAX_EXTRA, RISK_VERSION } from '@/lib/legal-copy';
import '../components/marketing-v2/styles.css';
import '@/app/styles/terminal.css';

type Env = 'paper' | 'live';

const T = {
  no: {
    back: '← Tilbake til forsiden',
    riskLink: 'Fullstendige risikofaktorer →',
    // Nøkkelskjema
    title: 'Koble til',
    titleEm: 'Alpaca',
    lede: 'Lim inn API Key ID og Secret Key fra din Alpaca-konto. Nøklene brukes kun til autonom handel på din konto.',
    envLabel: 'Miljø',
    paperName: 'PAPER',
    paperDesc: 'Simulert handel — virtuelle penger fra Alpaca Paper Trading.',
    liveName: 'LIVE',
    liveDesc: 'Reell handel — ekte penger på din Alpaca Live-konto.',
    keyLabel: 'API Key ID',
    secretLabel: 'Secret Key',
    show: 'Vis',
    hide: 'Skjul',
    secNote: 'Nøklene krypteres med AES-256-GCM før lagring · aldri i klartekst',
    whereTitle: 'Hvor finner jeg nøklene?',
    whereLoginPre: 'Logg inn på',
    whereLoginPost: 'og bytt til riktig miljø i kontovelgeren øverst.',
    where2: 'Scroll til «API Keys»-seksjonen og klikk «Generate New Key».',
    where3: 'Kopier Key ID og Secret. Secret vises kun én gang.',
    obs: 'Bruk Trading API-nøkler fra app.alpaca.markets. Nøkler fra broker-app.alpaca.markets (Broker API) fungerer ikke — det er en annen tjeneste for forretningskunder.',
    liveWarnHead: 'LIVE TRADING',
    liveWarnBody:
      'Apex Quantum vil utføre kjøps- og salgsordrer på din ekte Alpaca-konto. Tap er reelle og ugjenkallelige. Apex Quantum gir ingen garantier.',
    required: 'Begge feltene er påkrevd.',
    failed: 'Tilkobling feilet.',
    network: 'Nettverksfeil',
    validatingToast: 'Validerer Alpaca-nøkler …',
    validatingBtn: 'Validerer …',
    submitPaper: 'Koble til Paper-konto',
    submitLive: 'Koble til LIVE-konto',
    confirmLive:
      'ADVARSEL: Du er i ferd med å koble til en LIVE Alpaca-konto.\n\nAlle handler utføres med ekte penger. Tap er reelle.\n\nBekreft for å fortsette.',
    connectedToast: (env: string, id: string) => `Tilkoblet ${env}-konto ${id}`,
    attestFailed: 'Kunne ikke lagre bekreftelsen. Prøv igjen.',
    saving: 'Lagrer …',
    footer: 'Alpaca-handel er underlagt Alpacas vilkår.',
  },
  en: {
    back: '← Back to the homepage',
    riskLink: 'Full risk factors →',
    title: 'Connect to',
    titleEm: 'Alpaca',
    lede: 'Paste the API Key ID and Secret Key from your Alpaca account. The keys are used solely for autonomous trading on your account.',
    envLabel: 'Environment',
    paperName: 'PAPER',
    paperDesc: 'Simulated trading — virtual money from Alpaca Paper Trading.',
    liveName: 'LIVE',
    liveDesc: 'Real trading — real money on your Alpaca Live account.',
    keyLabel: 'API Key ID',
    secretLabel: 'Secret Key',
    show: 'Show',
    hide: 'Hide',
    secNote: 'Keys are encrypted with AES-256-GCM before storage · never in plaintext',
    whereTitle: 'Where do I find the keys?',
    whereLoginPre: 'Sign in at',
    whereLoginPost: 'and switch to the right environment in the account selector at the top.',
    where2: 'Scroll to the “API Keys” section and click “Generate New Key”.',
    where3: 'Copy the Key ID and Secret. The Secret is shown only once.',
    obs: 'Use Trading API keys from app.alpaca.markets. Keys from broker-app.alpaca.markets (Broker API) will not work — that is a different service for business customers.',
    liveWarnHead: 'LIVE TRADING',
    liveWarnBody:
      'Apex Quantum will execute buy and sell orders on your real Alpaca account. Losses are real and irreversible. Apex Quantum offers no guarantees.',
    required: 'Both fields are required.',
    failed: 'Connection failed.',
    network: 'Network error',
    validatingToast: 'Validating Alpaca keys …',
    validatingBtn: 'Validating …',
    submitPaper: 'Connect Paper account',
    submitLive: 'Connect LIVE account',
    confirmLive:
      'WARNING: You are about to connect a LIVE Alpaca account.\n\nAll trades are executed with real money. Losses are real.\n\nConfirm to continue.',
    connectedToast: (env: string, id: string) => `Connected ${env} account ${id}`,
    attestFailed: 'Could not save the confirmation. Please try again.',
    saving: 'Saving …',
    footer: 'Alpaca trading is subject to Alpaca’s terms.',
  },
} satisfies Record<Lang, Record<string, unknown>>;

export default function ConnectAlpacaClient() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const [lang, setLang] = useState<Lang>('no');
  const t = T[lang];
  const att = ATTESTATION[lang];

  // Nøkkelskjema-tilstand (uendret logikk)
  const [environment, setEnvironment] = useState<Env>('paper');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Attestasjon
  const [checked, setChecked] = useState(false);
  const [attesting, setAttesting] = useState(false);
  const [attestedNow, setAttestedNow] = useState(false);

  useEffect(() => {
    const cookieLang = readLangCookie();
    if (cookieLang) setLang(cookieLang);
  }, []);

  // §6 lag 4b — Max-attestasjonen (ATTESTATION + ATTESTATION_MAX_EXTRA)
  // krever eget maxRiskVersion-felt; Plus-attestasjonen (riskVersion)
  // dekker IKKE de utvidede Max-punktene og hopper aldri over steget.
  const meta = (user?.publicMetadata ?? {}) as { maxRiskVersion?: number };
  const alreadyAttested =
    typeof meta.maxRiskVersion === 'number' && meta.maxRiskVersion >= RISK_VERSION;
  const attested = alreadyAttested || attestedNow;

  const isLive = environment === 'live';

  const handleAttest = async () => {
    if (!checked || attesting) return;
    setAttesting(true);
    setError(null);
    try {
      const res = await fetch('/api/attest-risk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ scope: 'max' }),
      });
      if (!res.ok) {
        setError(t.attestFailed);
        return;
      }
      // Oppdater Clerk-brukerobjektet slik at metadata er ferskt ved refresh.
      try {
        await user?.reload();
      } catch {
        /* metadata er lagret server-side; lokal reload er best effort */
      }
      setAttestedNow(true);
    } catch {
      setError(t.attestFailed);
    } finally {
      setAttesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim() || !apiSecret.trim()) {
      setError(t.required);
      return;
    }

    if (isLive) {
      const confirmed = window.confirm(t.confirmLive);
      if (!confirmed) return;
    }

    setError(null);
    setIsSubmitting(true);
    const toastId = toast.loading(t.validatingToast);

    try {
      const res = await fetch('/api/apex/alpaca/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          apiKey: apiKey.trim(),
          apiSecret: apiSecret.trim(),
          environment,
        }),
      });

      const data = await res.json();
      toast.dismiss(toastId);

      if (!res.ok) {
        setError(data.error || t.failed);
        toast.error(data.error || t.failed);
        return;
      }

      toast.success(
        t.connectedToast(isLive ? 'LIVE' : 'PAPER', data.accountInfo?.accountId || ''),
      );
      router.push('/max');
    } catch (err) {
      toast.dismiss(toastId);
      const msg = err instanceof Error ? err.message : t.network;
      setError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="aq-term aq-ca-wrap">
      <header className="aq-ca-head">
        <Link href="/" className="aq-ck-brand">
          Apex <em>Quantum</em>
        </Link>
        <span className="aq-ck-maxtag">Max</span>
      </header>

      <main className="aq-ca-main">
        <div className="aq-ca-card">
          {!isLoaded ? (
            <div className="aq-hatch" style={{ minHeight: 320 }}>
              …
            </div>
          ) : !attested ? (
            /* ── Steg 1: FULLSIDE-attestasjon (§6 lag 4b) ── */
            <section className="aq-panel" aria-label={att.title}>
              <div className="aq-panel-head">
                <span>{lang === 'no' ? 'RISIKOBEKREFTELSE' : 'RISK ATTESTATION'}</span>
                <span className="aq-ck-panel-note">
                  {lang === 'no' ? `VERSJON ${RISK_VERSION}` : `VERSION ${RISK_VERSION}`}
                </span>
              </div>
              <div className="aq-panel-body">
                <h1 className="aq-ca-title">{att.title}</h1>
                <p className="aq-ca-lede">{att.intro}</p>
                <ul className="aq-ca-points">
                  {[...att.points, ...ATTESTATION_MAX_EXTRA[lang]].map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
                <label className="aq-ca-check">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => setChecked(e.target.checked)}
                  />
                  <span>{att.checkbox}</span>
                </label>
                {error && <div className="aq-ca-error">{error}</div>}
                <button
                  type="button"
                  className="aq-ca-btn aq-ca-btn-block"
                  disabled={!checked || attesting}
                  onClick={handleAttest}
                >
                  {attesting ? t.saving : att.confirm}
                </button>
                <p style={{ marginTop: 16, marginBottom: 0 }}>
                  <Link
                    href="/risikofaktorer"
                    className="aq-ca-ghost"
                    style={{ color: 'var(--aq-cyan-hi)' }}
                  >
                    {t.riskLink}
                  </Link>
                </p>
              </div>
            </section>
          ) : (
            /* ── Steg 2: nøkkelskjemaet (uendret funksjonalitet) ── */
            <section className="aq-panel" aria-label={`${t.title} ${t.titleEm}`}>
              <div className="aq-panel-head">
                <span>{lang === 'no' ? 'MEGLERKOBLING' : 'BROKER CONNECTION'}</span>
                <span className="aq-ck-panel-note">AES-256-GCM</span>
              </div>
              <div className="aq-panel-body">
                <h1 className="aq-ca-title">
                  {t.title} <em>{t.titleEm}</em>
                </h1>
                <p className="aq-ca-lede">{t.lede}</p>

                <form onSubmit={handleSubmit}>
                  <div className="aq-ca-field">
                    <label id="ca-env-label">{t.envLabel}</label>
                    <div className="aq-ca-env" role="group" aria-labelledby="ca-env-label">
                      <button
                        type="button"
                        data-on={environment === 'paper' || undefined}
                        onClick={() => setEnvironment('paper')}
                      >
                        <span className="aq-ca-env-name">
                          <span
                            className="aq-ck-dot"
                            data-tone={environment === 'paper' ? 'live' : undefined}
                            aria-hidden
                          />
                          {t.paperName}
                        </span>
                        <p className="aq-ca-env-desc">{t.paperDesc}</p>
                      </button>
                      <button
                        type="button"
                        data-env="live"
                        data-on={environment === 'live' || undefined}
                        onClick={() => setEnvironment('live')}
                      >
                        <span className="aq-ca-env-name">
                          <span
                            className="aq-ck-dot"
                            style={
                              environment === 'live'
                                ? { background: 'var(--aq-warn)' }
                                : undefined
                            }
                            aria-hidden
                          />
                          {t.liveName}
                        </span>
                        <p className="aq-ca-env-desc">{t.liveDesc}</p>
                      </button>
                    </div>
                  </div>

                  <div className="aq-ca-field">
                    <label htmlFor="apiKey">{t.keyLabel}</label>
                    <input
                      id="apiKey"
                      type="text"
                      autoComplete="off"
                      spellCheck={false}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="PKXXXXXXXXXXXXXXXXXX"
                      required
                    />
                  </div>

                  <div className="aq-ca-field">
                    <label htmlFor="apiSecret">{t.secretLabel}</label>
                    <div className="aq-ca-input-wrap">
                      <input
                        id="apiSecret"
                        type={showSecret ? 'text' : 'password'}
                        autoComplete="off"
                        spellCheck={false}
                        value={apiSecret}
                        onChange={(e) => setApiSecret(e.target.value)}
                        placeholder="••••••••••••••••••••••••"
                        required
                      />
                      <button
                        type="button"
                        className="aq-ca-reveal"
                        onClick={() => setShowSecret((v) => !v)}
                      >
                        {showSecret ? t.hide : t.show}
                      </button>
                    </div>
                    <span className="aq-ca-secnote">{t.secNote}</span>
                  </div>

                  <div className="aq-ca-note">
                    <b>{t.whereTitle}</b>
                    <ol>
                      <li>
                        {t.whereLoginPre}{' '}
                        <a
                          href={
                            isLive
                              ? 'https://app.alpaca.markets/dashboard/overview'
                              : 'https://app.alpaca.markets/paper/dashboard/overview'
                          }
                          target="_blank"
                          rel="noreferrer"
                        >
                          app.alpaca.markets
                        </a>{' '}
                        {t.whereLoginPost}
                      </li>
                      <li>{t.where2}</li>
                      <li>{t.where3}</li>
                    </ol>
                    <span className="aq-ca-secnote">{t.obs}</span>
                  </div>

                  {isLive && (
                    <div className="aq-ca-warnbox">
                      <p className="aq-ca-warn-head">{t.liveWarnHead}</p>
                      <p>{t.liveWarnBody}</p>
                    </div>
                  )}

                  {error && <div className="aq-ca-error">{error}</div>}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="aq-ca-btn aq-ca-btn-block"
                    data-tone={isLive ? 'danger' : undefined}
                  >
                    {isSubmitting ? t.validatingBtn : isLive ? t.submitLive : t.submitPaper}
                  </button>
                </form>
              </div>
            </section>
          )}

          <p style={{ textAlign: 'center', marginTop: 24 }}>
            <Link href="/" className="aq-ca-ghost">
              {t.back}
            </Link>
          </p>
        </div>
      </main>

      <footer className="aq-ca-foot">
        <div className="aq-statusline">
          <span suppressHydrationWarning>© {new Date().getFullYear()} Apex Quantum AS</span>
          <span className="aq-statusline-mid">{t.footer}</span>
          <span className="aq-statusline-right">
            <Link href="/risikofaktorer">{lang === 'no' ? 'Risiko →' : 'Risk →'}</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}

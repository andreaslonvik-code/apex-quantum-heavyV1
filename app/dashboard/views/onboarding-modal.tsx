'use client';

import { useState } from 'react';
import { useUser } from '@clerk/nextjs';
import type { PlusLang } from '@/lib/i18n/plus-lang';
import { ATTESTATION, RISK_VERSION } from '@/lib/legal-copy';

const COPY = {
  no: {
    title: 'Velkommen til Apex Quantum +',
    sub: 'Tre minutter på en kort gjennomgang så bruker du plattformen som en proff.',
    steps: [
      {
        eye: 'SIGNALER',
        title: 'Daglig markedsanalyse',
        body: 'Hver hele time bygger AI-en en oppdatert modellportefølje per hovedbørs — Oslo, US, EU, Asia — med begrunnelse, katalysatorer og risiko. Du forstår hvorfor, ikke bare hva.',
      },
      {
        eye: 'SPØR AI',
        title: 'Din egen analytiker, 24/7',
        body: 'Spør AI om hvilken som helst aksje. Modellen kjører live søk og forklarer pedagogisk. Aldri konkrete kjøps- eller salgsanbefalinger — du tar beslutningene.',
      },
      {
        eye: 'LÆRING + JOURNAL',
        title: 'Bygg ekspertisen din',
        body: 'Strukturerte leksjoner fra nybegynner til avansert. Logg beslutningene dine i journalen og se mønstrene dine over tid — det er der den ekte læringen skjer.',
      },
    ],
    attestEye: 'RISIKOATTESTASJON',
    next: 'Neste',
    skip: 'Hopp over',
    attestError: 'Kunne ikke lagre bekreftelsen. Prøv igjen.',
    attestBusy: 'Lagrer …',
  },
  en: {
    title: 'Welcome to Apex Quantum +',
    sub: 'Three minutes on a short tour and you use the platform like a pro.',
    steps: [
      {
        eye: 'SIGNALS',
        title: 'Daily market analysis',
        body: 'Every hour the AI rebuilds a concentrated model portfolio per major exchange — Oslo, US, EU, Asia — with reasoning, catalysts and risk. You understand why, not just what.',
      },
      {
        eye: 'ASK AI',
        title: 'Your own analyst, 24/7',
        body: 'Ask AI about any stock. The model runs live search and explains educationally. Never specific buy or sell calls — you make the decisions.',
      },
      {
        eye: 'LEARN + JOURNAL',
        title: 'Build your expertise',
        body: 'Structured lessons from beginner to advanced. Log your decisions in the journal and see your patterns over time — that is where real learning happens.',
      },
    ],
    attestEye: 'RISK ATTESTATION',
    next: 'Next',
    skip: 'Skip',
    attestError: 'Could not save the confirmation. Please try again.',
    attestBusy: 'Saving …',
  },
  de: {
    title: 'Willkommen bei Apex Quantum +',
    sub: 'Drei Minuten Kurzeinführung und Sie nutzen die Plattform wie ein Profi.',
    steps: [
      {
        eye: 'SIGNALE',
        title: 'Tägliche Marktanalyse',
        body: 'Stündlich erstellt die KI ein konzentriertes Modellportfolio pro Hauptbörse — Oslo, US, EU, Asien — mit Begründung, Katalysatoren und Risiken.',
      },
      {
        eye: 'KI FRAGEN',
        title: 'Ihr eigener Analyst, 24/7',
        body: 'Fragen Sie die KI zu jeder Aktie. Live-Recherche, pädagogisch erklärt. Keine konkreten Kauf-/Verkaufsempfehlungen — Sie entscheiden.',
      },
      {
        eye: 'LERNEN + JOURNAL',
        title: 'Bauen Sie Expertise auf',
        body: 'Strukturierte Lektionen vom Anfänger bis Fortgeschrittenen. Loggen Sie Entscheidungen im Journal und erkennen Sie Muster über Zeit.',
      },
    ],
    attestEye: 'RISK ATTESTATION',
    next: 'Weiter',
    skip: 'Überspringen',
    attestError: 'Bestätigung konnte nicht gespeichert werden. Bitte erneut versuchen.',
    attestBusy: 'Speichert …',
  },
  es: {
    title: 'Bienvenido a Apex Quantum +',
    sub: 'Tres minutos de tour rápido y usas la plataforma como un profesional.',
    steps: [
      {
        eye: 'SEÑALES',
        title: 'Análisis diario',
        body: 'Cada hora la IA reconstruye una cartera modelo concentrada por bolsa principal — Oslo, EE.UU., UE, Asia — con razonamiento, catalizadores y riesgos.',
      },
      {
        eye: 'PREGUNTAR IA',
        title: 'Tu propio analista, 24/7',
        body: 'Pregunta a la IA sobre cualquier acción. Búsqueda en vivo, explicación pedagógica. Nunca recomendaciones específicas — tú decides.',
      },
      {
        eye: 'APRENDER + DIARIO',
        title: 'Construye tu experiencia',
        body: 'Lecciones estructuradas de principiante a avanzado. Registra decisiones y observa tus patrones con el tiempo.',
      },
    ],
    attestEye: 'RISK ATTESTATION',
    next: 'Siguiente',
    skip: 'Saltar',
    attestError: 'No se pudo guardar la confirmación. Inténtalo de nuevo.',
    attestBusy: 'Guardando …',
  },
  zh: {
    title: '欢迎使用 Apex Quantum +',
    sub: '三分钟快速导览，让你像专业人士一样使用平台。',
    steps: [
      {
        eye: '信号',
        title: '每日市场分析',
        body: '每小时 AI 都会按主要交易所（奥斯陆、美国、欧洲、亚洲）重新构建一个集中的模型投资组合——附带推理、催化剂与风险。',
      },
      {
        eye: '问 AI',
        title: '你的专属分析师，24/7',
        body: '问 AI 关于任何股票。实时搜索，教学式解释。从不给出具体买卖建议——你自己决定。',
      },
      {
        eye: '学习 + 日志',
        title: '建立你的专业',
        body: '从入门到高级的结构化课程。在日志中记录决定，发现自己的模式。',
      },
    ],
    attestEye: 'RISK ATTESTATION',
    next: '下一步',
    skip: '跳过',
    attestError: '无法保存确认，请重试。',
    attestBusy: '保存中 …',
  },
} as const;

interface Props {
  lang: PlusLang;
}

/**
 * Onboarding + risikoattestasjon (§6 lag 4a).
 *
 * Vises KUN når Clerk publicMetadata mangler riskAttestedAt/riskVersion,
 * eller riskVersion < RISK_VERSION — aldri per sesjon. Siste steg er
 * attestasjonen fra lib/legal-copy: tre punkter, checkbox, «Bekreft og
 * fortsett». Tour-stegene kan hoppes over; attestasjonen kan ikke.
 */
export function OnboardingModal({ lang }: Props) {
  const { user, isLoaded } = useUser();
  const [step, setStep] = useState(0);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [done, setDone] = useState(false);

  const t = COPY[lang];
  // Juridisk tekst finnes kanonisk kun på NO/EN (lib/legal-copy).
  const legalLang = lang === 'no' ? 'no' : 'en';
  const legal = ATTESTATION[legalLang];

  if (!isLoaded || !user || done) return null;

  const meta = (user.publicMetadata ?? {}) as {
    riskAttestedAt?: unknown;
    riskVersion?: unknown;
  };
  const attested =
    typeof meta.riskAttestedAt === 'string' &&
    typeof meta.riskVersion === 'number' &&
    meta.riskVersion >= RISK_VERSION;
  if (attested) return null;

  const attestIndex = t.steps.length; // attestasjonen er alltid siste steg
  const isAttest = step === attestIndex;
  const totalSteps = t.steps.length + 1;

  const confirm = async () => {
    if (!checked || busy) return;
    setBusy(true);
    setError(false);
    try {
      const res = await fetch('/api/attest-risk', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error('attest_failed');
      // Oppdater Clerks klient-cache så metadata-sjekken over holder
      // ved neste render — attestasjonen overlever refresh uansett.
      await user.reload();
      setDone(true);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="aqp-onb-overlay" role="dialog" aria-modal="true" aria-labelledby="aqp-onb-title">
      <div className="aqp-onb-card">
        {isAttest ? (
          <>
            <header className="aqp-onb-head">
              <div className="aqp-onb-eye">{t.attestEye}</div>
              <h2 id="aqp-onb-title" className="aqp-onb-title">
                {legal.title}
              </h2>
              <p className="aqp-onb-sub">{legal.intro}</p>
            </header>

            <ul className="aqp-onb-points">
              {legal.points.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>

            <label className="aqp-onb-check">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
              />
              <span>{legal.checkbox}</span>
            </label>

            {error && (
              <p className="aqp-onb-error" role="alert">
                {t.attestError}
              </p>
            )}
          </>
        ) : (
          <>
            <header className="aqp-onb-head">
              <h2 id="aqp-onb-title" className="aqp-onb-title">
                {t.title}
              </h2>
              <p className="aqp-onb-sub">{t.sub}</p>
            </header>

            <div className="aqp-onb-step">
              <div className="aqp-onb-eye">{t.steps[step].eye}</div>
              <h3 className="aqp-onb-step-title">{t.steps[step].title}</h3>
              <p className="aqp-onb-step-body">{t.steps[step].body}</p>
            </div>
          </>
        )}

        <div className="aqp-onb-progress" aria-hidden>
          {Array.from({ length: totalSteps }, (_, i) => (
            <span
              key={i}
              className={`aqp-onb-dot ${i === step ? 'is-on' : i < step ? 'is-done' : ''}`}
            />
          ))}
        </div>

        <div className={`aqp-onb-actions ${isAttest ? 'aqp-onb-actions--end' : ''}`}>
          {isAttest ? (
            <button
              type="button"
              className="btn-primary-v8 btn-sm aqp-onb-confirm"
              onClick={confirm}
              disabled={!checked || busy}
            >
              {busy ? t.attestBusy : legal.confirm}
            </button>
          ) : (
            <>
              <button
                type="button"
                className="btn-ghost-v8 btn-sm"
                onClick={() => setStep(attestIndex)}
              >
                {t.skip}
              </button>
              <button
                type="button"
                className="btn-primary-v8 btn-sm"
                onClick={() => setStep((s) => s + 1)}
              >
                {t.next}
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

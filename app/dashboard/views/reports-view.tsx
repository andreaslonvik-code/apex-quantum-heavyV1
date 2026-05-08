'use client';

import { useEffect, useState } from 'react';
import type { PlusLang } from '@/lib/i18n/plus-lang';

interface Report {
  id: string;
  reportDate: string;
  title: string;
  body: string;
  publishedAt: string;
}

const COPY = {
  no: {
    eye: 'MORGENBRIEF',
    title: 'Daglig markedsrapport',
    sub: 'Hver morgen før kl. 08:00 leverer modellen en oppdatert gjennomgang: hva skjedde overnight, dagens hovedsak, hvilke sektorer som åpner sterkt, og hva som er verdt å følge med på i dag.',
    cadence: 'Publiseres ca. kl. 07:00 norsk tid hver morgen',
    loading: 'Laster rapporter…',
    empty: 'Ingen rapport publisert ennå',
    emptySub: 'Første rapport leveres morgenen etter lansering. Du blir varslet på e-post.',
    history: 'Tidligere rapporter',
    publishedOn: 'Publisert',
  },
  en: {
    eye: 'MORNING BRIEF',
    title: 'Daily market report',
    sub: 'Every morning before 08:00 CET the model delivers an updated review: what happened overnight, today\'s headline, which sectors open strong, and what to watch through the day.',
    cadence: 'Published around 07:00 CET each morning',
    loading: 'Loading reports…',
    empty: 'No report published yet',
    emptySub: 'The first report ships the morning after launch. You will be notified by email.',
    history: 'Previous reports',
    publishedOn: 'Published',
  },
  de: {
    eye: 'MORGEN-BRIEFING',
    title: 'Tägliche Marktberichte',
    sub: 'Jeden Morgen vor 08:00 MEZ liefert das Modell eine aktualisierte Übersicht: Was geschah über Nacht, das Tagesthema, welche Sektoren stark öffnen und worauf Sie heute achten sollten.',
    cadence: 'Veröffentlicht ca. 07:00 MEZ jeden Morgen',
    loading: 'Lade Berichte…',
    empty: 'Noch kein Bericht veröffentlicht',
    emptySub: 'Der erste Bericht erscheint am Morgen nach dem Launch. Sie erhalten eine E-Mail.',
    history: 'Frühere Berichte',
    publishedOn: 'Veröffentlicht',
  },
  es: {
    eye: 'INFORME MATINAL',
    title: 'Informe diario del mercado',
    sub: 'Cada mañana antes de las 08:00 CET el modelo entrega una revisión actualizada: qué pasó durante la noche, el tema del día, qué sectores abren fuertes y qué seguir hoy.',
    cadence: 'Publicado alrededor de las 07:00 CET cada mañana',
    loading: 'Cargando informes…',
    empty: 'Aún no hay informe',
    emptySub: 'El primer informe se publica la mañana posterior al lanzamiento. Te avisaremos por email.',
    history: 'Informes anteriores',
    publishedOn: 'Publicado',
  },
  zh: {
    eye: '晨报',
    title: '每日市场报告',
    sub: '每天早晨 CET 08:00 之前，模型会发布最新综述：隔夜动态、今日主题、哪些行业强势开盘，以及今天值得关注的内容。',
    cadence: '每天早晨 CET 07:00 左右发布',
    loading: '加载报告…',
    empty: '尚未发布报告',
    emptySub: '首份报告将在产品发布后的次日清晨发布。我们会通过邮件通知。',
    history: '过往报告',
    publishedOn: '发布',
  },
} as const;

function renderMarkdown(body: string) {
  // Lightweight inline renderer — splits into blocks by blank lines, treats
  // lines starting with #/## as headings and lines starting with - as bullets.
  // Avoids pulling in a markdown lib for the small set of formatting Grok uses.
  const blocks = body.split(/\n{2,}/);
  return blocks.map((block, i) => {
    const trimmed = block.trim();
    if (trimmed.startsWith('# ')) {
      return (
        <h2 key={i} className="aqp-report-h1">
          {trimmed.replace(/^#\s+/, '')}
        </h2>
      );
    }
    if (trimmed.startsWith('## ')) {
      return (
        <h3 key={i} className="aqp-report-h2">
          {trimmed.replace(/^##\s+/, '')}
        </h3>
      );
    }
    if (trimmed.startsWith('### ')) {
      return (
        <h4 key={i} className="aqp-report-h3">
          {trimmed.replace(/^###\s+/, '')}
        </h4>
      );
    }
    if (/^[-*]\s/.test(trimmed)) {
      const items = trimmed.split('\n').map((l) => l.replace(/^[-*]\s+/, ''));
      return (
        <ul key={i} className="aqp-report-list">
          {items.map((it, j) => (
            <li key={j}>{it}</li>
          ))}
        </ul>
      );
    }
    return (
      <p key={i} className="aqp-report-p">
        {trimmed}
      </p>
    );
  });
}

export function ReportsView({ lang }: { lang: PlusLang }) {
  const t = COPY[lang];
  const [reports, setReports] = useState<Report[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const apiLang = lang === 'no' ? 'no' : 'en';
        const res = await fetch(`/api/plus/reports?lang=${apiLang}`, {
          credentials: 'include',
        });
        const data = await res.json();
        if (cancelled) return;
        if (data.ok && Array.isArray(data.reports)) {
          setReports(data.reports as Report[]);
        } else {
          setReports([]);
        }
      } catch {
        if (!cancelled) setReports([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lang]);

  const latest = reports && reports.length > 0 ? reports[0] : null;
  const history = reports && reports.length > 1 ? reports.slice(1) : [];

  return (
    <div className="aqp-content">
      <div className="aqp-page-head">
        <div className="m-eyebrow">
          <span className="m-badge-dot" />
          {t.eye}
        </div>
        <h1 className="aqp-page-title">{t.title}</h1>
        <p className="aqp-page-sub">{t.sub}</p>
      </div>

      <div className="aqp-cadence">{t.cadence}</div>

      {reports === null ? (
        <div className="aqp-empty">{t.loading}</div>
      ) : !latest ? (
        <div className="aqp-empty-card">
          <div className="aqp-empty-title">{t.empty}</div>
          <p className="aqp-empty-sub">{t.emptySub}</p>
        </div>
      ) : (
        <>
          <article className="aqp-report-card">
            <header style={{ marginBottom: 24 }}>
              <h2 className="aqp-report-title">{latest.title}</h2>
              <div className="aqp-journal-date" style={{ marginTop: 6 }}>
                {t.publishedOn}{' '}
                {new Date(latest.publishedAt).toLocaleDateString(lang === 'zh' ? 'zh-CN' : lang, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </div>
            </header>
            <div className="aqp-report-body">{renderMarkdown(latest.body)}</div>
          </article>

          {history.length > 0 && (
            <div style={{ marginTop: 56 }}>
              <div className="cap-sm">{t.history}</div>
              <div className="aqp-report-history">
                {history.map((r) => (
                  <details key={r.id} className="aqp-report-history-item">
                    <summary>
                      <span className="aqp-report-history-title">{r.title}</span>
                      <span className="aqp-journal-date">
                        {new Date(r.publishedAt).toLocaleDateString(lang === 'zh' ? 'zh-CN' : lang)}
                      </span>
                    </summary>
                    <div className="aqp-report-body" style={{ marginTop: 16 }}>
                      {renderMarkdown(r.body)}
                    </div>
                  </details>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

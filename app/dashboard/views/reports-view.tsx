'use client';

import { useEffect, useState } from 'react';
import type { PlusLang } from '@/lib/i18n/plus-lang';

interface Report {
  id: string;
  weekStartsOn: string;
  title: string;
  body: string;
  publishedAt: string;
}

const COPY = {
  no: {
    eye: 'RAPPORTER',
    title: 'Ukentlige markedsrapporter',
    sub: 'Hver søndag publiseres en regional gjennomgang: hva som beveget kursene, sektorrotasjoner, makro-faktorer og hva modellen følger med på neste uke.',
    cadence: 'Publiseres søndag kl. 20:00 norsk tid',
    loading: 'Laster rapporter…',
    empty: 'Ingen rapporter publisert ennå',
    emptySub: 'Første rapport publiseres første søndag etter lansering. Du blir varslet på e-post.',
    history: 'Tidligere rapporter',
    publishedOn: 'Publisert',
  },
  en: {
    eye: 'REPORTS',
    title: 'Weekly market reports',
    sub: 'Every Sunday a regional review: what moved prices, sector rotations, macro factors, and what the model is watching next week.',
    cadence: 'Published Sunday 20:00 CET',
    loading: 'Loading reports…',
    empty: 'No reports published yet',
    emptySub: 'The first report ships the Sunday after launch. You will be notified by email.',
    history: 'Previous reports',
    publishedOn: 'Published',
  },
  de: {
    eye: 'BERICHTE',
    title: 'Wöchentliche Marktberichte',
    sub: 'Jeden Sonntag eine regionale Übersicht: Was die Kurse bewegte, Sektorrotationen, Makrofaktoren und was das Modell für nächste Woche beobachtet.',
    cadence: 'Veröffentlicht Sonntag 20:00 MEZ',
    loading: 'Lade Berichte…',
    empty: 'Noch keine Berichte veröffentlicht',
    emptySub: 'Der erste Bericht erscheint am Sonntag nach dem Launch. Sie erhalten eine E-Mail.',
    history: 'Frühere Berichte',
    publishedOn: 'Veröffentlicht',
  },
  es: {
    eye: 'INFORMES',
    title: 'Informes semanales',
    sub: 'Cada domingo una revisión regional: qué movió los precios, rotación sectorial, macro y qué vigila el modelo la próxima semana.',
    cadence: 'Publicado domingos 20:00 CET',
    loading: 'Cargando informes…',
    empty: 'Aún no hay informes',
    emptySub: 'El primer informe se publica el domingo posterior al lanzamiento. Te avisaremos por email.',
    history: 'Informes anteriores',
    publishedOn: 'Publicado',
  },
  zh: {
    eye: '报告',
    title: '每周市场报告',
    sub: '每周日发布区域回顾：价格驱动因素、行业轮动、宏观因素，以及模型下周关注的方向。',
    cadence: '每周日 CET 20:00 发布',
    loading: '加载报告…',
    empty: '尚未发布报告',
    emptySub: '首份报告将在产品发布后的第一个周日发布。我们会通过邮件通知。',
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
        const res = await fetch('/api/plus/reports', { credentials: 'include' });
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
  }, []);

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

'use client';

import { ArticleBody, PageShell } from '@/app/components/marketing/page-shell';
import type { Lang } from '@/app/components/marketing/types';

const COMPONENTS_NO = [
  ['Trading-motor (Alpaca)', 'Operativ'],
  ['AI-analyse', 'Operativ'],
  ['Web og dashboard', 'Operativ'],
  ['Autentisering (Clerk)', 'Operativ'],
  ['Database (Supabase)', 'Operativ'],
] as const;

const COMPONENTS_EN = [
  ['Trading engine (Alpaca)', 'Operational'],
  ['AI analysis', 'Operational'],
  ['Web and dashboard', 'Operational'],
  ['Authentication (Clerk)', 'Operational'],
  ['Database (Supabase)', 'Operational'],
] as const;

const COPY = {
  no: {
    title: 'Systemstatus',
    updatedLabel: 'Sist oppdatert',
    updatedDate: '30. april 2026',
    intro:
      'Live oversikt over de tjenestene Apex Quantum er avhengig av. Statusen oppdateres manuelt — for sanntidsoppdateringer ved hendelser, se e-postvarsler eller status-e-posten din.',
    sysHeader: 'Systemkomponenter',
    incidentsTitle: 'Aktive hendelser',
    incidentsBody: 'Ingen pågående hendelser.',
    historyTitle: 'Hendelseshistorikk',
    historyBody:
      'Detaljert hendelseshistorikk publiseres på denne siden etter hvert som vi har data å vise frem. Foreløpig har vi ingen registrerte avbrudd.',
    components: COMPONENTS_NO,
  },
  en: {
    title: 'System status',
    updatedLabel: 'Last updated',
    updatedDate: 'April 30, 2026',
    intro:
      'Live overview of the services Apex Quantum depends on. Status is updated manually — for real-time incident updates, check your email or status notifications.',
    sysHeader: 'System components',
    incidentsTitle: 'Active incidents',
    incidentsBody: 'No ongoing incidents.',
    historyTitle: 'Incident history',
    historyBody:
      'A detailed incident history will appear here as we accumulate data. So far we have no registered outages.',
    components: COMPONENTS_EN,
  },
} as const;

export default function StatusPage() {
  return (
    <PageShell>
      {(lang: Lang) => {
        const t = COPY[lang];
        return (
          <ArticleBody
            title={t.title}
            updatedLabel={t.updatedLabel}
            updatedDate={t.updatedDate}
            body={
              <>
                <p>{t.intro}</p>
                <h2 style={{ marginTop: 36, fontSize: 24, fontWeight: 600 }}>{t.sysHeader}</h2>
                <ul style={{ listStyle: 'none', padding: 0, margin: '20px 0 0', display: 'grid', gap: 10 }}>
                  {t.components.map(([name, st]) => (
                    <li
                      key={name}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '14px 18px',
                        borderRadius: 12,
                        background: 'rgba(10,10,20,0.6)',
                        border: '1px solid rgba(0,245,255,0.1)',
                      }}
                    >
                      <span>{name}</span>
                      <span
                        className="tag tag-live"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
                      >
                        <span className="dot" />
                        {st}
                      </span>
                    </li>
                  ))}
                </ul>
                <h2 style={{ marginTop: 36, fontSize: 24, fontWeight: 600 }}>{t.incidentsTitle}</h2>
                <p>{t.incidentsBody}</p>
                <h2 style={{ marginTop: 36, fontSize: 24, fontWeight: 600 }}>{t.historyTitle}</h2>
                <p>{t.historyBody}</p>
              </>
            }
          />
        );
      }}
    </PageShell>
  );
}

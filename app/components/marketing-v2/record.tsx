'use client';

import type { Lang } from '../marketing/types';
import type { MarketingStats } from '@/lib/marketing-stats';
import { daysSinceLaunch, fmtPct, fmtUsd } from '@/lib/marketing-format';
import { EquityChart } from './equity-chart';
import { EditionLine } from './edition-line';
import { SourceNote } from './source-note';

const RECORD_COPY: Record<Lang, {
  eye: string;
  titlePre: string;
  titleEm: string;
  titlePost: string;
  lede: string;
  ledeNoData: string;
  /** Label for the return KPI — states the actual measurement window (YTD). */
  kpiYtd: string;
  /** Separate day-counter line in the same KPI block. */
  kpiDays: (n: number) => string;
  kpiDrawdown: string;
  kpiCapital: string;
  kpiPositions: string;
  kpiSource: string;
  kpiSourceVal: string;
  legendApex: string;
  liveTag: string;
  emptyChart: string;
}> = {
  no: {
    eye: '04 · Resultater',
    titlePre: 'Disiplin ',
    titleEm: 'mot',
    titlePost: ' markedet.',
    lede: 'Apex Quantum kjører live på Alpaca paper trading. Tallene under speiles direkte fra leder-kontoens cockpit — ingen prototyper, ingen tilbakeberegnede backtests.',
    ledeNoData: 'Live-tall fra leder-kontoen blir publisert her så snart cockpit-data er tilgjengelig.',
    kpiYtd: 'Avkastning i år (YTD) · paper',
    kpiDays: (n) => `${n} dager siden oppstart`,
    kpiDrawdown: 'Maks drawdown',
    kpiCapital: 'Forvaltet kapital',
    kpiPositions: 'Aktive posisjoner',
    kpiSource: 'Datakilde',
    kpiSourceVal: 'ALPACA · PAPER',
    legendApex: 'Apex Quantum',
    liveTag: 'LIVE · PAPER',
    emptyChart: 'Historikk bygges dag for dag — ingen tilbakeberegnede tall.',
  },
  en: {
    eye: '04 · Track Record',
    titlePre: 'Discipline ',
    titleEm: 'against',
    titlePost: ' the market.',
    lede: 'Apex Quantum runs live on Alpaca paper trading. The numbers below mirror the leader account’s cockpit directly — no prototypes, no back-tested figures.',
    ledeNoData: 'Live numbers from the leader account will appear here as soon as cockpit data is available.',
    kpiYtd: 'Return this year (YTD) · paper',
    kpiDays: (n) => `${n} days since launch`,
    kpiDrawdown: 'Max drawdown',
    kpiCapital: 'Capital under model',
    kpiPositions: 'Active positions',
    kpiSource: 'Data source',
    kpiSourceVal: 'ALPACA · PAPER',
    legendApex: 'Apex Quantum',
    liveTag: 'LIVE · PAPER',
    emptyChart: 'History is built day by day — no back-calculated figures.',
  },
};

export function RecordV2({ lang, stats }: { lang: Lang; stats: MarketingStats }) {
  const t = RECORD_COPY[lang];
  const ytdUp = (stats.ytdReturnPct ?? 0) >= 0;
  return (
    <section id="record" className="record" data-reveal>
      <div className="container">
        <div className="record-grid">
          <div>
            <span className="eyebrow"><span className="rule" />{t.eye}</span>
            {/* Morgenutgaven (§5.5) — redaksjonelt tidsanker i seksjonshodet */}
            <div className="record-edition">
              <EditionLine lang={lang} />
            </div>
            <h2>{t.titlePre}<em>{t.titleEm}</em>{t.titlePost}</h2>
            <p className="record-lede">{stats.ok ? t.lede : t.ledeNoData}</p>
            {/* Stat-listen rendres ALLTID (ingen layout-hopp, §13.7):
                verdier «—» ved manglende data, maks drawdown alltid synlig. */}
            <div className="record-stats">
              <div className="record-stat">
                <span className="record-stat-lab">{t.kpiYtd}</span>
                <span className={`record-stat-val${stats.ok && stats.ytdReturnPct != null ? (ytdUp ? ' up' : ' dn') : ''}`}>
                  {fmtPct(stats.ok ? stats.ytdReturnPct : null, lang)}
                  {stats.ok && <SourceNote lang={lang} asOfIso={stats.asOfIso} />}
                </span>
                {/* Dagteller i eget element (funn 24) — suppressHydrationWarning
                    fordi Date.now() kan krysse døgnskiftet mellom SSR og klient. */}
                <span className="record-stat-lab" suppressHydrationWarning>
                  {t.kpiDays(daysSinceLaunch())}
                </span>
              </div>
              <div className="record-stat">
                <span className="record-stat-lab">{t.kpiDrawdown}</span>
                <span className="record-stat-val">
                  {!stats.ok || stats.maxDrawdownPct == null
                    ? '—'
                    : `−${stats.maxDrawdownPct.toFixed(1).replace('.', lang === 'no' ? ',' : '.')} %`}
                </span>
              </div>
              <div className="record-stat">
                <span className="record-stat-lab">{t.kpiCapital}</span>
                <span className="record-stat-val gold">{fmtUsd(stats.ok ? stats.totalValue : null, lang)}</span>
              </div>
              <div className="record-stat">
                <span className="record-stat-lab">{t.kpiPositions}</span>
                <span className="record-stat-val">{stats.ok ? (stats.positionsHeld ?? '—') : '—'}</span>
              </div>
              <div className="record-stat">
                <span className="record-stat-lab">{t.kpiSource}</span>
                <span className="record-stat-val src">{t.kpiSourceVal}</span>
              </div>
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 16 }}>
              <span className="record-legend">
                <span className="swatch-solid" style={{ background: 'var(--aq-gold)' }} />
                {t.legendApex}
              </span>
              <span className="aqv2-tag cy"><span className="aqv2-dot" />{t.liveTag}</span>
            </div>
            {stats.ok && stats.hasChart ? (
              <EquityChart history={stats.equityHistory} timestampsMs={stats.equityTimestampsMs} lang={lang} />
            ) : (
              /* Ærlig tomhet (§5.7) i identiske chartdimensjoner —
                 svakhet snudd til integritetspoeng (§8-04i). */
              <div className="record-hatch aq-hatch">{t.emptyChart}</div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

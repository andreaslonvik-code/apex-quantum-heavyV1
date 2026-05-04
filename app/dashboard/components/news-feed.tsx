'use client';

import { I18N, type Lang } from './i18n';

export interface NewsFeedEvent {
  ticker: string;
  direction: 'bullish' | 'bearish';
  weight: number;
  source: 'news' | 'social' | 'rumor' | 'macro';
  reason: string;
  held: boolean;
  elite: boolean;
}

export interface NewsFeedMacroEvent {
  ticker: string;
  direction: 'bullish' | 'bearish';
  weight: number;
  reason: string;
}

export interface AiThesisPick {
  ticker: string;
  reasoning: string;
  held: boolean;
}

export interface AiThesisPayload {
  selectedAt: string;
  thesis: string;
  riskRead: 'normal' | 'risk-on' | 'risk-off' | 'crash-warning';
  confidence: number;
  source: string;
  picks: AiThesisPick[];
}

export interface NewsFeedPayload {
  scannedAt: string | null;
  summary: string;
  riskMode: 'normal' | 'risk-on' | 'risk-off' | 'crash-warning';
  sectorBias?: Record<string, number>;
  confidence: number;
  events: NewsFeedEvent[];
  macroEvents: NewsFeedMacroEvent[];
  aiThesis?: AiThesisPayload | null;
}

interface Props {
  lang: Lang;
  feed: NewsFeedPayload | null;
}

const RISK_MODE_LABEL: Record<NewsFeedPayload['riskMode'], { no: string; en: string; cls: string }> = {
  'risk-on': { no: 'RISK PÅ', en: 'RISK ON', cls: 'rm-on' },
  normal: { no: 'NORMAL', en: 'NORMAL', cls: 'rm-normal' },
  'risk-off': { no: 'RISK AV', en: 'RISK OFF', cls: 'rm-off' },
  'crash-warning': { no: 'KRAKK-VARSEL', en: 'CRASH WARNING', cls: 'rm-crash' },
};

const SOURCE_LABEL: Record<NewsFeedEvent['source'], { no: string; en: string }> = {
  news: { no: 'NYHET', en: 'NEWS' },
  social: { no: 'X', en: 'X' },
  rumor: { no: 'RYKTE', en: 'RUMOR' },
  macro: { no: 'MAKRO', en: 'MACRO' },
};

function formatScannedAt(iso: string | null, lang: Lang): string {
  if (!iso) return lang === 'no' ? 'Ingen skann ennå' : 'No scan yet';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const minutesAgo = Math.floor((Date.now() - d.getTime()) / 60_000);
  if (minutesAgo < 1) return lang === 'no' ? 'Akkurat nå' : 'Just now';
  if (minutesAgo < 60) return lang === 'no' ? `${minutesAgo} min siden` : `${minutesAgo} min ago`;
  const hoursAgo = Math.floor(minutesAgo / 60);
  return lang === 'no' ? `${hoursAgo} t siden` : `${hoursAgo}h ago`;
}

export function NewsFeed({ lang, feed }: Props) {
  const t = I18N[lang];
  const hasFeed = !!feed && !!feed.scannedAt;
  const riskMode = feed?.riskMode ?? 'normal';
  const riskLabel = RISK_MODE_LABEL[riskMode];
  const events = feed?.events ?? [];
  const macroEvents = feed?.macroEvents ?? [];

  return (
    <div className="panel news-panel">
      <div className="panel-head">
        <div>
          <div className="cap">{lang === 'no' ? 'NYHETER & X-SENTIMENT' : 'NEWS & X SENTIMENT'}</div>
          <div className="panel-sub">
            {lang === 'no' ? 'Grok-4-Heavy skann hvert minutt i sesjon' : 'Grok-4-Heavy minute scan in session'}
            {hasFeed && ` · ${formatScannedAt(feed!.scannedAt, lang)}`}
            {hasFeed && feed!.confidence > 0 && (
              ` · ${(feed!.confidence * 100).toFixed(0)}% ${lang === 'no' ? 'konfidens' : 'confidence'}`
            )}
          </div>
        </div>
        <div className="panel-head-r">
          <span className={`tag risk-mode ${riskLabel.cls}`}>
            <span className="dot" />
            {lang === 'no' ? riskLabel.no : riskLabel.en}
          </span>
        </div>
      </div>

      {!hasFeed ? (
        <p className="panel-sub" style={{ padding: '12px 0' }}>
          {lang === 'no'
            ? 'Ingen ferske nyheter. Neste skann innen en time.'
            : 'No fresh news. Next scan within an hour.'}
        </p>
      ) : (
        <>
          {feed!.aiThesis && (
            <div className="ai-thesis">
              <div className="ai-thesis-head">
                <span className="ai-thesis-label">
                  {lang === 'no' ? 'AI-VURDERING' : 'AI THESIS'}
                </span>
                <span className="ai-thesis-meta aq-mono">
                  {feed!.aiThesis.source}
                  {feed!.aiThesis.confidence > 0 &&
                    ` · ${(feed!.aiThesis.confidence * 100).toFixed(0)}%`}
                </span>
              </div>
              <p className="ai-thesis-text">{feed!.aiThesis.thesis}</p>
              {feed!.aiThesis.picks.length > 0 && (
                <div className="ai-picks">
                  {feed!.aiThesis.picks.map((p) => (
                    <div key={p.ticker} className="ai-pick">
                      <div className="ai-pick-head">
                        <span className="news-ticker">{p.ticker}</span>
                        {p.held && (
                          <span className="news-tag news-tag-held">
                            {lang === 'no' ? 'EID' : 'HELD'}
                          </span>
                        )}
                      </div>
                      <span className="ai-pick-reason">{p.reasoning}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {feed!.summary && (
            <p className="news-summary">
              {feed!.summary}
            </p>
          )}

          {macroEvents.length > 0 && (
            <div className="news-section">
              <div className="news-section-head">
                {lang === 'no' ? 'Makro-hendelser' : 'Macro events'}
              </div>
              {macroEvents.map((e, i) => (
                <div key={`m-${i}`} className="news-event news-event-macro">
                  <span className={`news-dir ${e.direction === 'bullish' ? 'up' : 'dn'}`}>
                    {e.direction === 'bullish' ? '▲' : '▼'}
                  </span>
                  <div className="news-event-body">
                    <span className="news-ticker">{e.ticker}</span>
                    <span className="news-reason">{e.reason}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {events.length > 0 ? (
            <div className="news-section">
              <div className="news-section-head">
                {lang === 'no' ? 'Aktiv portefølje' : 'Active portfolio'}
              </div>
              {events.map((e, i) => (
                <div key={`e-${i}`} className={`news-event news-event-${e.direction}`}>
                  <span className={`news-dir ${e.direction === 'bullish' ? 'up' : 'dn'}`}>
                    {e.direction === 'bullish' ? '▲' : '▼'}
                  </span>
                  <div className="news-event-body">
                    <div className="news-event-head">
                      <span className="news-ticker">{e.ticker}</span>
                      {e.held && (
                        <span className="news-tag news-tag-held">
                          {lang === 'no' ? 'EID' : 'HELD'}
                        </span>
                      )}
                      {e.elite && (
                        <span className="news-tag news-tag-elite">ELITE</span>
                      )}
                      <span className={`news-tag news-tag-source news-tag-source-${e.source}`}>
                        {SOURCE_LABEL[e.source][lang]}
                      </span>
                      <span className="news-weight aq-mono">
                        {(e.weight * 100).toFixed(0)}%
                      </span>
                    </div>
                    <span className="news-reason">{e.reason}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : macroEvents.length === 0 ? (
            <p className="panel-sub" style={{ padding: '12px 0' }}>
              {lang === 'no'
                ? 'Ingen materielle hendelser på dine posisjoner siste skann.'
                : 'No material events on your positions in the last scan.'}
            </p>
          ) : null}
        </>
      )}
      {/* unused i18n reference kept for parity with other panels */}
      <span style={{ display: 'none' }}>{t.streaming}</span>
    </div>
  );
}

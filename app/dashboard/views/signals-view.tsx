'use client';

import { useMemo, useState } from 'react';
import type { PlusLang } from '@/lib/i18n/plus-lang';
import { PLUS_WATCHLIST, type PlusRegion } from '@/lib/blueprints/plus';
import { type PlusAction, SEED_SIGNALS } from './seed-signals';
import { useOwnedTickers } from './use-owned-tickers';

const COPY = {
  no: {
    eye: 'I DAG',
    title: 'Dagens signaler',
    sub: 'AI-genererte signaler fra global watchlist, drevet av en blueprint utviklet over et år for ekspertise i aksjeanalyse. Hver med begrunnelse, katalysatorer og risiko — slik at du forstår *hvorfor*, ikke bare *hva*.',
    allRegions: 'Alle regioner',
    catalysts: 'Katalysatorer',
    risks: 'Risikofaktorer',
    horizon: 'Tidshorisont',
    confidence: 'Konfidens',
    horizons: { short: 'Kort (uker)', medium: 'Medium (måneder)', long: 'Lang (kvartaler)' },
    actions: { BUY: 'KJØP', SELL: 'SELG', HOLD: 'HOLD', WATCH: 'OBSERVÉR' },
    actionExplain: {
      BUY: 'Asymmetrisk oppside og gunstig timing for ny posisjon.',
      SELL: 'Risk/reward har blitt negativt — vurder å redusere posisjonen din.',
      HOLD: 'Behold posisjonen — fundamentene er fortsatt OK. Kun relevant hvis du eier aksjen.',
      WATCH: 'Ikke handlingsklart ennå. Sett opp varsler og følg utviklingen.',
    },
    ownedToggle: 'Marker som eid',
    ownedActive: 'Eid ✓',
    ownershipBannerTitle: 'Dette signalet er kun relevant hvis du eier aksjen',
    ownershipBannerSub:
      'HOLD og SELG-signaler refererer til aksjer du allerede har i porteføljen. Marker som eid for å aktivere personlige anbefalinger.',
    ownershipBannerCta: 'Marker som eid',
    disclaimer:
      'Apex Quantum + er en lærings- og analyseplattform. Innholdet er ikke individuell investeringsrådgivning. Tidligere resultater er ingen garanti for fremtidige resultater.',
    seedNote: 'Demonstrasjonssignaler — den ekte AI-pipelinen kobles på når daglig signal-jobb er live.',
  },
  en: {
    eye: 'TODAY',
    title: "Today's signals",
    sub: 'AI-generated signals from the global watchlist, driven by a blueprint developed over a year for stock-analysis expertise. Each with reasoning, catalysts and risk — so you understand the *why*, not just the *what*.',
    allRegions: 'All regions',
    catalysts: 'Catalysts',
    risks: 'Risks',
    horizon: 'Time horizon',
    confidence: 'Confidence',
    horizons: { short: 'Short (weeks)', medium: 'Medium (months)', long: 'Long (quarters)' },
    actions: { BUY: 'BUY', SELL: 'SELL', HOLD: 'HOLD', WATCH: 'WATCH' },
    actionExplain: {
      BUY: 'Asymmetric upside and favorable timing for a new position.',
      SELL: 'Risk/reward has shifted negative — consider trimming your position.',
      HOLD: 'Keep the position — fundamentals still intact. Only relevant if you own the stock.',
      WATCH: 'Not actionable yet. Set up alerts and follow the situation.',
    },
    ownedToggle: 'Mark as owned',
    ownedActive: 'Owned ✓',
    ownershipBannerTitle: 'This signal is only relevant if you own the stock',
    ownershipBannerSub:
      'HOLD and SELL signals refer to stocks you already have in your portfolio. Mark as owned to activate personalized recommendations.',
    ownershipBannerCta: 'Mark as owned',
    disclaimer:
      'Apex Quantum + is a learning and analysis platform. Content is not individual investment advice. Past performance is no guarantee of future results.',
    seedNote: 'Demonstration signals — the real AI pipeline activates once the daily signal job is live.',
  },
  de: {
    eye: 'HEUTE',
    title: 'Signale heute',
    sub: 'KI-generierte Signale aus der globalen Watchlist, getragen von einem über ein Jahr entwickelten Blueprint für Aktienanalyse-Expertise. Jedes mit Begründung, Katalysatoren und Risiken — damit Sie das *Warum* verstehen, nicht nur das *Was*.',
    allRegions: 'Alle Regionen',
    catalysts: 'Katalysatoren',
    risks: 'Risiken',
    horizon: 'Zeithorizont',
    confidence: 'Konfidenz',
    horizons: { short: 'Kurz (Wochen)', medium: 'Mittel (Monate)', long: 'Lang (Quartale)' },
    actions: { BUY: 'KAUFEN', SELL: 'VERKAUFEN', HOLD: 'HALTEN', WATCH: 'BEOBACHTEN' },
    actionExplain: {
      BUY: 'Asymmetrische Aufwärts­bewegung und günstiges Timing für eine neue Position.',
      SELL: 'Risk/Reward hat sich negativ verschoben — Reduzierung erwägen.',
      HOLD: 'Position halten — Fundamentaldaten weiterhin intakt. Nur relevant wenn Sie die Aktie besitzen.',
      WATCH: 'Noch nicht handlungsbereit. Alerts einrichten und Entwicklung verfolgen.',
    },
    ownedToggle: 'Als gehalten markieren',
    ownedActive: 'Gehalten ✓',
    ownershipBannerTitle: 'Dieses Signal ist nur relevant, wenn Sie die Aktie besitzen',
    ownershipBannerSub:
      'HOLD- und SELL-Signale beziehen sich auf Aktien, die Sie bereits im Portfolio haben. Als gehalten markieren, um personalisierte Empfehlungen zu aktivieren.',
    ownershipBannerCta: 'Als gehalten markieren',
    disclaimer:
      'Apex Quantum + ist eine Lern- und Analyseplattform. Inhalte sind keine individuelle Anlageberatung. Frühere Ergebnisse sind keine Garantie für künftige.',
    seedNote: 'Demo-Signale — die echte KI-Pipeline läuft, sobald der tägliche Signal-Job live ist.',
  },
  es: {
    eye: 'HOY',
    title: 'Señales de hoy',
    sub: 'Señales generadas por IA de la lista global, impulsadas por un blueprint desarrollado durante un año para experiencia en análisis bursátil. Cada una con razonamiento, catalizadores y riesgos — para que entiendas el *por qué*, no solo el *qué*.',
    allRegions: 'Todas las regiones',
    catalysts: 'Catalizadores',
    risks: 'Riesgos',
    horizon: 'Horizonte temporal',
    confidence: 'Confianza',
    horizons: { short: 'Corto (semanas)', medium: 'Medio (meses)', long: 'Largo (trimestres)' },
    actions: { BUY: 'COMPRAR', SELL: 'VENDER', HOLD: 'MANTENER', WATCH: 'OBSERVAR' },
    actionExplain: {
      BUY: 'Asimetría positiva y momento favorable para nueva posición.',
      SELL: 'Riesgo/beneficio se ha vuelto negativo — considera reducir.',
      HOLD: 'Mantener posición — fundamentos siguen sólidos. Solo relevante si posees la acción.',
      WATCH: 'Aún no accionable. Configura alertas y sigue la evolución.',
    },
    ownedToggle: 'Marcar como en cartera',
    ownedActive: 'En cartera ✓',
    ownershipBannerTitle: 'Esta señal solo es relevante si posees la acción',
    ownershipBannerSub:
      'Las señales HOLD y SELL se refieren a acciones que ya tienes en cartera. Marca como en cartera para recomendaciones personalizadas.',
    ownershipBannerCta: 'Marcar como en cartera',
    disclaimer:
      'Apex Quantum + es una plataforma de aprendizaje y análisis. El contenido no es asesoramiento de inversión individual. Resultados pasados no garantizan resultados futuros.',
    seedNote: 'Señales de demostración — el pipeline IA real se activa cuando el job diario de señales esté en vivo.',
  },
  zh: {
    eye: '今日',
    title: '今日信号',
    sub: 'AI 从全球观察清单生成的信号，由历经一年精心打造、专注于股票分析的蓝图驱动；附带推理、催化剂与风险——让你理解*为什么*，而不仅仅是*什么*。',
    allRegions: '所有地区',
    catalysts: '催化剂',
    risks: '风险',
    horizon: '时间范围',
    confidence: '信心',
    horizons: { short: '短期（周）', medium: '中期（月）', long: '长期（季度）' },
    actions: { BUY: '买入', SELL: '卖出', HOLD: '持有', WATCH: '观察' },
    actionExplain: {
      BUY: '不对称上行空间与有利的建仓时机。',
      SELL: '风险/回报已转负——考虑减仓。',
      HOLD: '继续持有——基本面依然稳健。仅在你已持有该股时相关。',
      WATCH: '尚不可操作。设置提醒，关注后续。',
    },
    ownedToggle: '标记为已持有',
    ownedActive: '已持有 ✓',
    ownershipBannerTitle: '此信号仅在你已持有该股时相关',
    ownershipBannerSub:
      'HOLD 与 SELL 信号针对你已经持有的股票。标记为已持有以启用个性化建议。',
    ownershipBannerCta: '标记为已持有',
    disclaimer:
      'Apex Quantum + 是学习与分析平台。内容非个人投资建议。过往业绩不保证未来表现。',
    seedNote: '演示信号——真实 AI 管线将在每日信号任务上线后启用。',
  },
} as const;

const REGION_LABELS: Record<PlusLang, Record<PlusRegion, string>> = {
  no: { NO: 'Norge', EU: 'Europa', US: 'USA', TW: 'Taiwan', KR: 'Korea', JP: 'Japan', HK: 'Hongkong', IN: 'India' },
  en: { NO: 'Norway', EU: 'Europe', US: 'USA', TW: 'Taiwan', KR: 'Korea', JP: 'Japan', HK: 'Hong Kong', IN: 'India' },
  de: { NO: 'Norwegen', EU: 'Europa', US: 'USA', TW: 'Taiwan', KR: 'Korea', JP: 'Japan', HK: 'Hongkong', IN: 'Indien' },
  es: { NO: 'Noruega', EU: 'Europa', US: 'EEUU', TW: 'Taiwán', KR: 'Corea', JP: 'Japón', HK: 'Hong Kong', IN: 'India' },
  zh: { NO: '挪威', EU: '欧洲', US: '美国', TW: '台湾', KR: '韩国', JP: '日本', HK: '香港', IN: '印度' },
};

const REGIONS: PlusRegion[] = ['NO', 'EU', 'US', 'TW', 'KR', 'JP', 'HK', 'IN'];

const ACTION_PRIORITY: Record<PlusAction, number> = { BUY: 0, SELL: 1, WATCH: 2, HOLD: 3 };

export function SignalsView({ lang }: { lang: PlusLang }) {
  const t = COPY[lang];
  const [region, setRegion] = useState<PlusRegion | 'ALL'>('ALL');
  const { isOwned, toggle } = useOwnedTickers();

  const filtered = useMemo(() => {
    const list = region === 'ALL' ? SEED_SIGNALS : SEED_SIGNALS.filter((s) => s.region === region);
    return [...list].sort((a, b) => {
      const ap = ACTION_PRIORITY[a.action];
      const bp = ACTION_PRIORITY[b.action];
      if (ap !== bp) return ap - bp;
      return b.confidence - a.confidence;
    });
  }, [region]);

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

      <div className="aqp-filter-row">
        <button
          type="button"
          className={`aqp-chip ${region === 'ALL' ? 'is-on' : ''}`}
          onClick={() => setRegion('ALL')}
        >
          {t.allRegions}
        </button>
        {REGIONS.map((r) => {
          const count = SEED_SIGNALS.filter((s) => s.region === r).length;
          if (count === 0) return null;
          return (
            <button
              key={r}
              type="button"
              className={`aqp-chip ${region === r ? 'is-on' : ''}`}
              onClick={() => setRegion(r)}
            >
              {REGION_LABELS[lang][r]} <span className="aqp-chip-count">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="aqp-seed-note">{t.seedNote}</div>

      <div className="aqp-signal-stack">
        {filtered.map((s) => {
          const meta = PLUS_WATCHLIST.find((w) => w.ticker === s.ticker);
          const owned = isOwned(s.ticker);
          const requiresOwnership = s.action === 'HOLD' || s.action === 'SELL';
          const showOwnershipBanner = requiresOwnership && !owned;
          const isBuy = s.action === 'BUY';

          return (
            <article
              key={s.id}
              className={`aqp-signal-card aqp-signal-card--${s.action.toLowerCase()}`}
            >
              <header className="aqp-signal-head">
                <div className="aqp-signal-id">
                  <div className="aqp-ticker">{s.ticker}</div>
                  <div className="aqp-ticker-name">{meta?.name ?? s.ticker}</div>
                </div>
                <div className="aqp-signal-actions">
                  <button
                    type="button"
                    className={`aqp-owned-toggle ${owned ? 'is-on' : ''}`}
                    onClick={() => toggle(s.ticker)}
                  >
                    {owned ? t.ownedActive : t.ownedToggle}
                  </button>
                  <div className={`aqp-action-pill aqp-action-pill--${s.action.toLowerCase()} ${isBuy ? 'aqp-action-pill--lg' : ''}`}>
                    {t.actions[s.action]}
                  </div>
                </div>
              </header>

              <div className="aqp-action-explain">{t.actionExplain[s.action]}</div>

              <div className="aqp-signal-meta">
                <span className="aqp-meta-item">
                  <span className="aqp-meta-key">{REGION_LABELS[lang][s.region]}</span>
                </span>
                <span className="aqp-meta-sep">·</span>
                <span className="aqp-meta-item">
                  <span className="aqp-meta-key">{t.confidence}:</span>{' '}
                  <span className="aqp-meta-val">{s.confidence}%</span>
                </span>
                <span className="aqp-meta-sep">·</span>
                <span className="aqp-meta-item">
                  <span className="aqp-meta-key">{t.horizon}:</span>{' '}
                  <span className="aqp-meta-val">{t.horizons[s.timeHorizon]}</span>
                </span>
              </div>

              {showOwnershipBanner && (
                <div className="aqp-own-banner">
                  <div className="aqp-own-banner-title">{t.ownershipBannerTitle}</div>
                  <div className="aqp-own-banner-sub">{t.ownershipBannerSub}</div>
                  <button
                    type="button"
                    className="aqp-own-banner-cta"
                    onClick={() => toggle(s.ticker)}
                  >
                    {t.ownershipBannerCta}
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              )}

              <p className="aqp-signal-reasoning">{s.reasoning[lang]}</p>

              <div className="aqp-signal-grid">
                <div className="aqp-signal-block">
                  <div className="aqp-block-head">
                    <span className="aqp-block-dot aqp-block-dot--catalyst" />
                    {t.catalysts}
                  </div>
                  <ul className="aqp-block-list">
                    {s.catalysts[lang].map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
                <div className="aqp-signal-block">
                  <div className="aqp-block-head">
                    <span className="aqp-block-dot aqp-block-dot--risk" />
                    {t.risks}
                  </div>
                  <ul className="aqp-block-list">
                    {s.risks[lang].map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <p className="aqp-disclaimer">{t.disclaimer}</p>
    </div>
  );
}

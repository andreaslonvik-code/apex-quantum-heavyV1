'use client';

import { useEffect, useMemo, useState } from 'react';
import type { PlusLang } from '@/lib/i18n/plus-lang';
import { PLUS_WATCHLIST, type PlusRegion } from '@/lib/blueprints/plus';
import { type PlusAction, SEED_SIGNALS } from './seed-signals';
import { useOwnedTickers } from './use-owned-tickers';
import { EditionRow } from './edition-row';

interface DisplaySignal {
  id: string;
  ticker: string;
  region: PlusRegion;
  action: PlusAction;
  confidence: number;
  timeHorizon: 'short' | 'medium' | 'long';
  reasoning: string;
  catalysts: string[];
  risks: string[];
  peerComparison?: string | null;
  insiderSignal?: string | null;
  priceAtSignal?: number | null;
  priceCurrency?: string | null;
  createdAt?: string;
}

interface LivePrice {
  price: number;
  currency: string;
  previousClose: number | null;
  changeFromPrevClose: number | null;
}

interface TrackRecord {
  total: number;
  closed: number;
  open: number;
  wins: number;
  losses: number;
  winRate: number | null;
  avgWinPct: number | null;
  avgLossPct: number | null;
}

interface ScanMeta {
  generatedAt: string | null;
  scanSummary: string | null;
  isReal: boolean;
}

const COPY = {
  no: {
    eye: 'I DAG',
    title: 'Dagens signaler',
    sub: 'AI-genererte signaler fra global watchlist, drevet av en blueprint utviklet over et år for ekspertise i aksjeanalyse. Hver med begrunnelse, katalysatorer og risiko — slik at du forstår *hvorfor*, ikke bare *hva*.',
    allRegions: 'Alle regioner',
    allActions: 'Alle signaler',
    catalysts: 'Katalysatorer',
    risks: 'Risikofaktorer',
    horizon: 'Tidshorisont',
    confidence: 'Konfidens',
    horizons: { short: 'Kort (uker)', medium: 'Medium (måneder)', long: 'Lang (kvartaler)' },
    actions: { BUY: 'KJØP', SELL: 'SELG', HOLD: 'HOLD', WATCH: 'OBSERVÉR' },
    convictionFilter: 'Kun høy konfidens (≥80%)',
    actionMixLabel: 'I dag',
    ownedSection: 'Du eier',
    regionPositionsOne: 'posisjon',
    regionPositionsMany: 'posisjoner',
    sinceSignal: 'siden signal',
    livePriceLabel: 'Live',
    trackRecordEye: 'Track-record siste 30 dager',
    trackRecordWinRate: 'Treffprosent',
    trackRecordWins: 'vinnere',
    trackRecordLosses: 'tapere',
    trackRecordOpen: 'åpne',
    trackRecordAvgWin: 'snitt på vinner',
    trackRecordAvgLoss: 'snitt på taper',
    trackRecordEmpty:
      'Track-record bygges opp etter hvert som nye signaler lukkes (≥7 dager gamle). Sjekk tilbake snart.',
    actionExplain: {
      BUY: 'Asymmetrisk oppside og gunstig timing for ny posisjon.',
      SELL: 'Risk/reward har blitt negativt — vurder å redusere posisjonen din.',
      HOLD: 'Behold posisjonen — fundamentene er fortsatt OK. Kun relevant hvis du eier aksjen.',
      WATCH: 'Ikke handlingsklart ennå. Sett opp varsler og følg utviklingen.',
    },
    ownedToggle: 'Marker som eid',
    ownedActive: 'Eid ✓',
    peerLabel: 'Mot peers',
    insiderLabel: 'Innsidesignal',
    ownershipBannerTitle: 'Dette signalet er kun relevant hvis du eier aksjen',
    ownershipBannerSub:
      'HOLD og SELG-signaler refererer til aksjer du allerede har i porteføljen. Marker som eid for å aktivere personlige anbefalinger.',
    ownershipBannerCta: 'Marker som eid',
    disclaimer:
      'Apex Quantum + er en lærings- og analyseplattform. Innholdet er ikke individuell investeringsrådgivning. Tidligere resultater er ingen garanti for fremtidige resultater.',
    seedNote:
      'Demonstrasjonssignaler — den ekte AI-pipelinen kobles på når daglig signal-jobb er live.',
    refreshInfo: (last: string, next: string) =>
      `Sist oppdatert ${last} · neste skann kl. ${next} (kjøres hver hele time)`,
    nowSummary: 'Dagens markedssituasjon',
    loading: 'Henter dagens signaler…',
    empty: 'Ingen signaler ennå. Neste skann kjører ved neste hele time.',
    refresh: 'Oppdater',
    noteOnLang: 'Signaler genereres på norsk. Oversettelse til andre språk kommer snart.',
    dayEye: 'Dagens bilde',
    dayNew: 'Nye signaler',
    dayHit: 'Treffprosent 30 d',
    dayNext: 'Neste skann',
    openDetails: 'Vis detaljer for',
    close: 'Lukk',
  },
  en: {
    eye: 'TODAY',
    title: "Today's signals",
    sub: 'AI-generated signals from the global watchlist, driven by a blueprint developed over a year for stock-analysis expertise. Each with reasoning, catalysts and risk — so you understand the *why*, not just the *what*.',
    allRegions: 'All regions',
    allActions: 'All signals',
    catalysts: 'Catalysts',
    risks: 'Risks',
    horizon: 'Time horizon',
    confidence: 'Confidence',
    horizons: { short: 'Short (weeks)', medium: 'Medium (months)', long: 'Long (quarters)' },
    actions: { BUY: 'BUY', SELL: 'SELL', HOLD: 'HOLD', WATCH: 'WATCH' },
    convictionFilter: 'High conviction only (≥80%)',
    actionMixLabel: 'Today',
    ownedSection: 'You own',
    regionPositionsOne: 'position',
    regionPositionsMany: 'positions',
    sinceSignal: 'since signal',
    livePriceLabel: 'Live',
    trackRecordEye: 'Track record · last 30 days',
    trackRecordWinRate: 'Win rate',
    trackRecordWins: 'wins',
    trackRecordLosses: 'losses',
    trackRecordOpen: 'open',
    trackRecordAvgWin: 'avg win',
    trackRecordAvgLoss: 'avg loss',
    trackRecordEmpty:
      'Track record builds up as new signals close (after ≥7 days). Check back soon.',
    actionExplain: {
      BUY: 'Asymmetric upside and favorable timing for a new position.',
      SELL: 'Risk/reward has shifted negative — consider trimming your position.',
      HOLD: 'Keep the position — fundamentals still intact. Only relevant if you own the stock.',
      WATCH: 'Not actionable yet. Set up alerts and follow the situation.',
    },
    ownedToggle: 'Mark as owned',
    ownedActive: 'Owned ✓',
    peerLabel: 'Vs peers',
    insiderLabel: 'Insider signal',
    ownershipBannerTitle: 'This signal is only relevant if you own the stock',
    ownershipBannerSub:
      'HOLD and SELL signals refer to stocks you already have in your portfolio. Mark as owned to activate personalized recommendations.',
    ownershipBannerCta: 'Mark as owned',
    disclaimer:
      'Apex Quantum + is a learning and analysis platform. Content is not individual investment advice. Past performance is no guarantee of future results.',
    seedNote: 'Demonstration signals — the real AI pipeline activates once the daily signal job is live.',
    refreshInfo: (last: string, next: string) =>
      `Last updated ${last} · next scan at ${next} (runs every hour)`,
    nowSummary: "Today's market view",
    loading: "Fetching today's signals…",
    empty: 'No signals yet. Next scan runs at the top of the next hour.',
    refresh: 'Refresh',
    noteOnLang: 'Signals are generated in Norwegian. Translation to other languages coming soon.',
    dayEye: 'Today at a glance',
    dayNew: 'New signals',
    dayHit: 'Win rate 30 d',
    dayNext: 'Next scan',
    openDetails: 'Show details for',
    close: 'Close',
  },
  de: {
    eye: 'HEUTE',
    title: 'Signale heute',
    sub: 'KI-generierte Signale aus der globalen Watchlist, getragen von einem über ein Jahr entwickelten Blueprint für Aktienanalyse-Expertise. Jedes mit Begründung, Katalysatoren und Risiken — damit Sie das *Warum* verstehen, nicht nur das *Was*.',
    allRegions: 'Alle Regionen',
    allActions: 'Alle Signale',
    catalysts: 'Katalysatoren',
    risks: 'Risiken',
    horizon: 'Zeithorizont',
    confidence: 'Konfidenz',
    horizons: { short: 'Kurz (Wochen)', medium: 'Mittel (Monate)', long: 'Lang (Quartale)' },
    actions: { BUY: 'KAUFEN', SELL: 'VERKAUFEN', HOLD: 'HALTEN', WATCH: 'BEOBACHTEN' },
    convictionFilter: 'Nur hohe Konfidenz (≥80%)',
    actionMixLabel: 'Heute',
    ownedSection: 'Sie halten',
    regionPositionsOne: 'Position',
    regionPositionsMany: 'Positionen',
    sinceSignal: 'seit Signal',
    livePriceLabel: 'Live',
    trackRecordEye: 'Trefferquote · letzte 30 Tage',
    trackRecordWinRate: 'Trefferquote',
    trackRecordWins: 'Treffer',
    trackRecordLosses: 'Fehlschläge',
    trackRecordOpen: 'offen',
    trackRecordAvgWin: '⌀ Treffer',
    trackRecordAvgLoss: '⌀ Fehlschlag',
    trackRecordEmpty:
      'Die Trefferstatistik baut sich auf, sobald Signale älter als 7 Tage sind. Bald wieder vorbeischauen.',
    actionExplain: {
      BUY: 'Asymmetrische Aufwärts­bewegung und günstiges Timing für eine neue Position.',
      SELL: 'Risk/Reward hat sich negativ verschoben — Reduzierung erwägen.',
      HOLD: 'Position halten — Fundamentaldaten weiterhin intakt. Nur relevant wenn Sie die Aktie besitzen.',
      WATCH: 'Noch nicht handlungsbereit. Alerts einrichten und Entwicklung verfolgen.',
    },
    ownedToggle: 'Als gehalten markieren',
    ownedActive: 'Gehalten ✓',
    peerLabel: 'Vs. Peers',
    insiderLabel: 'Insider-Signal',
    ownershipBannerTitle: 'Dieses Signal ist nur relevant, wenn Sie die Aktie besitzen',
    ownershipBannerSub:
      'HOLD- und SELL-Signale beziehen sich auf Aktien, die Sie bereits im Portfolio haben. Als gehalten markieren, um personalisierte Empfehlungen zu aktivieren.',
    ownershipBannerCta: 'Als gehalten markieren',
    disclaimer:
      'Apex Quantum + ist eine Lern- und Analyseplattform. Inhalte sind keine individuelle Anlageberatung. Frühere Ergebnisse sind keine Garantie für künftige.',
    seedNote: 'Demo-Signale — die echte KI-Pipeline läuft, sobald der tägliche Signal-Job live ist.',
    refreshInfo: (last: string, next: string) =>
      `Zuletzt aktualisiert ${last} · nächster Scan um ${next} (stündlich)`,
    nowSummary: 'Heutige Marktsicht',
    loading: 'Lade heutige Signale…',
    empty: 'Noch keine Signale. Nächster Scan zur nächsten vollen Stunde.',
    refresh: 'Aktualisieren',
    noteOnLang: 'Signale werden auf Norwegisch generiert. Übersetzung in andere Sprachen folgt.',
    dayEye: 'Heute im Überblick',
    dayNew: 'Neue Signale',
    dayHit: 'Trefferquote 30 T',
    dayNext: 'Nächster Scan',
    openDetails: 'Details anzeigen für',
    close: 'Schließen',
  },
  es: {
    eye: 'HOY',
    title: 'Señales de hoy',
    sub: 'Señales generadas por IA de la lista global, impulsadas por un blueprint desarrollado durante un año para experiencia en análisis bursátil. Cada una con razonamiento, catalizadores y riesgos — para que entiendas el *por qué*, no solo el *qué*.',
    allRegions: 'Todas las regiones',
    allActions: 'Todas las señales',
    catalysts: 'Catalizadores',
    risks: 'Riesgos',
    horizon: 'Horizonte temporal',
    confidence: 'Confianza',
    horizons: { short: 'Corto (semanas)', medium: 'Medio (meses)', long: 'Largo (trimestres)' },
    actions: { BUY: 'COMPRAR', SELL: 'VENDER', HOLD: 'MANTENER', WATCH: 'OBSERVAR' },
    convictionFilter: 'Solo alta confianza (≥80%)',
    actionMixLabel: 'Hoy',
    ownedSection: 'En cartera',
    regionPositionsOne: 'posición',
    regionPositionsMany: 'posiciones',
    sinceSignal: 'desde señal',
    livePriceLabel: 'Live',
    trackRecordEye: 'Track record · últimos 30 días',
    trackRecordWinRate: 'Tasa de acierto',
    trackRecordWins: 'aciertos',
    trackRecordLosses: 'errores',
    trackRecordOpen: 'abiertos',
    trackRecordAvgWin: 'media acierto',
    trackRecordAvgLoss: 'media error',
    trackRecordEmpty:
      'El historial se construye a medida que las señales cierran (≥7 días). Vuelve pronto.',
    actionExplain: {
      BUY: 'Asimetría positiva y momento favorable para nueva posición.',
      SELL: 'Riesgo/beneficio se ha vuelto negativo — considera reducir.',
      HOLD: 'Mantener posición — fundamentos siguen sólidos. Solo relevante si posees la acción.',
      WATCH: 'Aún no accionable. Configura alertas y sigue la evolución.',
    },
    ownedToggle: 'Marcar como en cartera',
    ownedActive: 'En cartera ✓',
    peerLabel: 'Vs pares',
    insiderLabel: 'Señal interna',
    ownershipBannerTitle: 'Esta señal solo es relevante si posees la acción',
    ownershipBannerSub:
      'Las señales HOLD y SELL se refieren a acciones que ya tienes en cartera. Marca como en cartera para recomendaciones personalizadas.',
    ownershipBannerCta: 'Marcar como en cartera',
    disclaimer:
      'Apex Quantum + es una plataforma de aprendizaje y análisis. El contenido no es asesoramiento de inversión individual. Resultados pasados no garantizan resultados futuros.',
    seedNote: 'Señales de demostración — el pipeline IA real se activa cuando el job diario de señales esté en vivo.',
    refreshInfo: (last: string, next: string) =>
      `Actualizado ${last} · próximo escaneo a las ${next} (cada hora)`,
    nowSummary: 'Visión del mercado hoy',
    loading: 'Cargando señales de hoy…',
    empty: 'Aún no hay señales. Próximo escaneo a la próxima hora en punto.',
    refresh: 'Actualizar',
    noteOnLang: 'Las señales se generan en noruego. Traducción a otros idiomas próximamente.',
    dayEye: 'El día de hoy',
    dayNew: 'Señales nuevas',
    dayHit: 'Acierto 30 d',
    dayNext: 'Próximo escaneo',
    openDetails: 'Ver detalles de',
    close: 'Cerrar',
  },
  zh: {
    eye: '今日',
    title: '今日信号',
    sub: 'AI 从全球观察清单生成的信号，由历经一年精心打造、专注于股票分析的蓝图驱动；附带推理、催化剂与风险——让你理解*为什么*，而不仅仅是*什么*。',
    allRegions: '所有地区',
    allActions: '所有信号',
    catalysts: '催化剂',
    risks: '风险',
    horizon: '时间范围',
    confidence: '信心',
    horizons: { short: '短期（周）', medium: '中期（月）', long: '长期（季度）' },
    actions: { BUY: '买入', SELL: '卖出', HOLD: '持有', WATCH: '观察' },
    convictionFilter: '仅高信心 (≥80%)',
    actionMixLabel: '今日',
    ownedSection: '已持有',
    regionPositionsOne: '个仓位',
    regionPositionsMany: '个仓位',
    sinceSignal: '自信号以来',
    livePriceLabel: '实时',
    trackRecordEye: '过去 30 天战绩',
    trackRecordWinRate: '胜率',
    trackRecordWins: '胜',
    trackRecordLosses: '败',
    trackRecordOpen: '进行中',
    trackRecordAvgWin: '平均胜幅',
    trackRecordAvgLoss: '平均亏幅',
    trackRecordEmpty: '当信号关闭（≥7 天）后将累积战绩，请稍后再来。',
    actionExplain: {
      BUY: '不对称上行空间与有利的建仓时机。',
      SELL: '风险/回报已转负——考虑减仓。',
      HOLD: '继续持有——基本面依然稳健。仅在你已持有该股时相关。',
      WATCH: '尚不可操作。设置提醒，关注后续。',
    },
    ownedToggle: '标记为已持有',
    ownedActive: '已持有 ✓',
    peerLabel: '同业对比',
    insiderLabel: '内部信号',
    ownershipBannerTitle: '此信号仅在你已持有该股时相关',
    ownershipBannerSub:
      'HOLD 与 SELL 信号针对你已经持有的股票。标记为已持有以启用个性化建议。',
    ownershipBannerCta: '标记为已持有',
    disclaimer:
      'Apex Quantum + 是学习与分析平台。内容非个人投资建议。过往业绩不保证未来表现。',
    seedNote: '演示信号——真实 AI 管线将在每日信号任务上线后启用。',
    refreshInfo: (last: string, next: string) =>
      `最近更新 ${last} · 下次扫描 ${next}（每小时一次）`,
    nowSummary: '今日市场概览',
    loading: '加载今日信号…',
    empty: '暂无信号。下次扫描将在下一个整点运行。',
    refresh: '刷新',
    noteOnLang: '信号目前以挪威语生成，其他语言版本即将推出。',
    dayEye: '今日概览',
    dayNew: '新信号',
    dayHit: '30 天胜率',
    dayNext: '下次扫描',
    openDetails: '查看详情',
    close: '关闭',
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
// Display order for the per-exchange portfolio view: US first (main market for
// most signals), then NO (home market), then EU, then Asia regions.
const REGION_DISPLAY_ORDER: PlusRegion[] = ['US', 'NO', 'EU', 'TW', 'KR', 'JP', 'HK', 'IN'];
const ACTIONS: PlusAction[] = ['BUY', 'SELL', 'HOLD', 'WATCH'];
const ACTION_PRIORITY: Record<PlusAction, number> = { BUY: 0, SELL: 1, WATCH: 2, HOLD: 3 };

function formatRelative(iso: string, lang: PlusLang): string {
  const ms = Date.now() - Date.parse(iso);
  const min = Math.round(ms / 60_000);
  const labels = {
    no: ['nå nettopp', 'min siden', 'time siden', 'timer siden', 'dager siden'],
    en: ['just now', 'min ago', 'hour ago', 'hours ago', 'days ago'],
    de: ['gerade eben', 'Min. her', 'Std. her', 'Std. her', 'Tage her'],
    es: ['ahora mismo', 'min atrás', 'hora atrás', 'horas atrás', 'días atrás'],
    zh: ['刚刚', '分钟前', '小时前', '小时前', '天前'],
  } as const;
  const t = labels[lang];
  if (min < 1) return t[0];
  if (min < 60) return `${min} ${t[1]}`;
  const h = Math.round(min / 60);
  if (h < 2) return `${h} ${t[2]}`;
  if (h < 24) return `${h} ${t[3]}`;
  const d = Math.round(h / 24);
  return `${d} ${t[4]}`;
}

function formatNextUpdate(lang: PlusLang): string {
  // Hourly cron at minute 0. Next update = next top-of-hour in user's local time.
  const now = new Date();
  const next = new Date(now);
  next.setMinutes(0, 0, 0);
  next.setHours(now.getHours() + 1);
  const time = next.toLocaleTimeString(lang === 'zh' ? 'zh-CN' : lang, {
    hour: '2-digit',
    minute: '2-digit',
  });
  return time;
}

function seedToDisplay(lang: PlusLang): DisplaySignal[] {
  return SEED_SIGNALS.map((s) => ({
    id: s.id,
    ticker: s.ticker,
    region: s.region,
    action: s.action,
    confidence: s.confidence,
    timeHorizon: s.timeHorizon,
    reasoning: s.reasoning[lang],
    catalysts: s.catalysts[lang] as string[],
    risks: s.risks[lang] as string[],
  }));
}

export function SignalsView({ lang }: { lang: PlusLang }) {
  const t = COPY[lang];
  const [region, setRegion] = useState<PlusRegion | 'ALL'>('ALL');
  const [action, setAction] = useState<PlusAction | 'ALL'>('ALL');
  const [highConvictionOnly, setHighConvictionOnly] = useState(false);
  const [signals, setSignals] = useState<DisplaySignal[] | null>(null);
  const [meta, setMeta] = useState<ScanMeta>({ generatedAt: null, scanSummary: null, isReal: false });
  const [loading, setLoading] = useState(true);
  const [livePrices, setLivePrices] = useState<Record<string, LivePrice>>({});
  const [trackRecord, setTrackRecord] = useState<TrackRecord | null>(null);
  const [openTicker, setOpenTicker] = useState<string | null>(null);
  const { isOwned, toggle } = useOwnedTickers();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const apiLang = lang === 'no' ? 'no' : 'en';
        const res = await fetch(`/api/plus/signals/today?lang=${apiLang}`, {
          credentials: 'include',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        if (data.ok && Array.isArray(data.signals) && data.signals.length > 0) {
          setSignals(data.signals as DisplaySignal[]);
          setMeta({
            generatedAt: data.scan?.generatedAt ?? null,
            scanSummary: data.scan?.scanSummary ?? null,
            isReal: true,
          });
        } else {
          setSignals(seedToDisplay(lang));
          setMeta({ generatedAt: null, scanSummary: null, isReal: false });
        }
      } catch {
        if (!cancelled) {
          setSignals(seedToDisplay(lang));
          setMeta({ generatedAt: null, scanSummary: null, isReal: false });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lang]);

  // Re-map seed signals when language changes (real signals stay as fetched).
  useEffect(() => {
    if (!meta.isReal) setSignals(seedToDisplay(lang));
  }, [lang, meta.isReal]);

  // Fetch live prices for the displayed tickers. Re-runs when signal set changes.
  useEffect(() => {
    if (!signals || signals.length === 0) return;
    let cancelled = false;
    const tickers = Array.from(new Set(signals.map((s) => s.ticker)));
    (async () => {
      try {
        const res = await fetch(
          `/api/plus/prices?tickers=${encodeURIComponent(tickers.join(','))}`,
          { credentials: 'include' },
        );
        const data = await res.json();
        if (!cancelled && data.ok && data.prices) {
          setLivePrices(data.prices as Record<string, LivePrice>);
        }
      } catch {
        /* graceful — UI renders without live prices */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [signals]);

  // Fetch track-record summary once on mount. Cheap to recompute on each visit
  // since the API is server-cached behind Yahoo's response.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/plus/track-record?days=30', { credentials: 'include' });
        const data = await res.json();
        if (!cancelled && data.ok) setTrackRecord(data as TrackRecord);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!signals) return [];
    let list = signals;
    if (region !== 'ALL') list = list.filter((s) => s.region === region);
    if (action !== 'ALL') list = list.filter((s) => s.action === action);
    if (highConvictionOnly) list = list.filter((s) => s.confidence >= 80);
    return [...list].sort((a, b) => {
      // Owned positions surface first regardless of action — these are
      // the ones the user most needs to act on.
      const aOwned = isOwned(a.ticker) ? 0 : 1;
      const bOwned = isOwned(b.ticker) ? 0 : 1;
      if (aOwned !== bOwned) return aOwned - bOwned;
      const ap = ACTION_PRIORITY[a.action];
      const bp = ACTION_PRIORITY[b.action];
      if (ap !== bp) return ap - bp;
      return b.confidence - a.confidence;
    });
  }, [signals, region, action, highConvictionOnly, isOwned]);

  const actionMix = useMemo(() => {
    if (!signals) return { BUY: 0, SELL: 0, HOLD: 0, WATCH: 0 };
    return signals.reduce(
      (acc, s) => {
        acc[s.action] += 1;
        return acc;
      },
      { BUY: 0, SELL: 0, HOLD: 0, WATCH: 0 } as Record<PlusAction, number>,
    );
  }, [signals]);

  // Dagens viktigste signal — Gullsnitt-topplinjen (§5.4) tegnes KUN her.
  // Deterministisk: høyest handlingsprioritet, deretter høyest konfidens.
  const leadSignalId = useMemo(() => {
    if (!signals || signals.length === 0) return null;
    let lead = signals[0];
    for (const s of signals) {
      const better =
        ACTION_PRIORITY[s.action] < ACTION_PRIORITY[lead.action] ||
        (ACTION_PRIORITY[s.action] === ACTION_PRIORITY[lead.action] &&
          s.confidence > lead.confidence);
      if (better) lead = s;
    }
    return lead.id;
  }, [signals]);

  return (
    <div className="aqp-content">
      <div className="aqp-page-head">
        <div className="m-eyebrow">
          <span className="m-badge-dot" />
          {t.eye}
        </div>
        <h1 className="aqp-page-title">{t.title}</h1>
        <EditionRow lang={lang} />
        <p className="aqp-page-sub">{t.sub}</p>
      </div>

      {/* «Dagens bilde» (§10d) — kun tall som faktisk måles; umålte felt utelates. */}
      <div className="aqp-daybar">
        <div className="aqp-daybar-eye">{t.dayEye}</div>
        <div className="aqp-daybar-stats">
          {meta.isReal && signals && (
            <div className="aqp-daybar-stat">
              <div className="aqp-daybar-num">{signals.length}</div>
              <div className="aqp-daybar-key">{t.dayNew}</div>
            </div>
          )}
          {trackRecord && trackRecord.closed > 0 && trackRecord.winRate !== null && (
            <div className="aqp-daybar-stat">
              <div className="aqp-daybar-num">
                {Math.round(trackRecord.winRate * 100)} %
              </div>
              <div className="aqp-daybar-key">{t.dayHit}</div>
            </div>
          )}
          <div className="aqp-daybar-stat">
            <div className="aqp-daybar-num" suppressHydrationWarning>
              {formatNextUpdate(lang)}
            </div>
            <div className="aqp-daybar-key">{t.dayNext}</div>
          </div>
        </div>
      </div>

      {/* Cadence + last-updated banner */}
      <div className="aqp-cadence">
        {meta.generatedAt
          ? t.refreshInfo(formatRelative(meta.generatedAt, lang), formatNextUpdate(lang))
          : `${t.empty} ${t.refreshInfo('—', formatNextUpdate(lang))}`}
      </div>

      {meta.isReal && meta.scanSummary && (
        <div className="aqp-summary-card">
          <div className="aqp-summary-eye">{t.nowSummary}</div>
          <p className="aqp-summary-body">{meta.scanSummary}</p>
        </div>
      )}

      {trackRecord && trackRecord.total > 0 && (
        <div className="aqp-track-card">
          <div className="aqp-track-eye">{t.trackRecordEye}</div>
          {trackRecord.closed === 0 ? (
            <p className="aqp-track-empty">{t.trackRecordEmpty}</p>
          ) : (
            <div className="aqp-track-grid">
              <div className="aqp-track-stat aqp-track-stat--hero">
                <div className="aqp-track-num">
                  {trackRecord.winRate !== null
                    ? `${Math.round(trackRecord.winRate * 100)}%`
                    : '—'}
                </div>
                <div className="aqp-track-key">{t.trackRecordWinRate}</div>
              </div>
              <div className="aqp-track-stat">
                <div className="aqp-track-num aqp-track-num--win">{trackRecord.wins}</div>
                <div className="aqp-track-key">{t.trackRecordWins}</div>
              </div>
              <div className="aqp-track-stat">
                <div className="aqp-track-num aqp-track-num--loss">{trackRecord.losses}</div>
                <div className="aqp-track-key">{t.trackRecordLosses}</div>
              </div>
              <div className="aqp-track-stat">
                <div className="aqp-track-num">{trackRecord.open}</div>
                <div className="aqp-track-key">{t.trackRecordOpen}</div>
              </div>
              {trackRecord.avgWinPct !== null && (
                <div className="aqp-track-stat">
                  <div className="aqp-track-num aqp-track-num--win">
                    +{(trackRecord.avgWinPct * 100).toFixed(1)}%
                  </div>
                  <div className="aqp-track-key">{t.trackRecordAvgWin}</div>
                </div>
              )}
              {trackRecord.avgLossPct !== null && (
                <div className="aqp-track-stat">
                  <div className="aqp-track-num aqp-track-num--loss">
                    {(trackRecord.avgLossPct * 100).toFixed(1)}%
                  </div>
                  <div className="aqp-track-key">{t.trackRecordAvgLoss}</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {!meta.isReal && !loading && <div className="aqp-seed-note">{t.seedNote}</div>}

      {!loading && signals && signals.length > 0 && (
        <div className="aqp-action-mix">
          <span className="aqp-action-mix-label">{t.actionMixLabel}</span>
          {ACTIONS.map((a) => {
            const count = actionMix[a];
            if (count === 0) return null;
            return (
              <span
                key={a}
                className={`aqp-action-mix-stat aqp-action-mix-stat--${a.toLowerCase()}`}
              >
                <span className="aqp-action-mix-num">{count}</span>
                <span className="aqp-action-mix-key">{t.actions[a]}</span>
              </span>
            );
          })}
        </div>
      )}

      {/* Action filter */}
      <div className="aqp-filter-row" style={{ marginTop: 16 }}>
        <button
          type="button"
          className={`aqp-chip ${action === 'ALL' ? 'is-on' : ''}`}
          onClick={() => setAction('ALL')}
        >
          {t.allActions}
        </button>
        {ACTIONS.map((a) => {
          const count = signals?.filter((s) => s.action === a).length ?? 0;
          if (count === 0) return null;
          return (
            <button
              key={a}
              type="button"
              className={`aqp-chip aqp-chip--${a.toLowerCase()} ${action === a ? 'is-on' : ''}`}
              onClick={() => setAction(a)}
            >
              {t.actions[a]} <span className="aqp-chip-count">{count}</span>
            </button>
          );
        })}
        <button
          type="button"
          className={`aqp-chip aqp-chip--conviction ${highConvictionOnly ? 'is-on' : ''}`}
          onClick={() => setHighConvictionOnly((v) => !v)}
          aria-pressed={highConvictionOnly}
        >
          {t.convictionFilter}
        </button>
      </div>

      {/* Region filter */}
      <div className="aqp-filter-row">
        <button
          type="button"
          className={`aqp-chip ${region === 'ALL' ? 'is-on' : ''}`}
          onClick={() => setRegion('ALL')}
        >
          {t.allRegions}
        </button>
        {REGIONS.map((r) => {
          const count = signals?.filter((s) => s.region === r).length ?? 0;
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

      {loading ? (
        <div className="aqp-empty">{t.loading}</div>
      ) : filtered.length === 0 ? (
        <div className="aqp-empty">{t.empty}</div>
      ) : region === 'ALL' ? (
        <div className="aqp-region-stack">
          {REGION_DISPLAY_ORDER.map((r) => {
            const items = filtered.filter((s) => s.region === r);
            if (items.length === 0) return null;
            return (
              <section key={r} className="aqp-region-section">
                <header className="aqp-region-head">
                  <h2 className="aqp-region-title">{REGION_LABELS[lang][r]}</h2>
                  <span className="aqp-region-count">
                    {items.length} {items.length === 1 ? t.regionPositionsOne : t.regionPositionsMany}
                  </span>
                </header>
                <div className="aqp-signal-stack">
                  {items.map((s) => renderSignalCard(s))}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="aqp-signal-stack">
          {filtered.map((s) => renderSignalCard(s))}
        </div>
      )}

      <p className="aqp-disclaimer">{t.disclaimer}</p>

      {openTicker && (
        <TickerModal
          ticker={openTicker}
          onClose={() => setOpenTicker(null)}
          live={livePrices[openTicker.toUpperCase()]}
          allSignals={signals ?? []}
          lang={lang}
        />
      )}
    </div>
  );

  function renderSignalCard(s: DisplaySignal) {
    const meta = PLUS_WATCHLIST.find((w) => w.ticker === s.ticker);
    const owned = isOwned(s.ticker);
    const requiresOwnership = s.action === 'HOLD' || s.action === 'SELL';
    const showOwnershipBanner = requiresOwnership && !owned;
    const isBuy = s.action === 'BUY';
    const confidenceTier =
      s.confidence >= 80 ? 'high' : s.confidence >= 60 ? 'med' : 'low';
    const isLead = s.id === leadSignalId;
    return (
      <article
        key={s.id}
        className={`aqp-signal-card aqp-signal-card--${s.action.toLowerCase()} ${
          owned ? 'aqp-signal-card--owned' : ''
        } ${isLead ? 'aqp-signal-card--lead' : ''}`}
      >
                {/* Anatomi (§10c): ticker-rad → handlings-tag → Fraunces-
                    begrunnelse → meta-rad → detaljgrid. */}
                <header className="aqp-signal-head">
                  <button
                    type="button"
                    className="aqp-signal-id aqp-signal-id--clickable"
                    onClick={() => setOpenTicker(s.ticker)}
                    aria-label={`${t.openDetails} ${s.ticker}`}
                  >
                    <div className="aqp-ticker">{s.ticker}</div>
                    <div className="aqp-ticker-name">{meta?.name ?? s.ticker}</div>
                  </button>
                  <div className="aqp-signal-actions">
                    <button
                      type="button"
                      className={`aqp-owned-toggle ${owned ? 'is-on' : ''}`}
                      onClick={() => toggle(s.ticker)}
                    >
                      {owned ? t.ownedActive : t.ownedToggle}
                    </button>
                    <div
                      className={`aqp-action-pill aqp-action-pill--${s.action.toLowerCase()} ${
                        isBuy ? 'aqp-action-pill--lg' : ''
                      }`}
                    >
                      {t.actions[s.action]}
                    </div>
                  </div>
                </header>

                <div className="aqp-action-explain">{t.actionExplain[s.action]}</div>

                <p className="aqp-signal-reasoning">{s.reasoning}</p>

                <PriceRow
                  signal={s}
                  live={livePrices[s.ticker.toUpperCase()]}
                  sinceLabel={t.sinceSignal}
                  liveLabel={t.livePriceLabel}
                />

                <div className="aqp-signal-meta">
                  <span className="aqp-meta-item">
                    <span className="aqp-meta-key">{REGION_LABELS[lang][s.region]}</span>
                  </span>
                  <span className="aqp-meta-sep">·</span>
                  <span className="aqp-meta-item aqp-confidence">
                    <span
                      className={`aqp-confidence-dot aqp-confidence-dot--${confidenceTier}`}
                      aria-hidden="true"
                    />
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

                {(s.peerComparison || s.insiderSignal) && (
                  <div className="aqp-extra-row">
                    {s.peerComparison && (
                      <div className="aqp-extra">
                        <div className="aqp-extra-label">{t.peerLabel}</div>
                        <div className="aqp-extra-body">{s.peerComparison}</div>
                      </div>
                    )}
                    {s.insiderSignal && (
                      <div className="aqp-extra">
                        <div className="aqp-extra-label">{t.insiderLabel}</div>
                        <div className="aqp-extra-body">{s.insiderSignal}</div>
                      </div>
                    )}
                  </div>
                )}

                <div className="aqp-signal-grid">
                  <div className="aqp-signal-block">
                    <div className="aqp-block-head">
                      <span className="aqp-block-dot aqp-block-dot--catalyst" />
                      {t.catalysts}
                    </div>
                    <ul className="aqp-block-list">
                      {s.catalysts.map((c, i) => (
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
              {s.risks.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        </div>
      </article>
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PriceRow — live price + change-since-signal pill on each card
// ─────────────────────────────────────────────────────────────────────────────

function PriceRow({
  signal,
  live,
  sinceLabel,
  liveLabel,
}: {
  signal: DisplaySignal;
  live?: LivePrice;
  sinceLabel: string;
  liveLabel: string;
}) {
  if (!live) return null;
  const priceStr = formatPrice(live.price, live.currency);
  const dayPct = live.changeFromPrevClose;
  const sinceSignalPct =
    signal.priceAtSignal && signal.priceAtSignal > 0
      ? (live.price - signal.priceAtSignal) / signal.priceAtSignal
      : null;
  return (
    <div className="aqp-price-row">
      <div className="aqp-price-now">
        <span className="aqp-price-label">{liveLabel}</span>
        <span className="aqp-price-value">{priceStr}</span>
        {dayPct !== null && (
          <span className={`aqp-price-day ${dayPct >= 0 ? 'is-up' : 'is-down'}`}>
            {dayPct >= 0 ? '+' : ''}
            {(dayPct * 100).toFixed(2)}%
          </span>
        )}
      </div>
      {sinceSignalPct !== null && (
        <div className={`aqp-price-since ${sinceSignalPct >= 0 ? 'is-up' : 'is-down'}`}>
          {sinceSignalPct >= 0 ? '+' : ''}
          {(sinceSignalPct * 100).toFixed(2)}% {sinceLabel}
        </div>
      )}
    </div>
  );
}

function formatPrice(price: number, currency: string): string {
  const decimals = price >= 100 ? 2 : price >= 10 ? 2 : 3;
  const num = price.toFixed(decimals);
  // Avoid currency-code clutter on common ones — use symbol where natural.
  if (currency === 'USD') return `$${num}`;
  if (currency === 'EUR') return `€${num}`;
  if (currency === 'GBP') return `£${num}`;
  if (currency === 'NOK') return `kr ${num}`;
  return `${num} ${currency}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// TickerModal — ticker deep-dive: sparkline + all signals on this ticker
// ─────────────────────────────────────────────────────────────────────────────

interface ChartPoint {
  t: number;
  c: number;
}

function TickerModal({
  ticker,
  onClose,
  live,
  allSignals,
  lang,
}: {
  ticker: string;
  onClose: () => void;
  live?: LivePrice;
  allSignals: DisplaySignal[];
  lang: PlusLang;
}) {
  const [chart, setChart] = useState<ChartPoint[] | null>(null);
  const [loadingChart, setLoadingChart] = useState(true);
  const meta = PLUS_WATCHLIST.find((w) => w.ticker === ticker);
  const onTicker = allSignals.filter((s) => s.ticker === ticker);

  useEffect(() => {
    let cancelled = false;
    setLoadingChart(true);
    (async () => {
      try {
        const res = await fetch(
          `/api/plus/chart?ticker=${encodeURIComponent(ticker)}&range=3mo`,
          { credentials: 'include' },
        );
        const data = await res.json();
        if (!cancelled && data.ok) setChart(data.points as ChartPoint[]);
      } catch {
        if (!cancelled) setChart([]);
      } finally {
        if (!cancelled) setLoadingChart(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  // Close on ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const t = COPY[lang];

  return (
    <div className="aqp-modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="aqp-modal" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="aqp-modal-close"
          onClick={onClose}
          aria-label={t.close}
        >
          ✕
        </button>

        <header className="aqp-modal-head">
          <div className="aqp-modal-ticker">{ticker}</div>
          <div className="aqp-modal-name">{meta?.name ?? ticker}</div>
          {live && (
            <div className="aqp-modal-price">
              <span className="aqp-modal-price-value">
                {formatPrice(live.price, live.currency)}
              </span>
              {live.changeFromPrevClose !== null && (
                <span
                  className={`aqp-modal-price-change ${
                    live.changeFromPrevClose >= 0 ? 'is-up' : 'is-down'
                  }`}
                >
                  {live.changeFromPrevClose >= 0 ? '+' : ''}
                  {(live.changeFromPrevClose * 100).toFixed(2)}%
                </span>
              )}
            </div>
          )}
        </header>

        <div className="aqp-modal-chart">
          {loadingChart ? (
            <div className="aqp-empty">{t.loading}</div>
          ) : chart && chart.length > 1 ? (
            <Sparkline points={chart} />
          ) : (
            <div className="aqp-empty">—</div>
          )}
        </div>

        <div className="aqp-modal-signals">
          {onTicker.length === 0 ? (
            <div className="aqp-empty">{t.empty}</div>
          ) : (
            onTicker.map((s) => (
              <div key={s.id} className="aqp-modal-signal-row">
                <span
                  className={`aqp-action-pill aqp-action-pill--${s.action.toLowerCase()}`}
                >
                  {t.actions[s.action]}
                </span>
                <span className="aqp-modal-signal-conf">{s.confidence}%</span>
                <p className="aqp-modal-signal-reason">{s.reasoning}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function Sparkline({ points }: { points: ChartPoint[] }) {
  const width = 600;
  const height = 160;
  const pad = 8;
  const xs = points.map((p) => p.t);
  const ys = points.map((p) => p.c);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const yRange = maxY - minY || 1;
  const xRange = maxX - minX || 1;
  const path = points
    .map((p, i) => {
      const x = pad + ((p.t - minX) / xRange) * (width - 2 * pad);
      const y = height - pad - ((p.c - minY) / yRange) * (height - 2 * pad);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const lastUp = ys[ys.length - 1] >= ys[0];
  const stroke = lastUp ? 'var(--aq-up-hi)' : 'var(--aq-down-hi)';
  const fill = lastUp ? 'var(--aq-up-tint)' : 'var(--aq-down-tint)';
  const areaPath = `${path} L${(width - pad).toFixed(1)},${(height - pad).toFixed(1)} L${pad},${(height - pad).toFixed(1)} Z`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="aqp-spark-svg">
      <path d={areaPath} fill={fill} />
      <path d={path} stroke={stroke} strokeWidth="2" fill="none" />
    </svg>
  );
}

'use client';

import { useMemo, useState } from 'react';
import type { PlusLang } from '@/lib/i18n/plus-lang';
import { PLUS_WATCHLIST, type PlusRegion } from '@/lib/blueprints/plus';
import { EditionRow } from './edition-row';

const COPY = {
  no: {
    eye: 'WATCHLIST',
    title: 'Vår globale watchlist',
    sub: 'Hele universet av aksjer Apex Quantum + analyserer. Filtrér på region eller tema for å bli kjent med selskapene.',
    all: 'Alle',
    search: 'Søk ticker eller navn',
    noResults: 'Ingen treff',
    count: (n: number) => `${n} selskaper`,
  },
  en: {
    eye: 'WATCHLIST',
    title: 'Our global watchlist',
    sub: 'The full universe of stocks Apex Quantum + analyzes. Filter by region or theme to get familiar with the companies.',
    all: 'All',
    search: 'Search ticker or name',
    noResults: 'No matches',
    count: (n: number) => `${n} companies`,
  },
  de: {
    eye: 'WATCHLIST',
    title: 'Unsere globale Watchlist',
    sub: 'Das gesamte Universum von Aktien, das Apex Quantum + analysiert. Nach Region oder Thema filtern, um die Unternehmen kennenzulernen.',
    all: 'Alle',
    search: 'Ticker oder Name suchen',
    noResults: 'Keine Treffer',
    count: (n: number) => `${n} Unternehmen`,
  },
  es: {
    eye: 'WATCHLIST',
    title: 'Nuestra lista global',
    sub: 'El universo completo de acciones que analiza Apex Quantum +. Filtra por región o tema para conocer las empresas.',
    all: 'Todos',
    search: 'Buscar ticker o nombre',
    noResults: 'Sin resultados',
    count: (n: number) => `${n} empresas`,
  },
  zh: {
    eye: '观察清单',
    title: '我们的全球观察清单',
    sub: 'Apex Quantum + 分析的全部股票。按地区或主题筛选以了解这些公司。',
    all: '全部',
    search: '搜索代码或名称',
    noResults: '无结果',
    count: (n: number) => `${n} 家公司`,
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

export function WatchlistView({ lang }: { lang: PlusLang }) {
  const t = COPY[lang];
  const [region, setRegion] = useState<PlusRegion | 'ALL'>('ALL');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return PLUS_WATCHLIST.filter((tk) => {
      if (region !== 'ALL' && tk.region !== region) return false;
      if (q && !tk.ticker.toLowerCase().includes(q) && !tk.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [region, query]);

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

      <div className="aqp-filter-row">
        <button
          type="button"
          className={`aqp-chip ${region === 'ALL' ? 'is-on' : ''}`}
          onClick={() => setRegion('ALL')}
        >
          {t.all} <span className="aqp-chip-count">{PLUS_WATCHLIST.length}</span>
        </button>
        {REGIONS.map((r) => {
          const count = PLUS_WATCHLIST.filter((tk) => tk.region === r).length;
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

      <div className="aqp-search-row">
        <input
          type="search"
          className="aqp-search"
          placeholder={t.search}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span className="aqp-search-count">{t.count(filtered.length)}</span>
      </div>

      {filtered.length === 0 ? (
        <div className="aqp-empty">{t.noResults}</div>
      ) : (
        <div className="aqp-watchlist-grid">
          {filtered.map((tk) => (
            <div key={tk.ticker} className="aqp-watch-card">
              <div className="aqp-watch-ticker">{tk.ticker}</div>
              <div className="aqp-watch-name">{tk.name}</div>
              <div className="aqp-watch-meta">
                <span className="aqp-watch-region">{REGION_LABELS[lang][tk.region]}</span>
                <span className="aqp-watch-theme">{tk.theme}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

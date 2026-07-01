'use client';

import { useMemo, useState } from 'react';
import type { PlusLang } from '@/lib/i18n/plus-lang';
import { PLUS_WATCHLIST } from '@/lib/blueprints/plus';
import { EditionRow } from './edition-row';

const COPY = {
  no: {
    eye: 'SPØR AI',
    title: 'Spør AI om en aksje',
    sub: 'Velg en aksje fra watchlisten og still spørsmålet ditt. Modellen kjører FULL GLOBAL SCAN — fersk pris, nyheter, sentiment, makro — og forklarer pedagogisk. Aldri konkret kjøps- eller salgsanbefaling.',
    tickerLabel: 'Aksje',
    tickerPh: 'Søk ticker eller navn',
    questionLabel: 'Spørsmål',
    questionPh: 'Eks: Hvorfor falt aksjen i går? Hva er hoveddriverne nå? Hvilke risikoer bør jeg være klar over?',
    submit: 'Spør AI',
    loading: 'AI tenker — kan ta opptil 2 minutter med live søk',
    errorTitle: 'Noe gikk galt',
    answerLabel: 'Svar',
    pickTicker: 'Velg aksje først',
    needQuestion: 'Skriv et spørsmål',
  },
  en: {
    eye: 'ASK AI',
    title: 'Ask AI about a stock',
    sub: 'Pick a stock from the watchlist and ask your question. The model runs FULL GLOBAL SCAN — fresh price, news, sentiment, macro — and explains educationally. Never specific buy or sell advice.',
    tickerLabel: 'Stock',
    tickerPh: 'Search ticker or name',
    questionLabel: 'Question',
    questionPh: 'E.g. Why did it fall yesterday? What are the main drivers now? What risks should I be aware of?',
    submit: 'Ask AI',
    loading: 'AI thinking — may take up to 2 minutes with live search',
    errorTitle: 'Something went wrong',
    answerLabel: 'Answer',
    pickTicker: 'Pick a stock first',
    needQuestion: 'Write a question',
  },
  de: {
    eye: 'KI FRAGEN',
    title: 'Frag die KI zu einer Aktie',
    sub: 'Wählen Sie eine Aktie aus der Watchlist und stellen Sie Ihre Frage. Das Modell führt FULL GLOBAL SCAN aus — frische Preise, News, Sentiment, Makro — und erklärt pädagogisch. Nie konkrete Kauf- oder Verkaufsempfehlung.',
    tickerLabel: 'Aktie',
    tickerPh: 'Ticker oder Name suchen',
    questionLabel: 'Frage',
    questionPh: 'Z.B. Warum ist sie gestern gefallen? Was sind die Haupttreiber jetzt? Welche Risiken sollte ich kennen?',
    submit: 'KI fragen',
    loading: 'KI denkt — kann mit Live-Suche bis zu 2 Minuten dauern',
    errorTitle: 'Etwas ist schiefgelaufen',
    answerLabel: 'Antwort',
    pickTicker: 'Zuerst eine Aktie wählen',
    needQuestion: 'Eine Frage schreiben',
  },
  es: {
    eye: 'PREGUNTAR IA',
    title: 'Pregunta a la IA sobre una acción',
    sub: 'Elige una acción de la lista y haz tu pregunta. El modelo ejecuta FULL GLOBAL SCAN — precio fresco, noticias, sentimiento, macro — y explica pedagógicamente. Nunca recomendación específica de compra o venta.',
    tickerLabel: 'Acción',
    tickerPh: 'Buscar ticker o nombre',
    questionLabel: 'Pregunta',
    questionPh: 'Ej: ¿Por qué cayó ayer? ¿Cuáles son los principales drivers? ¿Qué riesgos debo conocer?',
    submit: 'Preguntar IA',
    loading: 'La IA está pensando — puede tardar hasta 2 minutos con búsqueda en vivo',
    errorTitle: 'Algo salió mal',
    answerLabel: 'Respuesta',
    pickTicker: 'Elige una acción primero',
    needQuestion: 'Escribe una pregunta',
  },
  zh: {
    eye: '问AI',
    title: '问 AI 关于一只股票',
    sub: '从观察清单选择一只股票并提问。模型运行 FULL GLOBAL SCAN——最新价格、新闻、情绪、宏观——并以教学方式解释。永不提供具体的买入或卖出建议。',
    tickerLabel: '股票',
    tickerPh: '搜索代码或名称',
    questionLabel: '问题',
    questionPh: '例如：昨天为何下跌？目前的主要驱动是什么？我应注意哪些风险？',
    submit: '问 AI',
    loading: 'AI 思考中——含实时搜索可能需要 2 分钟',
    errorTitle: '出现错误',
    answerLabel: '回答',
    pickTicker: '请先选择股票',
    needQuestion: '请输入问题',
  },
} as const;

export function AskView({ lang }: { lang: PlusLang }) {
  const t = COPY[lang];
  const [tickerQuery, setTickerQuery] = useState('');
  const [pickedTicker, setPickedTicker] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);

  const suggestions = useMemo(() => {
    if (pickedTicker) return [];
    const q = tickerQuery.trim().toLowerCase();
    if (!q) return [];
    return PLUS_WATCHLIST.filter(
      (tk) => tk.ticker.toLowerCase().includes(q) || tk.name.toLowerCase().includes(q),
    ).slice(0, 8);
  }, [tickerQuery, pickedTicker]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickedTicker) {
      setError(t.pickTicker);
      return;
    }
    if (!question.trim()) {
      setError(t.needQuestion);
      return;
    }
    setError(null);
    setAnswer(null);
    setLoading(true);
    try {
      const res = await fetch('/api/plus/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ticker: pickedTicker, question: question.trim(), lang }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || 'unknown error');
      } else {
        setAnswer(data.answer);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'network error');
    } finally {
      setLoading(false);
    }
  };

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

      <form className="aqp-ask-form" onSubmit={handleSubmit}>
        <label className="aqp-field">
          <span className="aqp-field-label">{t.tickerLabel}</span>
          {pickedTicker ? (
            <div className="aqp-picked">
              <span className="aqp-picked-tk">{pickedTicker}</span>
              <button
                type="button"
                className="aqp-picked-x"
                onClick={() => {
                  setPickedTicker(null);
                  setTickerQuery('');
                }}
                aria-label="clear"
              >
                ×
              </button>
            </div>
          ) : (
            <>
              <input
                type="text"
                className="aqp-input"
                placeholder={t.tickerPh}
                value={tickerQuery}
                onChange={(e) => setTickerQuery(e.target.value)}
                autoComplete="off"
              />
              {suggestions.length > 0 && (
                <div className="aqp-suggest">
                  {suggestions.map((s) => (
                    <button
                      key={s.ticker}
                      type="button"
                      className="aqp-suggest-item"
                      onClick={() => {
                        setPickedTicker(s.ticker);
                        setTickerQuery('');
                      }}
                    >
                      <span className="aqp-suggest-tk">{s.ticker}</span>
                      <span className="aqp-suggest-name">{s.name}</span>
                      <span className="aqp-suggest-region">{s.region}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </label>

        <label className="aqp-field">
          <span className="aqp-field-label">{t.questionLabel}</span>
          <textarea
            className="aqp-textarea"
            placeholder={t.questionPh}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={5}
          />
        </label>

        <button type="submit" className="btn-primary-v8 btn-lg" disabled={loading}>
          {loading ? t.loading : t.submit}
          {!loading && (
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          )}
        </button>
      </form>

      {error && (
        <div className="aqp-error">
          <div className="aqp-error-title">{t.errorTitle}</div>
          <div className="aqp-error-body">{error}</div>
        </div>
      )}

      {answer && (
        <div className="aqp-answer">
          <div className="aqp-answer-eye">{t.answerLabel}</div>
          <div className="aqp-answer-body">
            {answer.split('\n\n').map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

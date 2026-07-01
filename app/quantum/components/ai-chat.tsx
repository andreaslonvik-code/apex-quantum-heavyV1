'use client';

/**
 * Motor-dialogen (§10): motorens svar i Fraunces 15–16px, brukeren i
 * Satoshi 14px, mono-tidsstempler og terminal-prompt-input med «> ».
 *
 * Mekanikken er beholdt (meldingsflyt, trigger-baserte svar,
 * interaksjonshistorikk i localStorage). Copyen er sanert: ingen
 * emoji, ingen fabrikkerte tall eller kursmål (§13.1/§13.2) — svarene
 * beskriver metoden ærlig og er tydelig merket som forhåndsdefinerte.
 * Sanntidstall i åpningsmeldingen kommer fra ekte API-data via props.
 */

import { useEffect, useRef, useState } from 'react';
import type { Lang } from '@/app/components/marketing/types';
import { fmtPct, fmtUsd } from '@/lib/marketing-format';
import { COCKPIT_COPY } from '../lib/copy';
import type { CockpitTf } from '../lib/types';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

/** Trygg inline-markdown: **fet** + linjeskift uten dangerouslySetInnerHTML.
 *  JSX-escaping på strengbarna gjør at innskrevet HTML rendres som tekst. */
function renderInlineMarkdown(content: string): React.ReactNode[] {
  const parts = content.split(/\*\*(.*?)\*\*/g);
  const out: React.ReactNode[] = [];
  parts.forEach((part, partIdx) => {
    const isBold = partIdx % 2 === 1;
    const lines = part.split('\n');
    lines.forEach((line, lineIdx) => {
      const key = `${partIdx}-${lineIdx}`;
      if (isBold) {
        out.push(<strong key={key}>{line}</strong>);
      } else {
        out.push(<span key={key}>{line}</span>);
      }
      if (lineIdx < lines.length - 1) {
        out.push(<br key={`${key}-br`} />);
      }
    });
  });
  return out;
}

/** Forhåndsdefinerte, ærlige svar — trigger-mekanismen er beholdt. */
const CANNED: Record<Lang, Array<{ triggers: string[]; response: string }>> = {
  no: [
    {
      triggers: ['metode', 'blueprint', 'hvordan'],
      response: `**Metoden**\n\nMotoren følger faste blueprint-lister for aksjer, krypto og råvarer. Hver vurderingsrunde ser den på nyheter og katalysatorer for tickerne på listen, og hver ordre logges med begrunnelse før den sendes til Alpaca.\n\nAlt du ser her stammer fra paper trading — simulert handel uten reell kapital. Full metodikk ligger på /innsyn.`,
    },
    {
      triggers: ['risiko', 'tap', 'trygt'],
      response: `**Risiko**\n\nAll handel med verdipapirer innebærer risiko for tap av hele det investerte beløpet, og AI-modeller kan feiltolke data eller reagere uventet på uvanlige markedsforhold.\n\nJeg pynter ikke på dette. Les de fullstendige risikofaktorene på /risikofaktorer før du kobler til en konto.`,
    },
    {
      triggers: ['journal', 'logg', 'hendelse'],
      response: `**Journalen**\n\nKolonnen til høyre er den faktiske hendelsesloggen: gjennomførte kjøp og salg fra megler-API-et, og motorens vurderinger med tidsstempel. Ingenting der er konstruert for visning — det er de samme radene som ligger til grunn for innsynssiden.`,
    },
    {
      triggers: ['ordre', 'kjøp', 'selg', 'handle'],
      response: `**Ordre**\n\nJeg legger ikke inn ordre fra denne dialogen. Handler besluttes av motoren i faste vurderingsrunder på serversiden, og hver ordre får sin begrunnelse i journalen. Vil du stoppe motoren, kobler du fra kontoen — det er den reelle stoppkontrollen.`,
    },
  ],
  en: [
    {
      triggers: ['method', 'blueprint', 'how'],
      response: `**The method**\n\nThe engine follows fixed blueprint lists for stocks, crypto and commodities. Each assessment round it reviews news and catalysts for the tickers on the list, and every order is logged with a written reason before it is sent to Alpaca.\n\nEverything you see here comes from paper trading — simulated trading without real capital. The full methodology lives at /innsyn.`,
    },
    {
      triggers: ['risk', 'loss', 'safe'],
      response: `**Risk**\n\nAll trading in securities carries a risk of losing the entire invested amount, and AI models can misread data or react unexpectedly to unusual market conditions.\n\nI will not dress this up. Read the full risk factors at /risikofaktorer before connecting an account.`,
    },
    {
      triggers: ['journal', 'log', 'event'],
      response: `**The journal**\n\nThe column on the right is the actual event log: executed buys and sells from the broker API, and the engine's assessments with timestamps. Nothing there is staged — they are the same rows that power the transparency page.`,
    },
    {
      triggers: ['order', 'buy', 'sell', 'trade'],
      response: `**Orders**\n\nI do not place orders from this dialogue. Trades are decided by the engine in fixed server-side assessment rounds, and every order gets its reason in the journal. To stop the engine, disconnect the account — that is the real stop control.`,
    },
  ],
};

const FALLBACK: Record<Lang, string> = {
  no: `Jeg har et begrenset sett forhåndsdefinerte svar i denne visningen, og dikter ikke opp analyser jeg ikke har grunnlag for.\n\nPrøv **metode**, **risiko**, **journal** eller **ordre** — eller se den fulle beslutningsloggen på /innsyn.`,
  en: `I have a limited set of predefined answers in this view, and I do not invent analysis I have no basis for.\n\nTry **method**, **risk**, **journal** or **orders** — or see the full decision log at /innsyn.`,
};

function buildIntro(
  lang: Lang,
  status: { totalValue: number | null; positionsCount: number | null; changePct: number | null; tf: CockpitTf },
): string {
  const { totalValue, positionsCount, changePct, tf } = status;
  if (lang === 'no') {
    if (totalValue == null) {
      return `**Forvalterens bord**\n\nIngen tilkoblet konto — jeg har ingen live-tall å vise. Jeg kan likevel forklare metoden, risikoen og journalen. Alle svar her er forhåndsdefinerte, og ingen ordre utføres fra dialogen.`;
    }
    return `**Status**\n\nPorteføljeverdi: ${fmtUsd(totalValue, lang)} · ${positionsCount ?? '—'} posisjoner · endring (${tf}): ${changePct == null ? '—' : fmtPct(changePct, lang)}. Alle tall er paper trading via Alpaca.\n\nSpør meg om metoden, risikoen eller journalen.`;
  }
  if (totalValue == null) {
    return `**The manager's desk**\n\nNo connected account — I have no live figures to show. I can still explain the method, the risk and the journal. All answers here are predefined, and no orders are placed from this dialogue.`;
  }
  return `**Status**\n\nPortfolio value: ${fmtUsd(totalValue, lang)} · ${positionsCount ?? '—'} positions · change (${tf}): ${changePct == null ? '—' : fmtPct(changePct, lang)}. All figures are paper trading via Alpaca.\n\nAsk me about the method, the risk or the journal.`;
}

export function AIChat({
  lang,
  connected,
  status,
}: {
  lang: Lang;
  /** null = tilkoblingsstatus ukjent (laster fortsatt) */
  connected: boolean | null;
  status: { totalValue: number | null; positionsCount: number | null; changePct: number | null; tf: CockpitTf };
}) {
  const t = COCKPIT_COPY[lang];
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const introSetRef = useRef(false);

  // Interaksjonshistorikk i localStorage — mekanismen beholdt.
  const historyRef = useRef<Array<{ input: string; response: string; timestamp: string }>>([]);
  useEffect(() => {
    try {
      const saved = localStorage.getItem('apex-quantum-interactions');
      if (saved) historyRef.current = JSON.parse(saved);
    } catch {
      /* korrupt lagring ignoreres */
    }
  }, []);

  // Åpningsmelding med ekte status — settes én gang når tilkoblingsstatus
  // er avklart (og live-tall foreligger hvis tilkoblet). Oppdateres ikke
  // i etterkant; tall animeres/oppdateres aldri i løpende samtale.
  useEffect(() => {
    if (introSetRef.current) return;
    if (connected == null) return; // fortsatt ukjent — vent
    if (connected && status.totalValue == null) return; // vent på ekte tall
    introSetRef.current = true;
    setMessages([
      {
        id: 'intro',
        role: 'assistant',
        content: buildIntro(lang, status),
        timestamp: new Date(),
      },
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, status.totalValue]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isTyping]);

  const saveInteraction = (q: string, a: string) => {
    const updated = [
      ...historyRef.current,
      { input: q, response: a, timestamp: new Date().toISOString() },
    ].slice(-50);
    historyRef.current = updated;
    try {
      localStorage.setItem('apex-quantum-interactions', JSON.stringify(updated));
    } catch {
      /* lagring kan være blokkert */
    }
  };

  const handleSend = async () => {
    const q = input.trim();
    if (!q || isTyping) return;

    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), role: 'user', content: q, timestamp: new Date() },
    ]);
    setInput('');
    setIsTyping(true);

    await new Promise((resolve) => setTimeout(resolve, 600));

    const lower = q.toLowerCase();
    const hit = CANNED[lang].find((c) => c.triggers.some((trig) => lower.includes(trig)));
    const response = hit?.response ?? FALLBACK[lang];

    setMessages((prev) => [
      ...prev,
      { id: `${Date.now()}-a`, role: 'assistant', content: response, timestamp: new Date() },
    ]);
    setIsTyping(false);
    saveInteraction(q, response);
  };

  return (
    <section className="aq-panel" aria-label={t.chatTitle}>
      <div className="aq-panel-head">
        <span>{t.chatTitle}</span>
        <span className="aq-ck-panel-note">{t.chatDisclosure}</span>
      </div>

      <div className="aq-ck-chat-list" ref={listRef}>
        {messages.map((m) => (
          <div key={m.id} className="aq-ck-msg" data-role={m.role}>
            <div className="aq-ck-msg-body">{renderInlineMarkdown(m.content)}</div>
            <div className="aq-ck-msg-meta" suppressHydrationWarning>
              {m.timestamp.toLocaleTimeString(lang === 'no' ? 'nb-NO' : 'en-GB', {
                hour12: false,
              })}
            </div>
          </div>
        ))}
        {isTyping && <div className="aq-ck-msg-meta">{t.chatThinking}</div>}
      </div>

      <div className="aq-ck-chat-input">
        <span className="aq-ck-prompt" aria-hidden>
          &gt;
        </span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder={t.chatPlaceholder}
          aria-label={t.chatTitle}
        />
        <button
          type="button"
          className="aq-ck-chat-send"
          onClick={handleSend}
          disabled={!input.trim() || isTyping}
        >
          {t.chatSend}
        </button>
      </div>
    </section>
  );
}

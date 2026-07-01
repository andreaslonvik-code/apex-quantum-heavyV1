'use client';

import { ArticleBody, PageShell } from '@/app/components/marketing/page-shell';
import type { Lang } from '@/app/components/marketing/types';
import {
  ATTESTATION_MAX_EXTRA,
  LEGAL_LINES,
  REG_STATUS,
} from '@/lib/legal-copy';

/**
 * /risikofaktorer — nettstedets juridiske hovedkilde (§6 i masterdirektivet).
 * Alle «Risiko →»-lenker og Kildenote-popovers peker hit. Basisformuleringene
 * hentes fra lib/legal-copy.ts og utdypes redaksjonelt — aldri motsies.
 * Statuskortene øverst viser lisensstatus med warn-/faint-dot; grønn dot
 * på en lisens som ikke foreligger er forbudt (§13.9).
 */

const COPY = {
  no: {
    title: 'Risikofaktorer',
    updatedLabel: 'Sist oppdatert',
    updatedDate: '1. juli 2026',
    regEye: 'Regulatorisk status',
    sections: {
      market: 'Markedsrisiko',
      system: 'Systemrisiko',
      auto: 'Autonom handel',
      reg: 'Regulatorisk status',
      liability: 'Ansvarsbegrensning',
    },
    intro: [
      'Apex Quantum er et avansert verktøy, ikke en garanti. Les denne siden nøye før du abonnerer, kobler en meglerkonto eller handler på grunnlag av våre analyser.',
    ],
    market: [
      'Verdipapirmarkedet er underlagt vanlig markedsrisiko: aksjekurser kan falle raskt og betydelig, uten forvarsel og uten at noen modell fanger det opp i tide. Det finnes ingen beskyttelse mot tap av kapital — heller ikke gjennom AI-drevet beslutningsstøtte.',
      'Enkelte aksjer har lav likviditet. I urolige markeder kan spread mellom kjøps- og salgskurs øke betydelig, og det kan være vanskelig å gå ut av en posisjon til ønsket pris. Kvartalsrapporter, makro-utgivelser og selskapshendelser kan skape store kursgap mellom børsdager som omgår stop-loss-mekanismer.',
      'Plattformen handler i amerikanske dollar. Måler du avkastningen i norske kroner, vil USD/NOK-svingninger påvirke verdien av porteføljen din — i begge retninger.',
    ],
    system: [
      'AI- og signalmodellene kan ta feil. De er trent på historiske data og kan ha skjevheter eller blindsoner som først kommer til syne under nye markedsforhold. AI-modeller kan feiltolke data, reagere uventet på uvanlige markedsforhold og gi anbefalinger som viser seg å være feil.',
      'Tjenesten avhenger av tredjeparter (Alpaca, Clerk, Supabase, Stripe, Vercel, xAI). Avbrudd hos disse kan forsinke signaler, hindre betalinger eller stanse datastrømmer. Vi kan ikke garantere kontinuerlig oppetid; faktisk målt status vises på statussiden.',
      'Selv om API-nøkler lagres kryptert (AES-256-GCM) og all trafikk går over TLS, kan kompromitterte enheter på din side eksponere kontoen din. Bruk sterk autentisering og en oppdatert nettleser.',
    ],
    liability: [
      'Apex Quantum leverer AI-genererte analyser og signaler. Beslutninger du tar på grunnlag av dem, tar du på eget ansvar. Innholdet i Apex Quantum + er generell markedsanalyse og læringsinnhold — ikke individuell investeringsrådgivning, og ikke tilpasset din økonomiske situasjon, dine mål eller din risikotoleranse.',
      'Vårt erstatningsansvar er begrenset til beløpet du har betalt for tjenesten de siste 12 månedene, så langt gjeldende rett tillater. Vi er ikke ansvarlige for tap som skyldes tredjeparters nedetid eller feil. Fullstendige vilkår finner du på vilkårssiden.',
    ],
    regExtra:
      'Lovgivning rundt automatisert handel og verdipapirformidling kan endre seg. Endringer kan kreve at vi tilpasser tjenesten eller begrenser funksjoner i enkelte jurisdiksjoner. Denne siden oppdateres når regulatorisk status endres.',
  },
  en: {
    title: 'Risk factors',
    updatedLabel: 'Last updated',
    updatedDate: '1 July 2026',
    regEye: 'Regulatory status',
    sections: {
      market: 'Market risk',
      system: 'System risk',
      auto: 'Autonomous trading',
      reg: 'Regulatory status',
      liability: 'Limitation of liability',
    },
    intro: [
      'Apex Quantum is an advanced tool, not a guarantee. Read this page carefully before subscribing, connecting a broker account, or trading on the basis of our analysis.',
    ],
    market: [
      'Securities markets carry ordinary market risk: equity prices can fall fast and materially, without warning and without any model catching it in time. There is no protection against loss of capital — not even through AI-driven decision support.',
      'Some stocks are thinly traded. In volatile markets the bid/ask spread can widen significantly, and exiting a position at the desired price can be difficult. Quarterly reports, macro releases and corporate events can produce large overnight gaps that bypass stop-loss mechanisms.',
      'The platform trades in US dollars. If you measure returns in Norwegian kroner, USD/NOK movements will affect the value of your portfolio — in both directions.',
    ],
    system: [
      'The AI and signal models can be wrong. They are trained on historical data and may carry biases or blind spots that only surface under new market regimes. AI models can misread data, react unexpectedly to unusual market conditions, and produce recommendations that turn out to be wrong.',
      'The service depends on third parties (Alpaca, Clerk, Supabase, Stripe, Vercel, xAI). Outages can delay signals, prevent payments or interrupt data feeds. We cannot guarantee continuous uptime; actually measured status is shown on the status page.',
      'Even though API keys are stored encrypted (AES-256-GCM) and all traffic runs over TLS, a compromised device on your side can expose your account. Use strong authentication and an up-to-date browser.',
    ],
    liability: [
      'Apex Quantum provides AI-generated analysis and signals. Any decisions you make based on them are your own responsibility. The content of Apex Quantum + is general market analysis and educational material — not individual investment advice, and not tailored to your financial situation, goals or risk tolerance.',
      'Our liability is limited, to the extent permitted by applicable law, to the amount you have paid for the service in the preceding 12 months. We are not liable for losses caused by third-party downtime or errors. The full terms are set out on the terms page.',
    ],
    regExtra:
      'Rules around automated trading and securities intermediation can change. Changes may require us to adapt the service or restrict features in particular jurisdictions. This page is updated whenever the regulatory status changes.',
  },
} as const;

function RegStatusCards({ lang }: { lang: Lang }) {
  const reg = REG_STATUS[lang];
  const lines = LEGAL_LINES[lang];
  return (
    <div className="pg-regcards" style={{ marginTop: 28, marginBottom: 12 }}>
      <div className="pg-regcard">
        <span className="pg-regcard-label">{reg.fscLabel}</span>
        <span className="pg-regcard-status" data-tone="warn">
          <span className="pg-dot" data-tone="warn" aria-hidden />
          {reg.fscStatus}
        </span>
        <p className="pg-regcard-note">{lines.l2}</p>
      </div>
      <div className="pg-regcard">
        <span className="pg-regcard-label">{reg.ftLabel}</span>
        <span className="pg-regcard-status" data-tone="faint">
          <span className="pg-dot" data-tone="faint" aria-hidden />
          {reg.ftStatus}
        </span>
        <p className="pg-regcard-note">{lines.l3}</p>
      </div>
    </div>
  );
}

export default function RisikofaktorerPage() {
  return (
    <PageShell>
      {(lang: Lang) => {
        const t = COPY[lang];
        const lines = LEGAL_LINES[lang];
        const maxExtra = ATTESTATION_MAX_EXTRA[lang];
        return (
          <ArticleBody
            title={t.title}
            updatedLabel={t.updatedLabel}
            updatedDate={t.updatedDate}
            body={
              <>
                <p>{t.intro[0]}</p>
                <p>{lines.l5}</p>
                <RegStatusCards lang={lang} />

                <h2>{t.sections.market}</h2>
                <p>{lines.l4}</p>
                {t.market.map((p) => (
                  <p key={p.slice(0, 32)}>{p}</p>
                ))}

                <h2>{t.sections.system}</h2>
                {t.system.map((p) => (
                  <p key={p.slice(0, 32)}>{p}</p>
                ))}

                <h2>{t.sections.auto}</h2>
                {maxExtra.map((p) => (
                  <p key={p.slice(0, 32)}>{p}</p>
                ))}

                <h2>{t.sections.reg}</h2>
                <p>{lines.l1}</p>
                <p>{lines.l2}</p>
                <p>{lines.l3}</p>
                <p>{t.regExtra}</p>

                <h2>{t.sections.liability}</h2>
                {t.liability.map((p) => (
                  <p key={p.slice(0, 32)}>{p}</p>
                ))}
                <p>{lines.l4}</p>
              </>
            }
          />
        );
      }}
    </PageShell>
  );
}

/**
 * Kanonisk juridisk copy — NO/EN. ENESTE kilde for regulatoriske
 * setninger på nettstedet. Når RAIEAS-lisensen innvilges, endres
 * L2 (og kun L2) her — ett sted.
 *
 * NB: Formuleringene bør gjennomgås av juridisk rådgiver før lansering.
 */

import type { Lang } from '@/app/components/marketing/types';

export const RISK_VERSION = 1;

type LegalLines = {
  /** L1 — hva selskapet tilbyr */
  l1: string;
  /** L2 — lisensstatus Mauritius FSC (byttes ved innvilgelse) */
  l2: string;
  /** L3 — norsk regulatorisk status */
  l3: string;
  /** L4 — generell risiko */
  l4: string;
  /** L5 — paper trading-kilde */
  l5: string;
};

export const LEGAL_LINES: Record<Lang, LegalLines> = {
  no: {
    l1: 'Apex Quantum AS tilbyr AI-genererte analyser og, ved lansering av Max, automatisert ordreutførelse via tredjepartsmegler.',
    l2: 'Selskapet har søkt lisens for Robotic and Artificial Intelligence Enabled Advisory Services hos Financial Services Commission, Mauritius. Lisensen er ennå ikke innvilget.',
    l3: 'Apex Quantum har ikke konsesjon fra Finanstilsynet og yter ikke investeringsrådgivning etter verdipapirhandelloven.',
    l4: 'All handel med verdipapirer innebærer risiko for tap av hele det investerte beløpet. Historiske og simulerte resultater gir ingen garanti for fremtidig avkastning.',
    l5: 'Alle resultater som publiseres på nettstedet stammer fra paper trading — simulert handel uten reell kapital — via Alpaca.',
  },
  en: {
    l1: 'Apex Quantum AS provides AI-generated analysis and, upon the launch of Max, automated order execution through a third-party broker.',
    l2: 'The company has applied for a Robotic and Artificial Intelligence Enabled Advisory Services licence with the Financial Services Commission, Mauritius. The licence has not yet been granted.',
    l3: 'Apex Quantum is not authorised by the Financial Supervisory Authority of Norway (Finanstilsynet) and does not provide investment advice under the Norwegian Securities Trading Act.',
    l4: 'All trading in securities carries a risk of losing the entire invested amount. Historical and simulated results are no guarantee of future returns.',
    l5: 'All results published on this website originate from paper trading — simulated trading without real capital — via Alpaca.',
  },
};

/** «Viktig informasjon»-båndet (pre-footer på tallsider) */
export const LEGAL_BAND = {
  no: { title: 'VIKTIG INFORMASJON', ariaLabel: 'Regulatorisk informasjon' },
  en: { title: 'IMPORTANT INFORMATION', ariaLabel: 'Regulatory information' },
} satisfies Record<Lang, { title: string; ariaLabel: string }>;

/** Kildenoten (†) — innhold i popover */
export const SOURCE_NOTE = {
  no: {
    source: 'KILDE: Alpaca Markets API',
    mode: 'PAPER TRADING (simulert kapital)',
    fetchedPrefix: 'HENTET',
    caveat: 'Historiske resultater gir ingen garanti for fremtidig avkastning.',
    riskLink: 'Fullstendige risikofaktorer →',
    methodLink: 'Metodikk →',
    ariaLabel: 'Kilde og forbehold for dette tallet',
  },
  en: {
    source: 'SOURCE: Alpaca Markets API',
    mode: 'PAPER TRADING (simulated capital)',
    fetchedPrefix: 'FETCHED',
    caveat: 'Past performance is no guarantee of future returns.',
    riskLink: 'Full risk factors →',
    methodLink: 'Methodology →',
    ariaLabel: 'Source and caveats for this figure',
  },
} satisfies Record<Lang, Record<string, string>>;

/** PaperTag — obligatorisk i samme synsfelt som KPI-grupper */
export const PAPER_TAG = {
  no: 'PAPER TRADING · INGEN GARANTI FOR FREMTIDIG AVKASTNING',
  en: 'PAPER TRADING · PAST PERFORMANCE IS NO GUARANTEE',
} satisfies Record<Lang, string>;

/** Regulatorisk statuskort (/risikofaktorer, /om-oss) */
export const REG_STATUS = {
  no: {
    fscLabel: 'MAURITIUS FSC · RAIEAS-LISENS',
    fscStatus: 'UNDER BEHANDLING',
    ftLabel: 'FINANSTILSYNET (NO) · KONSESJON',
    ftStatus: 'FORELIGGER IKKE',
  },
  en: {
    fscLabel: 'MAURITIUS FSC · RAIEAS LICENCE',
    fscStatus: 'UNDER REVIEW',
    ftLabel: 'FINANSTILSYNET (NO) · AUTHORISATION',
    ftStatus: 'NOT HELD',
  },
} satisfies Record<Lang, Record<string, string>>;

/**
 * Risikoattestasjon — kreves av RAIEAS-reglene (skriftlig bekreftelse
 * FØR tjenesten leveres). Vises én gang per bruker per RISK_VERSION,
 * lagres i Clerk publicMetadata { riskAttestedAt, riskVersion }.
 */
export const ATTESTATION = {
  no: {
    title: 'Før du starter',
    intro: 'Regelverket vi opererer under krever at du bekrefter at du forstår tjenestens omfang, natur og begrensninger.',
    points: [
      'Apex Quantum leverer AI-genererte analyser og signaler. Beslutninger du tar på grunnlag av dem, tar du på eget ansvar.',
      'All handel med verdipapirer innebærer risiko for tap av hele det investerte beløpet. Historiske og simulerte resultater gir ingen garanti for fremtidig avkastning.',
      'AI-modeller har begrensninger: de kan feiltolke data, reagere uventet på uvanlige markedsforhold og gi anbefalinger som viser seg å være feil.',
    ],
    checkbox: 'Jeg bekrefter at jeg forstår tjenestens omfang, natur, risiko og begrensninger.',
    confirm: 'Bekreft og fortsett',
  },
  en: {
    title: 'Before you begin',
    intro: 'The regulatory framework we operate under requires you to confirm that you understand the scope, nature and limitations of the service.',
    points: [
      'Apex Quantum provides AI-generated analysis and signals. Any decisions you make based on them are your own responsibility.',
      'All trading in securities carries a risk of losing the entire invested amount. Historical and simulated results are no guarantee of future returns.',
      'AI models have limitations: they can misread data, react unexpectedly to unusual market conditions, and produce recommendations that turn out to be wrong.',
    ],
    checkbox: 'I confirm that I understand the scope, nature, risks and limitations of the service.',
    confirm: 'Confirm and continue',
  },
} satisfies Record<Lang, { title: string; intro: string; points: string[]; checkbox: string; confirm: string }>;

/**
 * Utvidet attestasjon for Max/connect-alpaca (autonome ordre).
 * Fullside-steg — IKKE overlay — før megler-API kobles.
 */
export const ATTESTATION_MAX_EXTRA = {
  no: [
    'Max legger inn ordre autonomt, uten manuell godkjenning per handel. Motoren kan handle mens du sover.',
    'Systemrisiko: programvarefeil, API-avbrudd hos megler eller datafeil kan føre til utilsiktede posisjoner eller tap.',
    'Likviditetsrisiko: i urolige markeder kan ordre bli utført til vesentlig dårligere kurser enn forventet.',
    'Du kan når som helst stanse motoren ved å koble Alpaca-kontoen fra i cockpiten. Åpne posisjoner lukkes ikke automatisk ved frakobling.',
  ],
  en: [
    'Max places orders autonomously, without per-trade manual approval. The engine may trade while you sleep.',
    'System risk: software defects, broker API outages or data errors can lead to unintended positions or losses.',
    'Liquidity risk: in turbulent markets, orders may be executed at materially worse prices than expected.',
    'You can stop the engine at any time by disconnecting your Alpaca account in the cockpit. Open positions are not closed automatically on disconnect.',
  ],
} satisfies Record<Lang, string[]>;

/**
 * Salgspause-setningen for Plus (/plus «Kommer snart»-flaten).
 * Søknads-valør konsistent med L2: utfallet ligger hos FSC, ikke hos oss.
 * Byttes sammen med L2 ved innvilgelse — ett sted.
 */
export const PLUS_SALES_PAUSED: Record<Lang, string> = {
  no: 'Salget åpner når lisenssøknaden hos FSC Mauritius er ferdigbehandlet.',
  en: 'Sales open once our licence application with the FSC Mauritius has been processed.',
};

/** Footer-baselinje */
export const FOOTER_BASELINE = {
  no: 'Alle tall: Alpaca paper trading',
  en: 'All figures: Alpaca paper trading',
} satisfies Record<Lang, string>;

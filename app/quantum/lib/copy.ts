/**
 * All UI-copy for Forvalterens bord (/quantum) — NO/EN via Lang-mønsteret.
 * Juridiske setninger hentes ALDRI herfra; de bor i lib/legal-copy.ts.
 */

import type { Lang } from '@/app/components/marketing/types';

export const COCKPIT_COPY = {
  no: {
    // Topplinje
    marketOpen: 'NASDAQ ÅPEN',
    marketClosed: 'NASDAQ STENGT',
    alpacaConnected: 'ALPACA TILKOBLET',
    alpacaDisconnected: 'IKKE TILKOBLET',
    connectCta: 'Koble til →',
    signIn: 'Logg inn',
    // Hovedboken (venstre)
    ledgerTitle: 'HOVEDBOKEN',
    portfolioValue: 'PORTEFØLJEVERDI',
    changePrefix: 'ENDRING',
    positionsTitle: 'POSISJONER',
    weightHeader: 'VEKT',
    noAccount: 'INGEN TILKOBLET KONTO',
    noPositions: 'INGEN ÅPNE POSISJONER',
    dataUnavailable: 'LIVE-DATA UTILGJENGELIG · PRØVER IGJEN',
    // Hovedflate
    chartTitle: 'PORTEFØLJE · UTVIKLING',
    chartEmpty: 'INGEN HISTORIKK Å VISE',
    chatTitle: 'MOTOR · DIALOG',
    chatDisclosure: 'FORHÅNDSDEFINERTE SVAR · INGEN ORDRE UTFØRES HERFRA',
    chatPlaceholder: 'Spør om metoden eller journalen …',
    chatSend: 'Send',
    chatThinking: 'Motoren formulerer svar …',
    // Journalen (høyre)
    journalTitle: 'JOURNALEN',
    filterAll: 'ALLE',
    filterTrades: 'HANDLER',
    filterSignals: 'SIGNALER',
    journalEmpty: 'INGEN HENDELSER ENNÅ',
    newEntries: 'NYE',
    assessment: 'VURDERING',
    orderErr: 'AVVIST',
    orderPending: 'VENTER',
    orderCanceled: 'KANSELLERT',
    // Mobil-tabs
    tabPortfolio: 'PORTEFØLJE',
    tabChart: 'GRAF',
    tabAi: 'AI',
    tabLog: 'LOGG',
    tabOverview: 'OVERSIKT',
    tabJournal: 'JOURNAL',
    blueprint: {
      stocks: 'AKSJER',
      crypto: 'KRYPTO',
      commodities: 'RÅVARER',
    } as Record<'stocks' | 'crypto' | 'commodities', string>,
  },
  en: {
    marketOpen: 'NASDAQ OPEN',
    marketClosed: 'NASDAQ CLOSED',
    alpacaConnected: 'ALPACA CONNECTED',
    alpacaDisconnected: 'NOT CONNECTED',
    connectCta: 'Connect →',
    signIn: 'Sign in',
    ledgerTitle: 'THE LEDGER',
    portfolioValue: 'PORTFOLIO VALUE',
    changePrefix: 'CHANGE',
    positionsTitle: 'POSITIONS',
    weightHeader: 'WEIGHT',
    noAccount: 'NO CONNECTED ACCOUNT',
    noPositions: 'NO OPEN POSITIONS',
    dataUnavailable: 'LIVE DATA UNAVAILABLE · RETRYING',
    chartTitle: 'PORTFOLIO · PERFORMANCE',
    chartEmpty: 'NO HISTORY TO SHOW',
    chatTitle: 'ENGINE · DIALOGUE',
    chatDisclosure: 'PREDEFINED ANSWERS · NO ORDERS ARE PLACED FROM HERE',
    chatPlaceholder: 'Ask about the method or the journal …',
    chatSend: 'Send',
    chatThinking: 'The engine is composing a reply …',
    journalTitle: 'THE JOURNAL',
    filterAll: 'ALL',
    filterTrades: 'TRADES',
    filterSignals: 'SIGNALS',
    journalEmpty: 'NO EVENTS YET',
    newEntries: 'NEW',
    assessment: 'ASSESSMENT',
    orderErr: 'REJECTED',
    orderPending: 'PENDING',
    orderCanceled: 'CANCELED',
    tabPortfolio: 'PORTFOLIO',
    tabChart: 'CHART',
    tabAi: 'AI',
    tabLog: 'LOG',
    tabOverview: 'OVERVIEW',
    tabJournal: 'JOURNAL',
    blueprint: {
      stocks: 'STOCKS',
      crypto: 'CRYPTO',
      commodities: 'COMMODITIES',
    } as Record<'stocks' | 'crypto' | 'commodities', string>,
  },
} satisfies Record<Lang, Record<string, unknown>>;

export type CockpitCopy = (typeof COCKPIT_COPY)['no'];

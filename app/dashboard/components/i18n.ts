// Single source of truth for all dashboard copy + locale-aware number formatters.
export type Lang = 'no' | 'en';

export const I18N = {
  no: {
    // Topbar
    paper: 'PAPER TRADING',
    live: 'LIVE TRADING',
    markets: 'Markeder',
    account: 'Konto',
    balance: 'Saldo',
    disconnect: 'Koble fra',
    sim: 'SIM',
    liveShort: 'LIVE',
    botRunning: 'Bot kjører',
    botPaused: 'Bot pauset',
    stopAll: 'Stopp all handel',

    // Portfolio header
    eyebrow: 'AVKASTNING SIDEN START',
    simCaveat: 'Sim · 1 dag · ikke representativt for live',
    liveCaveat: 'Live · ekte penger',
    liveTag: 'LIVE',
    timeframes: { '1H': '1 time', '24H': '24 timer', '7D': '7 dager', '30D': '30 dager', MTD: 'MTD', YTD: 'YTD', ALL: 'Alt' },

    // Chart summary
    chartNow: 'NÅ',
    chartFromPeak: 'NED FRA TOPP',
    chartVsBench: 'VS S&P 500',

    // Exposure card
    exposureTitle: 'Eksponering nå',
    invested: 'Investert',
    cash: 'Cash',
    largestPosition: 'Største posisjon',
    posPlural: 'posisjoner',
    posSingular: 'posisjon',

    // Failed-order alert
    failTitle: 'Ordre feilet',
    failRetry: 'Prøv på nytt',
    failDismiss: 'Avvis',

    // Withdraw card + modal
    withdrawCardTitle: 'Ta ut gevinst',
    withdrawAvailable: 'tilgjengelig',
    withdrawCardDesc: 'Behold startkapitalen på',
    withdrawCardDescTail: 'og overfør gevinst til kontoen din.',
    withdrawCta: 'Overfør',
    withdraw: 'Hent ut avkastning',
    withdrawSub: 'Selg overskudd · behold startbeløpet',
    withdrawDesc: 'Selger alle posisjoner som overstiger startbeløpet på',
    withdrawAmount: 'Du henter ut',
    withdrawConfirm: 'Bekreft uttak',
    withdrawCancel: 'Avbryt',
    withdrawDone: 'Uttak fullført',
    withdrawNothing: 'Ingen overskudd å hente ut ennå.',
    payout: 'utbetales',
    remaining: 'gjenstår på konto',
    abovePrincipal: 'over startbeløpet',
    transferDone: 'er overført til kontoen din.',
    emptySub: 'Når porteføljen passerer startbeløpet kan du ta ut overskuddet her.',
    fineprint: '🔐 Selger via Alpaca · oppgjør T+0 · ingen gebyr fra Apex',

    // Stat tile labels (legacy stat-grid, kept in case withdraw modal uses them)
    startVal: 'STARTVERDI',
    nowVal: 'NÅVÆRENDE',
    peak: 'TOPP',
    drawdown: 'MAX DRAWDOWN',
    deposit: 'Innskudd',
    withinRisk: 'innenfor risikomål',

    // Watchlist
    watchlistTitle: 'WATCHLIST · AGENTENS UNIVERS',
    watchlistSub: 'Aksjer Apex-blueprinten følger akkurat nå',
    streaming: 'STREAMING',
    holding: 'EID',
    watching: 'OBS',
    ticker: 'TICKER',
    qty: 'ANTALL',
    avg: 'SNITT',
    mark: 'KURS',
    pnl: 'P&L',
    pct: '%',
    signal: 'SIGNAL',
    sigBuy: 'KJØP',
    sigSell: 'SELG',
    sigHold: 'HOLD',
    sigWatch: 'OBS',

    // Recent orders
    ordersTitle: 'NYLIGE ORDRE',
    ordersSub: 'Siste',
    seeAll: 'Se alle →',
    okPill: 'OK',
    errPill: 'FEIL',
    buy: 'KJØP',
    sell: 'SELG',

    // Bottom stats
    statPosOpen: 'POSISJONER ÅPNE',
    statHoldTime: 'Snitt holdetid',
    statHitRate: 'TREFFRATE',
    statHitRateOf: 'Av',
    statHitRateOfTrades: 'handler',
    statMaxLoss: 'MAKS TAP',
    statWithinTarget: 'Innenfor risikomål',
    statSharpe: 'SHARPE',
    statSharpeWindow: '1d',
    statThinData: 'Lite datagrunnlag',
  },
  en: {
    paper: 'PAPER TRADING',
    live: 'LIVE TRADING',
    markets: 'Markets',
    account: 'Account',
    balance: 'Balance',
    disconnect: 'Disconnect',
    sim: 'SIM',
    liveShort: 'LIVE',
    botRunning: 'Bot running',
    botPaused: 'Bot paused',
    stopAll: 'Halt all trading',

    eyebrow: 'RETURNS SINCE INCEPTION',
    simCaveat: 'Sim · 1 day · not representative for live',
    liveCaveat: 'Live · real capital',
    liveTag: 'LIVE',
    timeframes: { '1H': '1 hour', '24H': '24 hours', '7D': '7 days', '30D': '30 days', MTD: 'MTD', YTD: 'YTD', ALL: 'All' },

    chartNow: 'NOW',
    chartFromPeak: 'FROM PEAK',
    chartVsBench: 'VS S&P 500',

    exposureTitle: 'Exposure right now',
    invested: 'Invested',
    cash: 'Cash',
    largestPosition: 'Largest position',
    posPlural: 'positions',
    posSingular: 'position',

    failTitle: 'Order failed',
    failRetry: 'Retry',
    failDismiss: 'Dismiss',

    withdrawCardTitle: 'Take profit',
    withdrawAvailable: 'available',
    withdrawCardDesc: 'Keep starting capital of',
    withdrawCardDescTail: 'and transfer the gain to your account.',
    withdrawCta: 'Transfer',
    withdraw: 'Withdraw profits',
    withdrawSub: 'Sell overage · keep starting capital',
    withdrawDesc: 'Sells every position above the starting capital of',
    withdrawAmount: "You'll withdraw",
    withdrawConfirm: 'Confirm withdrawal',
    withdrawCancel: 'Cancel',
    withdrawDone: 'Withdrawal complete',
    withdrawNothing: 'No profit to withdraw yet.',
    payout: 'payout',
    remaining: 'remaining on account',
    abovePrincipal: 'above starting capital',
    transferDone: 'has been transferred to your account.',
    emptySub: 'Once the portfolio passes starting capital you can take profits here.',
    fineprint: '🔐 Sells via Alpaca · settlement T+0 · no fee from Apex',

    startVal: 'START',
    nowVal: 'CURRENT',
    peak: 'PEAK',
    drawdown: 'MAX DRAWDOWN',
    deposit: 'Deposit',
    withinRisk: 'within risk target',

    watchlistTitle: 'WATCHLIST · AGENT UNIVERSE',
    watchlistSub: 'Stocks the Apex blueprint is tracking right now',
    streaming: 'STREAMING',
    holding: 'HELD',
    watching: 'WATCH',
    ticker: 'TICKER',
    qty: 'QTY',
    avg: 'AVG',
    mark: 'MARK',
    pnl: 'P&L',
    pct: '%',
    signal: 'SIGNAL',
    sigBuy: 'BUY',
    sigSell: 'SELL',
    sigHold: 'HOLD',
    sigWatch: 'WATCH',

    ordersTitle: 'RECENT ORDERS',
    ordersSub: 'Last',
    seeAll: 'See all →',
    okPill: 'OK',
    errPill: 'ERR',
    buy: 'BUY',
    sell: 'SELL',

    statPosOpen: 'OPEN POSITIONS',
    statHoldTime: 'Avg hold',
    statHitRate: 'HIT RATE',
    statHitRateOf: 'Of',
    statHitRateOfTrades: 'trades',
    statMaxLoss: 'MAX LOSS',
    statWithinTarget: 'Within risk target',
    statSharpe: 'SHARPE',
    statSharpeWindow: '1d',
    statThinData: 'Thin data',
  },
} as const;

export const fmtMoney = (n: number, lang: Lang): string => {
  if (lang === 'no') {
    const parts = n.toFixed(2).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return parts.join(',');
  }
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Suffix follows the *real* account currency from Alpaca, not the UI language.
// Only render "kr" when the underlying ledger is actually NOK; otherwise show
// the ISO code (USD, EUR, …) so the dashboard can never disagree with Alpaca.
export const moneySuffix = (lang: Lang, currency?: string | null): string => {
  const code = (currency || 'USD').toUpperCase();
  if (code === 'NOK') return 'kr';
  return code;
};

export const fmtUSD = (n: number): string =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

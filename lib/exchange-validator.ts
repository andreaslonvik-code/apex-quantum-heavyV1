/**
 * Exchange Validator for Apex Quantum (Alpaca-only).
 * Alpaca routes US equities only. Valid exchange codes:
 *   NASDAQ, NYSE, ARCA, AMEX, BATS, IEX, OTC
 *
 * Override via env: ALLOWED_EXCHANGES="NASDAQ,NYSE,ARCA,AMEX"
 */

const DEFAULT_ALLOWED = ['NASDAQ', 'NYSE', 'ARCA', 'AMEX'];

function getAllowed(): string[] {
  const raw = process.env.ALLOWED_EXCHANGES;
  if (!raw) return DEFAULT_ALLOWED;
  return raw.split(',').map((e) => e.trim().toUpperCase()).filter(Boolean);
}

export function isExchangeAllowed(exchange: string | undefined): boolean {
  if (!exchange) return false;
  return getAllowed().includes(exchange.toUpperCase().trim());
}

export function validateInstrumentExchange(exchange: string | undefined): {
  valid: boolean;
  exchange: string;
  reason: string;
} {
  if (!exchange) {
    return { valid: false, exchange: 'UNKNOWN', reason: 'No exchange provided' };
  }
  const norm = exchange.toUpperCase().trim();
  if (!isExchangeAllowed(norm)) {
    return {
      valid: false,
      exchange: norm,
      reason: `Exchange ${norm} is not in allowed list: ${getAllowed().join(', ')}`,
    };
  }
  return { valid: true, exchange: norm, reason: 'Exchange approved for trading' };
}

export function getExchangeConfig() {
  const allowed = getAllowed();
  const names: Record<string, string> = {
    NASDAQ: 'Nasdaq',
    NYSE: 'New York Stock Exchange',
    ARCA: 'NYSE Arca',
    AMEX: 'NYSE American',
    BATS: 'Cboe BZX',
    IEX: 'IEX',
    OTC: 'OTC Markets',
  };
  return {
    allowed,
    allowedNames: allowed.map((ex) => names[ex] || ex),
  };
}

/**
 * Exchange Validator for Apex Quantum
 * Validates that instruments belong to allowed exchanges
 * Enforces whitelist and priority ordering
 */

// Parse allowed exchanges from .env
function getAllowedExchanges(): string[] {
  const allowed = process.env.ALLOWED_EXCHANGES || 'XNAS,XNYS,XOSL';
  return allowed.split(',').map(e => e.trim().toUpperCase());
}

// Parse exchange priority from .env
function getPriorityList(): string[] {
  const priority = process.env.EXCHANGE_PRIORITY || 'XNAS,XNYS,XOSL';
  return priority.split(',').map(e => e.trim().toUpperCase());
}

/**
 * Validate if an exchange is allowed for trading
 * @param exchange - Exchange ID from Saxo API (e.g., 'XNAS', 'XOSL')
 * @returns true if exchange is in whitelist
 */
export function isExchangeAllowed(exchange: string | undefined): boolean {
  if (!exchange) return false;
  
  const normalizedExchange = exchange.toUpperCase().trim();
  const allowed = getAllowedExchanges();
  const isAllowed = allowed.includes(normalizedExchange);
  
  if (!isAllowed) {
    console.log(`[EXCHANGE FILTER] ❌ Exchange ${normalizedExchange} REJECTED - not in whitelist [${allowed.join(', ')}]`);
  } else {
    console.log(`[EXCHANGE FILTER] ✅ Exchange ${normalizedExchange} APPROVED`);
  }
  
  return isAllowed;
}

/**
 * Get priority score for an exchange (lower = higher priority)
 * Used for sorting instruments when multiple matches exist
 */
export function getExchangePriority(exchange?: string): number {
  if (!exchange) return 999;
  
  const normalizedExchange = exchange.toUpperCase().trim();
  const priority = getPriorityList();
  const index = priority.indexOf(normalizedExchange);
  
  return index >= 0 ? index : 999; // 999 = lowest priority (not in list)
}

/**
 * Get all allowed exchanges as a comma-separated string for Saxo API filters
 */
export function getAllowedExchangesForFilter(separator = ','): string {
  return getAllowedExchanges().join(separator);
}

/**
 * Get configuration object for display in UI
 */
export function getExchangeConfig() {
  const allowed = getAllowedExchanges();
  const priority = getPriorityList();
  
  const exchangeNames: Record<string, string> = {
    'XNAS': 'NASDAQ',
    'XNYS': 'NYSE',
    'XOSL': 'Oslo Børs',
    'XETR': 'XETRA',
    'XHKG': 'Hong Kong',
    'XSHG': 'Shanghai',
  };
  
  return {
    allowed,
    priority,
    allowedNames: allowed.map(ex => exchangeNames[ex] || ex),
    priorityNames: priority.map(ex => exchangeNames[ex] || ex),
  };
}

/**
 * Validate instrument exchange and return true if it should be tradeable
 */
export function validateInstrumentExchange(exchange: string | undefined): {
  valid: boolean;
  exchange: string;
  reason: string;
} {
  if (!exchange) {
    return {
      valid: false,
      exchange: 'UNKNOWN',
      reason: 'No exchange provided',
    };
  }
  
  const normalizedExchange = exchange.toUpperCase().trim();
  
  if (!isExchangeAllowed(normalizedExchange)) {
    return {
      valid: false,
      exchange: normalizedExchange,
      reason: `Exchange ${normalizedExchange} is not in allowed list: ${getAllowedExchanges().join(', ')}`,
    };
  }
  
  return {
    valid: true,
    exchange: normalizedExchange,
    reason: 'Exchange approved for trading',
  };
}

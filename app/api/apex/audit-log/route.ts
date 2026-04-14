// APEX QUANTUM v6.2 - Audit Log API
// Heavy logging of all trading activity

import { NextResponse } from 'next/server';

// In-memory audit log (would be Vercel Postgres in production)
interface AuditLogEntry {
  id: string;
  timestamp: string;
  type: 'TICK' | 'ORDER' | 'SIGNAL' | 'ERROR' | 'RATE_LIMIT' | 'CIRCUIT_BREAKER';
  ticker?: string;
  action?: 'BUY' | 'SELL';
  amount?: number;
  price?: number;
  grokRequest?: string;
  grokResponse?: string;
  saxoRequest?: string;
  saxoResponse?: string;
  errorMessage?: string;
  success: boolean;
  durationMs?: number;
}

const auditLog: AuditLogEntry[] = [];
const MAX_AUDIT_LOG = 500;

export function addAuditLog(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): AuditLogEntry {
  const fullEntry: AuditLogEntry = {
    ...entry,
    id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
  };
  
  auditLog.unshift(fullEntry);
  
  if (auditLog.length > MAX_AUDIT_LOG) {
    auditLog.pop();
  }
  
  // Log to console for Vercel logs
  console.log(`[APEX AUDIT] ${fullEntry.type}: ${fullEntry.success ? 'SUCCESS' : 'FAILED'} - ${fullEntry.ticker || ''} ${fullEntry.action || ''} ${fullEntry.errorMessage || ''}`);
  
  return fullEntry;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');
  
  let filtered = auditLog;
  
  if (type) {
    filtered = auditLog.filter(e => e.type === type);
  }
  
  const paginated = filtered.slice(offset, offset + limit);
  
  return NextResponse.json({
    entries: paginated,
    total: filtered.length,
    hasMore: offset + limit < filtered.length,
  });
}

// Export for use in other routes
export { auditLog, type AuditLogEntry };

/**
 * Rate Limiting System for Apex Quantum
 * Implements token bucket algorithm with per-IP/user tracking
 */

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  keyGenerator: (req: Request) => string; // Function to generate rate limit key
}

interface RateLimitEntry {
  tokens: number;
  lastRefill: number;
  requestCount: number;
  resetTime: number;
}

class RateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timer | null = null;

  constructor() {
    // Cleanup old entries every 5 minutes
    if (typeof global !== 'undefined') {
      this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
    }
  }

  private getClientIdentifier(request: Request): string {
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    return `${ip}:${userAgent}`;
  }

  check(
    identifier: string,
    maxRequests: number = 30,
    windowMs: number = 60 * 1000 // 1 minute default
  ): { allowed: boolean; remaining: number; resetTime: number; retryAfter?: number } {
    const now = Date.now();
    let entry = this.store.get(identifier);

    // Initialize or reset entry if window has expired
    if (!entry || now > entry.resetTime) {
      entry = {
        tokens: maxRequests,
        lastRefill: now,
        requestCount: 0,
        resetTime: now + windowMs,
      };
      this.store.set(identifier, entry);
    }

    entry.requestCount++;

    if (entry.tokens > 0) {
      entry.tokens--;
      return {
        allowed: true,
        remaining: entry.tokens,
        resetTime: entry.resetTime,
      };
    }

    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime,
      retryAfter,
    };
  }

  private cleanup() {
    const now = Date.now();
    const entriesToDelete: string[] = [];

    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetTime + 10 * 60 * 1000) {
        // Keep entries for 10 minutes after reset
        entriesToDelete.push(key);
      }
    }

    entriesToDelete.forEach(key => this.store.delete(key));
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.store.clear();
  }
}

// Export singleton instance
export const rateLimiter = new RateLimiter();

/**
 * Middleware helper for Next.js API routes
 * Usage in API route:
 * 
 * export async function POST(request: NextRequest) {
 *   const result = checkRateLimit(request);
 *   if (!result.allowed) {
 *     return createRateLimitResponse(result);
 *   }
 *   // ... rest of your handler
 * }
 */

export function checkRateLimit(
  request: Request,
  maxRequests?: number,
  windowMs?: number
): { allowed: boolean; remaining: number; resetTime: number; retryAfter?: number } {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';

  // Get limits from environment or use defaults
  const maxPerMinute = parseInt(process.env.RATE_LIMIT_REQUESTS_PER_MINUTE || '30');
  const maxPerHour = parseInt(process.env.RATE_LIMIT_REQUESTS_PER_HOUR || '500');

  // Check per-minute limit
  const minuteResult = rateLimiter.check(
    `minute:${ip}`,
    maxPerMinute || maxRequests || 30,
    windowMs || 60 * 1000
  );

  // Check per-hour limit
  const hourResult = rateLimiter.check(
    `hour:${ip}`,
    maxPerHour || maxRequests || 500,
    windowMs || 60 * 60 * 1000
  );

  // If either limit is exceeded, deny the request
  if (!minuteResult.allowed) {
    return minuteResult;
  }

  if (!hourResult.allowed) {
    return hourResult;
  }

  return minuteResult;
}

/**
 * Creates a rate limit error response
 */
export function createRateLimitResponse(
  result: { remaining: number; resetTime: number; retryAfter?: number; allowed: boolean }
) {
  const { NextResponse } = require('next/server');

  const resetTime = new Date(result.resetTime).toISOString();
  const retryAfter = result.retryAfter || Math.ceil((result.resetTime - Date.now()) / 1000);

  return new NextResponse(
    JSON.stringify({
      error: 'Too many requests',
      message: `Rate limit exceeded. Retry after ${retryAfter} seconds.`,
      resetTime,
      remaining: result.remaining,
    }),
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfter),
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset': resetTime,
      },
    }
  );
}

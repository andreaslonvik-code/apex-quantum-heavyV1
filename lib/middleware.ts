// ============================================================
// APEX QUANTUM v6.1 - REQUEST MIDDLEWARE
// Rate limiting, logging, security, and monitoring
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { rateLimiter } from './rate-limiter';
import { logger } from './logger';
import { v4 as uuidv4 } from 'crypto';

declare global {
  namespace globalThis {
    var requestMetadata: Map<string, RequestMetadata>;
  }
}

interface RequestMetadata {
  id: string;
  startTime: number;
  ip: string;
  userAgent: string;
}

// Initialize global request tracking
if (!globalThis.requestMetadata) {
  globalThis.requestMetadata = new Map();
}

/**
 * Get client IP address from request
 */
export function getClientIP(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  return forwardedFor?.split(',')[0].trim() || realIP || 'unknown';
}

/**
 * Generate unique request ID
 */
export function generateRequestID(): string {
  return uuidv4();
}

/**
 * Rate limiting middleware
 */
export async function rateLimitMiddleware(request: NextRequest) {
  const ip = getClientIP(request);
  const requestsPerMinute = parseInt(process.env.RATE_LIMIT_REQUESTS_PER_MINUTE || '60');
  
  const result = rateLimiter.check(ip, requestsPerMinute, 60 * 1000);
  
  if (!result.allowed) {
    logger.warn('Rate limit exceeded', {
      ip,
      endpoint: request.nextUrl.pathname,
      remaining: result.remaining,
    });
    
    return new NextResponse(
      JSON.stringify({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please try again later.',
          retryAfter: result.retryAfter,
        },
      }),
      {
        status: 429,
        headers: {
          'Retry-After': String(result.retryAfter),
          'Content-Type': 'application/json',
        },
      }
    );
  }

  return null; // Allow request to proceed
}

/**
 * Security headers middleware
 */
export function securityHeadersMiddleware(response: NextResponse): NextResponse {
  // Content Security Policy
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';"
  );

  // X-Content-Type-Options
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // X-Frame-Options
  response.headers.set('X-Frame-Options', 'DENY');

  // X-XSS-Protection
  response.headers.set('X-XSS-Protection', '1; mode=block');

  // Referrer-Policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions-Policy
  response.headers.set(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=()'
  );

  // HSTS
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }

  return response;
}

/**
 * Logging middleware
 */
export function loggingMiddleware(
  request: NextRequest,
  response: NextResponse,
  duration: number
) {
  const method = request.method;
  const pathname = request.nextUrl.pathname;
  const ip = getClientIP(request);
  const statusCode = response.status;
  const userAgent = request.headers.get('user-agent') || 'unknown';

  logger.logApiRequest(method, pathname, statusCode, duration, {
    ip,
    userAgent,
    pathname,
  });
}

/**
 * Request tracking middleware wrapper
 */
export async function withMiddleware(
  handler: (request: NextRequest) => Promise<NextResponse>
): Promise<(request: NextRequest) => Promise<NextResponse>> {
  return async (request: NextRequest): Promise<NextResponse> => {
    const requestID = generateRequestID();
    const startTime = Date.now();
    const ip = getClientIP(request);
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Add request metadata to global store
    globalThis.requestMetadata.set(requestID, {
      id: requestID,
      startTime,
      ip,
      userAgent,
    });

    try {
      // Apply rate limiting
      const rateLimitError = await rateLimitMiddleware(request);
      if (rateLimitError) {
        return rateLimitError;
      }

      // Execute the handler
      let response = await handler(request);

      // Apply security headers
      response = securityHeadersMiddleware(response);

      // Add request tracking headers
      response.headers.set('X-Request-ID', requestID);

      // Log request
      const duration = Date.now() - startTime;
      loggingMiddleware(request, response, duration);

      return response;
    } catch (error) {
      logger.error('Middleware error', error as Error, {
        requestID,
        ip,
        endpoint: request.nextUrl.pathname,
      });

      return new NextResponse(
        JSON.stringify({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred',
            requestID,
          },
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'X-Request-ID': requestID,
          },
        }
      );
    } finally {
      // Cleanup request metadata
      const duration = Date.now() - startTime;
      if (duration > 30000) {
        // Warn if request took too long
        logger.warn('Slow request detected', {
          requestID,
          duration,
          ip,
          endpoint: request.nextUrl.pathname,
        });
      }

      globalThis.requestMetadata.delete(requestID);
    }
  };
}

/**
 * Get request metadata
 */
export function getRequestMetadata(requestID: string): RequestMetadata | undefined {
  return globalThis.requestMetadata.get(requestID);
}

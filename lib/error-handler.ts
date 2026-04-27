/**
 * Centralized Error Handling for Apex Quantum
 * Provides consistent error responses and error tracking
 */

import { logger } from './logger';

export class ApexError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    message: string,
    public context?: Record<string, any>,
    public isDeveloperError: boolean = false
  ) {
    super(message);
    this.name = 'ApexError';
  }
}

export const ErrorCodes = {
  // Validation errors
  INVALID_INPUT: 'INVALID_INPUT',
  INVALID_TOKEN: 'INVALID_TOKEN',
  MISSING_PARAMETER: 'MISSING_PARAMETER',

  // Authentication/Authorization
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  SESSION_EXPIRED: 'SESSION_EXPIRED',

  // API/Integration errors
  ALPACA_API_ERROR: 'ALPACA_API_ERROR',
  GROK_API_ERROR: 'GROK_API_ERROR',
  EXTERNAL_API_ERROR: 'EXTERNAL_API_ERROR',

  // Trading/Business logic errors
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  TRADE_LIMIT_EXCEEDED: 'TRADE_LIMIT_EXCEEDED',
  POSITION_NOT_FOUND: 'POSITION_NOT_FOUND',
  ORDER_FAILED: 'ORDER_FAILED',

  // System errors
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  DATABASE_ERROR: 'DATABASE_ERROR',
  TIMEOUT: 'TIMEOUT',

  // Rate limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
};

export class ErrorHandler {
  static handle(error: unknown, context?: Record<string, any>) {
    if (error instanceof ApexError) {
      return this.handleApexError(error, context);
    }

    if (error instanceof Error) {
      return this.handleStandardError(error, context);
    }

    return this.handleUnknownError(error, context);
  }

  private static handleApexError(error: ApexError, context?: Record<string, any>) {
    logger.error(error.message, error, {
      code: error.code,
      ...error.context,
      ...context,
    });

    return {
      statusCode: error.statusCode,
      error: {
        code: error.code,
        message: this.getSafeMessage(error),
        isDeveloperError: error.isDeveloperError,
        ...(process.env.NODE_ENV === 'development' && { debug: error.context }),
      },
    };
  }

  private static handleStandardError(error: Error, context?: Record<string, any>) {
    logger.error(error.message, error, context);

    return {
      statusCode: 500,
      error: {
        code: ErrorCodes.INTERNAL_SERVER_ERROR,
        message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
        isDeveloperError: true,
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
      },
    };
  }

  private static handleUnknownError(error: unknown, context?: Record<string, any>) {
    logger.error('Unknown error occurred', undefined, { error, ...context });

    return {
      statusCode: 500,
      error: {
        code: ErrorCodes.INTERNAL_SERVER_ERROR,
        message: 'An unexpected error occurred',
        isDeveloperError: true,
      },
    };
  }

  private static getSafeMessage(error: ApexError): string {
    const safeMessages: Record<string, string> = {
      [ErrorCodes.INVALID_INPUT]: 'Invalid input provided',
      [ErrorCodes.INVALID_TOKEN]: 'Invalid authentication token',
      [ErrorCodes.UNAUTHORIZED]: 'You are not authorized to perform this action',
      [ErrorCodes.ALPACA_API_ERROR]: 'Failed to connect to trading platform',
      [ErrorCodes.GROK_API_ERROR]: 'AI model unavailable, please try again',
      [ErrorCodes.INSUFFICIENT_BALANCE]: 'Insufficient account balance for this trade',
      [ErrorCodes.TRADE_LIMIT_EXCEEDED]: 'Trade limit exceeded, cannot place order',
      [ErrorCodes.RATE_LIMIT_EXCEEDED]: 'Too many requests, please try again later',
      [ErrorCodes.SERVICE_UNAVAILABLE]: 'Service unavailable, please try again later',
    };

    return safeMessages[error.code] || error.message;
  }
}

export function createErrorResponse(error: unknown, context?: Record<string, any>) {
  const { NextResponse } = require('next/server');
  const handled = ErrorHandler.handle(error, context);

  return new NextResponse(JSON.stringify(handled.error), {
    status: handled.statusCode,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Wraps async API handlers to catch errors
 */
export function withErrorHandling(handler: Function) {
  return async (request: Request, context?: any) => {
    try {
      return await handler(request, context);
    } catch (error) {
      return createErrorResponse(error, { endpoint: request.url });
    }
  };
}

/**
 * Grok-specific error
 */
export class GrokError extends ApexError {
  constructor(message: string, statusCode: number = 500, context?: Record<string, any>) {
    super(
      ErrorCodes.GROK_API_ERROR,
      statusCode,
      message,
      context,
      false
    );
    this.name = 'GrokError';
  }
}

/**
 * Validation error
 */
export class ValidationError extends ApexError {
  constructor(message: string, context?: Record<string, any>) {
    super(
      ErrorCodes.INVALID_INPUT,
      400,
      message,
      context,
      false
    );
    this.name = 'ValidationError';
  }
}

/**
 * Streaming/WebSocket error
 */
export class StreamingError extends ApexError {
  constructor(message: string, context?: Record<string, any>) {
    super(
      'STREAMING_ERROR',
      500,
      message,
      context,
      false
    );
    this.name = 'StreamingError';
  }
}

/**
 * Retry logic for transient errors
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      const apexError = error instanceof ApexError ? error : undefined;
      if (apexError && !apexError.isDeveloperError) {
        // Don't retry if error is not retryable
        throw apexError;
      }

      if (i < maxRetries - 1) {
        const delay = delayMs * Math.pow(2, i);
        logger.warn(`Retrying after ${delay}ms`, { attempt: i + 1, maxRetries });
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new ApexError(
    ErrorCodes.INTERNAL_SERVER_ERROR,
    500,
    'Max retries exceeded'
  );
}

/**
 * Creates a validation error
 */
export function createValidationError(message: string, context?: Record<string, any>) {
  return new ApexError(
    ErrorCodes.INVALID_INPUT,
    400,
    message,
    context
  );
}

/**
 * Creates an authentication error
 */
export function createAuthError(message: string = 'Authentication required', context?: Record<string, any>) {
  return new ApexError(
    ErrorCodes.UNAUTHORIZED,
    401,
    message,
    context
  );
}

/**
 * Creates a not found error
 */
export function createNotFoundError(resource: string) {
  return new ApexError(
    'NOT_FOUND',
    404,
    `${resource} not found`
  );
}

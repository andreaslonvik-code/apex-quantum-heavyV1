/**
 * Centralized Logging System for Apex Quantum
 * Handles structured logging with request tracking, performance monitoring, and error logging
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  requestId?: string;
  userId?: string;
  endpoint?: string;
  duration?: number;
  statusCode?: number;
  userAgent?: string;
  [key: string]: any;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context: LogContext;
  stack?: string;
}

class ApexLogger {
  private logLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
  private format: 'json' | 'text' = (process.env.LOG_FORMAT as 'json' | 'text') || 'json';
  private isDevelopment = process.env.NODE_ENV !== 'production';

  private levelPriority = { debug: 0, info: 1, warn: 2, error: 3 };

  private shouldLog(level: LogLevel): boolean {
    return this.levelPriority[level] >= this.levelPriority[this.logLevel];
  }

  private formatOutput(entry: LogEntry): string {
    if (this.format === 'json') {
      return JSON.stringify(entry);
    }

    const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}]`;
    const context = Object.keys(entry.context).length > 0 ? ` | ${JSON.stringify(entry.context)}` : '';
    return `${prefix} ${entry.message}${context}${entry.stack ? '\n' + entry.stack : ''}`;
  }

  private getTimestamp(): string {
    return new Date().toISOString();
  }

  private log(level: LogLevel, message: string, context: LogContext = {}, error?: Error) {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: this.getTimestamp(),
      level,
      message,
      context,
      stack: error?.stack,
    };

    const output = this.formatOutput(entry);

    if (level === 'error') {
      console.error(output);
    } else if (level === 'warn') {
      console.warn(output);
    } else {
      console.log(output);
    }

    // In production, send to external service (e.g., Sentry, DataDog, CloudWatch)
    if (process.env.NODE_ENV === 'production' && level === 'error') {
      this.sendToExternalService(entry);
    }
  }

  private sendToExternalService(entry: LogEntry) {
    // This would integrate with Sentry, DataDog, or similar
    // Example: Sentry integration
    if (typeof window === 'undefined' && process.env.SENTRY_DSN) {
      // Server-side Sentry logging
      try {
        // Sentry.captureMessage(entry.message, entry.level);
      } catch (e) {
        console.error('Failed to send log to external service:', e);
      }
    }
  }

  debug(message: string, context?: LogContext) {
    this.log('debug', message, context);
  }

  info(message: string, context?: LogContext) {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext) {
    this.log('warn', message, context);
  }

  error(message: string, error?: Error, context?: LogContext) {
    this.log('error', message, context, error);
  }

  // API request logging helper
  logApiRequest(method: string, endpoint: string, statusCode: number, duration: number, context?: LogContext) {
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    this.log(level, `${method} ${endpoint}`, {
      statusCode,
      duration,
      ...context,
    });
  }

  // Performance logging helper
  logPerformance(operation: string, duration: number, context?: LogContext) {
    const level = duration > 1000 ? 'warn' : 'info';
    this.log(level, `Performance: ${operation}`, {
      duration,
      ...context,
    });
  }
}

export const logger = new ApexLogger();

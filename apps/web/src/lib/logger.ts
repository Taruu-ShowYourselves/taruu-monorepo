/**
 * Structured logging utility for production use.
 *
 * Provides:
 * - Log levels (debug, info, warn, error)
 * - Structured context (key-value pairs)
 * - Environment-aware output (JSON in production, pretty in dev)
 * - Child loggers for component-specific logging
 *
 * Usage:
 * ```ts
 * import { logger } from '@/lib/logger';
 *
 * // Simple logging
 * logger.info('Payment processed');
 *
 * // With context
 * logger.error('Payment failed', { paymentId, userId, error });
 *
 * // Child logger for a component
 * const log = logger.child({ component: 'webhook' });
 * log.info('Webhook received', { eventType });
 * ```
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: LogContext;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const isProduction = process.env.NODE_ENV === 'production';
const minLevel = (process.env.LOG_LEVEL as LogLevel) || (isProduction ? 'info' : 'debug');

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[minLevel];
}

function formatError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  return { raw: String(error) };
}

function sanitizeContext(context: LogContext): LogContext {
  const sanitized: LogContext = {};

  for (const [key, value] of Object.entries(context)) {
    if (value instanceof Error) {
      sanitized[key] = formatError(value);
    } else if (typeof value === 'object' && value !== null) {
      try {
        // Test if serializable
        JSON.stringify(value);
        sanitized[key] = value;
      } catch {
        sanitized[key] = String(value);
      }
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

function formatOutput(entry: LogEntry): string {
  if (isProduction) {
    // JSON output for production (easier to parse in log aggregators)
    return JSON.stringify(entry);
  }

  // Pretty output for development
  const levelColors: Record<LogLevel, string> = {
    debug: '\x1b[36m', // cyan
    info: '\x1b[32m',  // green
    warn: '\x1b[33m',  // yellow
    error: '\x1b[31m', // red
  };
  const reset = '\x1b[0m';
  const color = levelColors[entry.level];

  let output = `${color}[${entry.level.toUpperCase()}]${reset} ${entry.message}`;

  if (entry.context && Object.keys(entry.context).length > 0) {
    output += ` ${JSON.stringify(entry.context, null, 2)}`;
  }

  return output;
}

function log(level: LogLevel, message: string, context?: LogContext): void {
  if (!shouldLog(level)) {
    return;
  }

  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(context && Object.keys(context).length > 0 && { context: sanitizeContext(context) }),
  };

  const output = formatOutput(entry);

  switch (level) {
    case 'error':
      console.error(output);
      break;
    case 'warn':
      console.warn(output);
      break;
    default:
      console.log(output);
  }
}

interface Logger {
  debug: (message: string, context?: LogContext) => void;
  info: (message: string, context?: LogContext) => void;
  warn: (message: string, context?: LogContext) => void;
  error: (message: string, context?: LogContext) => void;
  child: (baseContext: LogContext) => Logger;
}

function createLogger(baseContext: LogContext = {}): Logger {
  const mergeContext = (context?: LogContext): LogContext | undefined => {
    if (!context && Object.keys(baseContext).length === 0) {
      return undefined;
    }
    return { ...baseContext, ...context };
  };

  return {
    debug: (message, context) => log('debug', message, mergeContext(context)),
    info: (message, context) => log('info', message, mergeContext(context)),
    warn: (message, context) => log('warn', message, mergeContext(context)),
    error: (message, context) => log('error', message, mergeContext(context)),
    child: (childContext) => createLogger({ ...baseContext, ...childContext }),
  };
}

// Default logger instance
export const logger = createLogger();

// Pre-configured loggers for common components
export const webhookLogger = logger.child({ component: 'webhook' });
export const cronLogger = logger.child({ component: 'cron' });
export const authLogger = logger.child({ component: 'auth' });
export const paymentLogger = logger.child({ component: 'payment' });
export const verificationLogger = logger.child({ component: 'verification' });

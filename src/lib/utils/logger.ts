/**
 * Production Logger Utility
 *
 * Conditional logging that respects environment:
 * - Development: All logs output to console
 * - Production: Only errors output (can be sent to Sentry)
 *
 * Usage:
 *   import { logger } from './logger';
 *
 *   logger.debug('Detailed debugging info', { data });
 *   logger.info('Informational message', { context });
 *   logger.warn('Warning message', { warning });
 *   logger.error('Error occurred', error);
 *
 * Replace console.log/error/warn with:
 *   console.log(...) → logger.info(...)
 *   console.error(...) → logger.error(...)
 *   console.warn(...) → logger.warn(...)
 *   console.debug(...) → logger.debug(...)
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LoggerConfig {
  /** Minimum log level to output (default: 'info' in prod, 'debug' in dev) */
  minLevel?: LogLevel;
  /** Enable console output (default: NODE_ENV !== 'production') */
  enableConsole?: boolean;
  /** Enable Sentry integration for errors (default: false) */
  enableSentry?: boolean;
  /** Prefix for all log messages (default: none) */
  prefix?: string;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private config: Required<LoggerConfig>;

  constructor(config: LoggerConfig = {}) {
    const isDevelopment = process.env.NODE_ENV !== 'production';

    this.config = {
      minLevel: config.minLevel ?? (isDevelopment ? 'debug' : 'warn'),
      enableConsole: config.enableConsole ?? isDevelopment,
      enableSentry: config.enableSentry ?? false,
      prefix: config.prefix ?? '',
    };
  }

  /**
   * Check if a log level should be output
   */
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.minLevel];
  }

  /**
   * Format log message with prefix and timestamp
   */
  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    const prefix = this.config.prefix ? `[${this.config.prefix}]` : '';
    return `${timestamp} ${prefix} [${level.toUpperCase()}] ${message}`;
  }

  /**
   * Log debug information (development only)
   */
  debug(message: string, ...args: unknown[]): void {
    if (!this.shouldLog('debug')) return;

    if (this.config.enableConsole) {
      console.debug(this.formatMessage('debug', message), ...args);
    }
  }

  /**
   * Log informational message (development only by default)
   */
  info(message: string, ...args: unknown[]): void {
    if (!this.shouldLog('info')) return;

    if (this.config.enableConsole) {
      console.info(this.formatMessage('info', message), ...args);
    }
  }

  /**
   * Log warning message (both dev and prod)
   */
  warn(message: string, ...args: unknown[]): void {
    if (!this.shouldLog('warn')) return;

    if (this.config.enableConsole) {
      console.warn(this.formatMessage('warn', message), ...args);
    }

    if (this.config.enableSentry) {
      this.sendToSentry('warning', message, args);
    }
  }

  /**
   * Log error message (both dev and prod)
   */
  error(message: string, error?: Error | unknown, ...args: unknown[]): void {
    if (!this.shouldLog('error')) return;

    if (this.config.enableConsole) {
      console.error(this.formatMessage('error', message), error, ...args);
    }

    if (this.config.enableSentry) {
      this.sendToSentry('error', message, [error, ...args]);
    }
  }

  /**
   * Send error/warning to Sentry (placeholder for future integration)
   */
  private sendToSentry(level: 'warning' | 'error', message: string, context: unknown[]): void {
    // TODO: Integrate with Sentry
    // For now, just log that we would send to Sentry
    if (this.config.enableConsole) {
      console.log('[Sentry]', level, message, context);
    }
  }

  /**
   * Create a child logger with a prefix
   */
  child(prefix: string): Logger {
    const childPrefix = this.config.prefix
      ? `${this.config.prefix}:${prefix}`
      : prefix;

    return new Logger({
      ...this.config,
      prefix: childPrefix,
    });
  }

  /**
   * Update logger configuration
   */
  configure(config: Partial<LoggerConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }
}

// Default logger instance
export const logger = new Logger();

// Convenience function to create namespaced loggers
export function createLogger(prefix: string, config?: LoggerConfig): Logger {
  return new Logger({ ...config, prefix });
}

/**
 * Example usage in different parts of the app:
 *
 * // In a component:
 * const log = createLogger('PredictionCard');
 * log.info('Rendering prediction', { speciesId });
 * log.error('Failed to load image', error);
 *
 * // In an API route:
 * const log = createLogger('api/findr/predictions');
 * log.info('Fetching predictions', { rectangleCode });
 * log.error('Database query failed', error);
 *
 * // In a utility:
 * const log = createLogger('CMEMS');
 * log.debug('Fetching data', { params });
 * log.warn('Data stale', { age });
 */

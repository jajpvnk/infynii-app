type TLogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug';

type TLoggerOptions = {
  enabled?: boolean;
  prefix?: string;
  timestamp?: boolean;
};

class Logger {
  private enabled: boolean;
  private prefix: string;
  private timestamp: boolean;

  constructor(options: TLoggerOptions = {}) {
    this.enabled = options.enabled ?? process.env.NODE_ENV === 'development';
    this.prefix = options.prefix || '';
    this.timestamp = options.timestamp ?? true;
  }

  private formatMessage(level: TLogLevel, ...args: any[]): any[] {
    const parts: any[] = [];

    if (this.timestamp) {
      parts.push(`[${new Date().toISOString()}]`);
    }

    if (this.prefix) {
      parts.push(this.prefix);
    }

    parts.push(`[${level.toUpperCase()}]`);
    parts.push(...args);

    return parts;
  }

  log(...args: any[]): void {
    if (this.enabled) {
      console.log(...this.formatMessage('log', ...args));
    }
  }

  info(...args: any[]): void {
    if (this.enabled) {
      console.info(...this.formatMessage('info', ...args));
    }
  }

  warn(...args: any[]): void {
    if (this.enabled) {
      console.warn(...this.formatMessage('warn', ...args));
    }
  }

  error(...args: any[]): void {
    if (this.enabled) {
      console.error(...this.formatMessage('error', ...args));
    }
  }

  debug(...args: any[]): void {
    if (this.enabled) {
      console.debug(...this.formatMessage('debug', ...args));
    }
  }

  // Method to create a child logger with additional prefix
  child(prefix: string): Logger {
    return new Logger({
      enabled: this.enabled,
      prefix: this.prefix ? `${this.prefix} ${prefix}` : prefix,
      timestamp: this.timestamp,
    });
  }

  // Method to enable/disable logging
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  // Method to check if logging is enabled
  isEnabled(): boolean {
    return this.enabled;
  }
}

// Create default logger instance
export const logger = new Logger();

// Create specialized loggers for different parts of the application
export const graphLogger = logger.child('📊 [GRAPH]');

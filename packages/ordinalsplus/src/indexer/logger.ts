/**
 * Logging utilities for the Ordinals Indexer
 */

/**
 * Log levels in increasing order of severity
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4
}

/**
 * Mapping of log level names to enum values
 */
const LOG_LEVEL_MAP: Record<string, LogLevel> = {
  debug: LogLevel.DEBUG,
  info: LogLevel.INFO,
  warn: LogLevel.WARN,
  error: LogLevel.ERROR,
  silent: LogLevel.SILENT
};

/**
 * Configuration options for the logger
 */
export interface LoggerConfig {
  /**
   * Minimum log level to display
   */
  level: LogLevel;
  
  /**
   * Optional prefix for all log messages
   */
  prefix?: string;
  
  /**
   * Whether to include timestamps in log messages
   */
  timestamps?: boolean;
  
  /**
   * Custom formatter for log entries
   */
  formatter?: (entry: LogEntry) => string;
  
  /**
   * Transport function to handle the actual logging
   * Default is console.log/warn/error
   */
  transport?: (entry: LogEntry) => void;
}

/**
 * Log entry structure
 */
export interface LogEntry {
  /**
   * Log level
   */
  level: LogLevel;
  
  /**
   * Log level name
   */
  levelName: string;
  
  /**
   * Log message
   */
  message: string;
  
  /**
   * Additional data/context
   */
  data?: Record<string, any>;
  
  /**
   * Timestamp when the log was created
   */
  timestamp: Date;
  
  /**
   * Optional formatted timestamp string
   */
  timestampStr?: string;
  
  /**
   * Logger prefix
   */
  prefix?: string;
}

/**
 * Returns a descriptive name for a log level
 */
function getLogLevelName(level: LogLevel): string {
  switch (level) {
    case LogLevel.DEBUG: return 'DEBUG';
    case LogLevel.INFO: return 'INFO';
    case LogLevel.WARN: return 'WARN';
    case LogLevel.ERROR: return 'ERROR';
    case LogLevel.SILENT: return 'SILENT';
    default: return 'UNKNOWN';
  }
}

/**
 * Default log entry formatter
 */
function defaultFormatter(entry: LogEntry): string {
  const parts: string[] = [];
  
  if (entry.timestampStr) {
    parts.push(`[${entry.timestampStr}]`);
  }
  
  if (entry.prefix) {
    parts.push(`[${entry.prefix}]`);
  }
  
  parts.push(`[${entry.levelName}]`);
  parts.push(entry.message);
  
  if (entry.data && Object.keys(entry.data).length > 0) {
    try {
      const dataStr = JSON.stringify(entry.data, null, 2);
      parts.push(`\nContext: ${dataStr}`);
    } catch (e) {
      parts.push(`\nContext: [Unstringifiable data]`);
    }
  }
  
  return parts.join(' ');
}

/**
 * Default log transport function
 */
function defaultTransport(entry: LogEntry): void {
  const message = defaultFormatter(entry);
  
  switch (entry.level) {
    case LogLevel.DEBUG:
    case LogLevel.INFO:
      console.log(message);
      break;
    case LogLevel.WARN:
      console.warn(message);
      break;
    case LogLevel.ERROR:
      console.error(message);
      break;
    // SILENT: Don't log anything
  }
}

/**
 * Default logger configuration
 */
const DEFAULT_CONFIG: LoggerConfig = {
  level: LogLevel.INFO,
  timestamps: true,
  transport: defaultTransport
};

/**
 * Formats a timestamp consistently
 */
function formatTimestamp(date: Date): string {
  return date.toISOString();
}

/**
 * Creates a log entry object
 */
function createLogEntry(
  level: LogLevel,
  message: string,
  data?: Record<string, any>,
  config?: LoggerConfig
): LogEntry {
  const timestamp = new Date();
  
  return {
    level,
    levelName: getLogLevelName(level),
    message,
    data,
    timestamp,
    timestampStr: config?.timestamps ? formatTimestamp(timestamp) : undefined,
    prefix: config?.prefix
  };
}

/**
 * Logger class for Ordinals Indexer
 */
export class Logger {
  private config: LoggerConfig;
  
  /**
   * Creates a new Logger instance
   * 
   * @param config - Logger configuration
   */
  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  /**
   * Creates a child logger with additional context/prefix
   * 
   * @param prefix - Prefix for the child logger
   * @param additionalConfig - Additional configuration for the child logger
   */
  child(prefix: string, additionalConfig: Partial<LoggerConfig> = {}): Logger {
    const childPrefix = this.config.prefix
      ? `${this.config.prefix}:${prefix}`
      : prefix;
    
    return new Logger({
      ...this.config,
      ...additionalConfig,
      prefix: childPrefix
    });
  }
  
  /**
   * Logs a message at the DEBUG level
   * 
   * @param message - Log message
   * @param data - Additional context data
   */
  debug(message: string, data?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, data);
  }
  
  /**
   * Logs a message at the INFO level
   * 
   * @param message - Log message
   * @param data - Additional context data
   */
  info(message: string, data?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, data);
  }
  
  /**
   * Logs a message at the WARN level
   * 
   * @param message - Log message
   * @param data - Additional context data
   */
  warn(message: string, data?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, data);
  }
  
  /**
   * Logs a message at the ERROR level
   * 
   * @param message - Log message
   * @param data - Additional context data
   */
  error(message: string, data?: Record<string, any>): void {
    this.log(LogLevel.ERROR, message, data);
  }
  
  /**
   * Logs an error object at the ERROR level
   * 
   * @param error - Error object
   * @param message - Optional additional message
   * @param data - Additional context data
   */
  logError(error: Error, message?: string, data?: Record<string, any>): void {
    const errorData = {
      ...data,
      errorName: error.name,
      errorMessage: error.message,
      stack: error.stack,
      ...(error as any).context  // Include error context if available
    };
    
    this.error(message || error.message, errorData);
  }
  
  /**
   * Generic log method
   * 
   * @param level - Log level
   * @param message - Log message
   * @param data - Additional context data
   */
  log(level: LogLevel, message: string, data?: Record<string, any>): void {
    // Skip if level is below configured minimum or SILENT
    if (level < this.config.level || this.config.level === LogLevel.SILENT) {
      return;
    }
    
    const entry = createLogEntry(level, message, data, this.config);
    
    if (this.config.formatter) {
      const formattedMessage = this.config.formatter(entry);
      if (this.config.transport) {
        this.config.transport(entry);
      } else {
        defaultTransport({ ...entry, message: formattedMessage });
      }
    } else if (this.config.transport) {
      this.config.transport(entry);
    } else {
      defaultTransport(entry);
    }
  }
  
  /**
   * Sets the minimum log level
   * 
   * @param level - New minimum log level
   */
  setLevel(level: LogLevel | string): void {
    if (typeof level === 'string') {
      const normalizedLevel = level.toLowerCase();
      this.config.level = normalizedLevel in LOG_LEVEL_MAP
        ? LOG_LEVEL_MAP[normalizedLevel]
        : this.config.level;
    } else {
      this.config.level = level;
    }
  }
  
  /**
   * Gets the current minimum log level
   */
  getLevel(): LogLevel {
    return this.config.level;
  }
}

/**
 * Default logger instance
 */
export const defaultLogger = new Logger();

/**
 * Creates a logger configured from environment variables
 * 
 * @returns A logger configured based on environment variables
 */
export function createEnvLogger(prefix?: string): Logger {
  const envLevel = process.env.LOG_LEVEL?.toLowerCase();
  
  let level = LogLevel.INFO;
  if (envLevel && envLevel in LOG_LEVEL_MAP) {
    level = LOG_LEVEL_MAP[envLevel];
  }
  
  return new Logger({
    level,
    prefix,
    timestamps: process.env.LOG_TIMESTAMPS !== 'false'
  });
} 
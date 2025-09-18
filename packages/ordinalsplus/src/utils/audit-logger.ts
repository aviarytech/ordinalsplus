import * as nodeCrypto from 'crypto';
import * as fsModule from 'fs';
import { FileHandle } from 'fs/promises';
import * as pathModule from 'path';

// Environment-safe handles (browser gets undefined; Node gets real modules)
const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
const fs = (fsModule as any)?.promises as typeof import('fs').promises | undefined;
const path = pathModule as any;
const nodeCryptoRef = nodeCrypto as any;

/**
 * Severity levels for audit events
 */
export enum AuditSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

/**
 * Categories of audit events
 */
export enum AuditCategory {
  ACCESS = 'access',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  KEY_MANAGEMENT = 'key_management',
  DID_DOCUMENT = 'did_document',
  RESOLUTION = 'resolution',
  SECURITY = 'security',
  SYSTEM = 'system'
}

/**
 * Interface for audit event data
 */
export interface AuditEvent {
  id: string;
  timestamp: string;
  category: AuditCategory;
  severity: AuditSeverity;
  action: string;
  actor?: string;
  target?: string;
  details?: Record<string, unknown>;
  previousHash?: string;
}

/**
 * Configuration options for the audit logger
 */
export interface AuditLoggerConfig {
  enabled: boolean;
  storagePath?: string;
  rotationSizeInBytes?: number;
  retentionDays?: number;
  tamperDetection?: boolean;
  logToConsole?: boolean;
}

/**
 * AuditLogger class for recording and managing security-relevant events
 */
export class AuditLogger {
  private static instance: AuditLogger;
  private config: AuditLoggerConfig;
  private logBuffer: AuditEvent[] = [];
  private lastLogHash: string = '';
  private currentLogFile: string = '';
  private logFileHandle: FileHandle | null = null;
  private currentLogSize: number = 0;

  /**
   * Creates a new AuditLogger instance
   */
  private constructor(config: AuditLoggerConfig) {
    this.config = {
      enabled: config.enabled !== false,
      storagePath: config.storagePath || './logs/audit',
      rotationSizeInBytes: config.rotationSizeInBytes || 10 * 1024 * 1024, // 10MB default
      retentionDays: config.retentionDays || 90,
      tamperDetection: config.tamperDetection !== false,
      logToConsole: config.logToConsole || false
    };

    // Disable file-based logging in browser environments
    if (isBrowser) {
      this.config.enabled = false;
    }

    // Initialize the logger
    this.initialize();
  }

  /**
   * Get the singleton instance of the AuditLogger
   */
  public static getInstance(config?: AuditLoggerConfig): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger(config || { enabled: true });
    } else if (config) {
      // Update config if provided
      AuditLogger.instance.config = {
        ...AuditLogger.instance.config,
        ...config
      };
    }
    
    return AuditLogger.instance;
  }

  /**
   * Initialize the logger, creating directories and log files as needed
   */
  private async initialize(): Promise<void> {
    if (!this.config.enabled) return;

    try {
      // Create log directory if it doesn't exist
      await fs!.mkdir(this.config.storagePath!, { recursive: true });
      
      // Set up initial log file
      this.currentLogFile = this.generateLogFileName();
      
      // Try to open an existing log file to read the last hash
      try {
        const existingLogs = await fs!.readFile(this.currentLogFile, 'utf8');
        const events = existingLogs.trim().split('\n').map(line => JSON.parse(line));
        
        if (events.length > 0 && this.config.tamperDetection) {
          // Extract the last hash
          this.lastLogHash = events[events.length - 1].previousHash || '';
          this.currentLogSize = Buffer.byteLength(existingLogs, 'utf8');
        }
      } catch (error) {
        // File doesn't exist or can't be read, start fresh
        this.lastLogHash = '';
        this.currentLogSize = 0;
      }
      
      // Open the log file for appending
      this.logFileHandle = await fs!.open(this.currentLogFile, 'a');
      
      // Schedule log cleanup
      this.scheduleLogCleanup();
    } catch (error) {
      console.error('Failed to initialize audit logger:', error);
    }
  }

  /**
   * Generate a log file name based on the current date
   */
  private generateLogFileName(): string {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
    return path.join(this.config.storagePath!, `audit-${dateStr}.log`);
  }

  /**
   * Schedule cleanup of old log files
   */
  private scheduleLogCleanup(): void {
    if (!this.config.enabled || !this.config.retentionDays) return;

    // Run cleanup once a day
    setInterval(() => this.cleanupOldLogs(), 24 * 60 * 60 * 1000);
    
    // Also run once at startup
    this.cleanupOldLogs();
  }

  /**
   * Clean up log files older than the retention period
   */
  private async cleanupOldLogs(): Promise<void> {
    try {
      const files = await fs!.readdir(this.config.storagePath!);
      const now = Date.now();
      const retentionMs = this.config.retentionDays! * 24 * 60 * 60 * 1000;

      for (const file of files) {
        if (!file.startsWith('audit-') || !file.endsWith('.log')) continue;

        const filePath = path.join(this.config.storagePath!, file);
        const stats = await fs!.stat(filePath);
        const fileAge = now - stats.mtime.getTime();

        if (fileAge > retentionMs) {
          await fs!.unlink(filePath);
        }
      }
    } catch (error) {
      console.error('Failed to clean up old audit logs:', error);
    }
  }

  /**
   * Create a hash of the event combined with the previous hash
   */
  private createHash(event: AuditEvent): string {
    if (nodeCryptoRef?.createHash) {
      const hash = nodeCryptoRef.createHash('sha256');
      const eventWithoutHash = { ...event };
      delete eventWithoutHash.previousHash;
      hash.update(JSON.stringify(eventWithoutHash));
      hash.update(this.lastLogHash || '');
      return hash.digest('hex');
    }
    // Fallback: return empty hash in environments without Node crypto
    const eventWithoutHash = { ...event };
    delete eventWithoutHash.previousHash;
    try {
      // Browser Web Crypto fallback
      const encoder = new TextEncoder();
      const data = encoder.encode(JSON.stringify(eventWithoutHash) + (this.lastLogHash || ''));
      const subtle = (globalThis.crypto as any)?.subtle;
      if (subtle?.digest) {
        // Note: This path is async; to keep API sync, we skip and return empty
        // Consider refactoring to async in future if needed
        // await subtle.digest('SHA-256', data)
      }
    } catch {}
    return '';
  }

  /**
   * Log an audit event
   */
  public async log(
    category: AuditCategory,
    severity: AuditSeverity,
    action: string,
    actor?: string,
    target?: string,
    details?: Record<string, unknown>
  ): Promise<void> {
    if (!this.config.enabled) return;

    // Create the audit event
    const event: AuditEvent = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      category,
      severity,
      action,
      actor,
      target,
      details
    };

    // Add the hash for tamper detection if enabled
    if (this.config.tamperDetection) {
      const hash = this.createHash(event);
      event.previousHash = hash;
      this.lastLogHash = hash;
    }

    // Add to in-memory buffer
    this.logBuffer.push(event);

    // Log to console if enabled
    if (this.config.logToConsole) {
      const severityColors = {
        [AuditSeverity.INFO]: '\x1b[32m',     // Green
        [AuditSeverity.WARNING]: '\x1b[33m',  // Yellow
        [AuditSeverity.ERROR]: '\x1b[31m',    // Red
        [AuditSeverity.CRITICAL]: '\x1b[41m', // Red background
      };
      
      const resetColor = '\x1b[0m';
      console.log(
        `${severityColors[severity]}[AUDIT:${severity}]${resetColor} ${event.timestamp} ${category}:${action}` +
        (actor ? ` by ${actor}` : '') +
        (target ? ` on ${target}` : '')
      );
    }

    // Write to disk
    await this.flushToStorage();
  }

  /**
   * Write buffered logs to storage
   */
  private async flushToStorage(): Promise<void> {
    if (!this.config.enabled || this.logBuffer.length === 0 || !this.logFileHandle) return;

    try {
      // Convert events to JSON lines
      const logLines = this.logBuffer.map(event => JSON.stringify(event)).join('\n') + '\n';
      const logSize = Buffer.byteLength(logLines, 'utf8');
      
      // Check if we need to rotate the log file
      if (this.currentLogSize + logSize > this.config.rotationSizeInBytes!) {
        // Close current file
        await this.logFileHandle.close();
        
        // Create a new log file
        this.currentLogFile = this.generateLogFileName();
        this.logFileHandle = await fs!.open(this.currentLogFile, 'a');
        this.currentLogSize = 0;
      }
      
      // Write to the log file
      await this.logFileHandle.write(logLines, 0, 'utf8');
      this.currentLogSize += logSize;
      
      // Clear the buffer
      this.logBuffer = [];
    } catch (error) {
      console.error('Failed to write audit logs to storage:', error);
    }
  }

  /**
   * Verify the integrity of an audit log file
   */
  public async verifyLogIntegrity(logFilePath?: string): Promise<{ 
    valid: boolean; 
    tampered: string[] 
  }> {
    if (!this.config.enabled || !this.config.tamperDetection) {
      return { valid: false, tampered: ['Tamper detection is not enabled'] };
    }

    try {
      const filePath = logFilePath || this.currentLogFile;
      const content = await fs!.readFile(filePath, 'utf8');
      const events = content.trim().split('\n').map(line => JSON.parse(line) as AuditEvent);
      
      if (events.length === 0) {
        return { valid: true, tampered: [] };
      }
      
      let previousHash = '';
      const tamperedLines: string[] = [];
      
      for (let i = 0; i < events.length; i++) {
        const event = events[i];
        const storedHash = event.previousHash;
        
        // Calculate expected hash based on event content and previous hash
        const currentEvent = { ...event };
        delete currentEvent.previousHash;
        
        let expectedHash = '';
        if (nodeCryptoRef?.createHash) {
          const hash = nodeCryptoRef.createHash('sha256');
          hash.update(JSON.stringify(currentEvent));
          hash.update(previousHash);
          expectedHash = hash.digest('hex');
        }
        
        // Compare hashes
        if (storedHash !== expectedHash) {
          tamperedLines.push(`Line ${i + 1}: expected hash ${expectedHash}, found ${storedHash}`);
        }
        
        previousHash = storedHash || '';
      }
      
      return { valid: tamperedLines.length === 0, tampered: tamperedLines };
    } catch (error) {
      return {
        valid: false,
        tampered: [`Error verifying log integrity: ${error instanceof Error ? error.message : String(error)}`]
      };
    }
  }

  /**
   * Close the logger, ensuring all data is written to disk
   */
  public async close(): Promise<void> {
    if (!this.config.enabled || !this.logFileHandle) return;
    
    try {
      // Flush any remaining logs
      await this.flushToStorage();
      
      // Close the file handle
      await this.logFileHandle.close();
      this.logFileHandle = null;
    } catch (error) {
      console.error('Failed to close audit logger:', error);
    }
  }

  /**
   * Get recent audit log entries for reviewing
   */
  public async getRecent(limit: number = 100): Promise<AuditEvent[]> {
    if (!this.config.enabled) return [];
    
    try {
      const content = await fs!.readFile(this.currentLogFile, 'utf8');
      const events = content.trim().split('\n').map(line => JSON.parse(line) as AuditEvent);
      
      // Return the most recent events
      return events.slice(-limit);
    } catch (error) {
      console.error('Failed to read recent audit logs:', error);
      return [];
    }
  }

  /**
   * Search audit logs for specific criteria
   */
  public async search(criteria: Partial<AuditEvent>, limit: number = 100): Promise<AuditEvent[]> {
    if (!this.config.enabled) return [];
    
    try {
      const content = await fs!.readFile(this.currentLogFile, 'utf8');
      const events = content.trim().split('\n').map(line => JSON.parse(line) as AuditEvent);
      
      // Filter events based on criteria
      const results = events.filter(event => {
        for (const [key, value] of Object.entries(criteria)) {
          if (key === 'details') {
            // For details, we need to check if any of the criteria match
            if (!event.details) return false;
            
            for (const [detailKey, detailValue] of Object.entries(value as Record<string, unknown>)) {
              if (event.details[detailKey] !== detailValue) return false;
            }
          } else if (event[key as keyof AuditEvent] !== value) {
            return false;
          }
        }
        return true;
      });
      
      // Return the most recent matching events
      return results.slice(-limit);
    } catch (error) {
      console.error('Failed to search audit logs:', error);
      return [];
    }
  }
}

// Helper functions for common audit events

/**
 * Log a DID document creation event
 */
export async function logDidDocumentCreation(
  didId: string, 
  actor?: string, 
  details?: Record<string, unknown>
): Promise<void> {
  const logger = AuditLogger.getInstance();
  await logger.log(
    AuditCategory.DID_DOCUMENT,
    AuditSeverity.INFO,
    'document_created',
    actor,
    didId,
    details
  );
}

/**
 * Log a DID document update event
 */
export async function logDidDocumentUpdate(
  didId: string, 
  actor?: string, 
  details?: Record<string, unknown>
): Promise<void> {
  const logger = AuditLogger.getInstance();
  await logger.log(
    AuditCategory.DID_DOCUMENT,
    AuditSeverity.INFO,
    'document_updated',
    actor,
    didId,
    details
  );
}

/**
 * Log a DID document resolution event
 */
export async function logDidDocumentResolution(
  didId: string, 
  actor?: string, 
  details?: Record<string, unknown>
): Promise<void> {
  const logger = AuditLogger.getInstance();
  await logger.log(
    AuditCategory.RESOLUTION,
    AuditSeverity.INFO,
    'document_resolved',
    actor,
    didId,
    details
  );
}

/**
 * Log a key management event
 */
export async function logKeyManagementEvent(
  action: string,
  keyId: string,
  actor?: string,
  details?: Record<string, unknown>
): Promise<void> {
  const logger = AuditLogger.getInstance();
  await logger.log(
    AuditCategory.KEY_MANAGEMENT,
    AuditSeverity.INFO,
    action,
    actor,
    keyId,
    details
  );
}

/**
 * Log a security event
 */
export async function logSecurityEvent(
  action: string,
  severity: AuditSeverity,
  target?: string,
  actor?: string,
  details?: Record<string, unknown>
): Promise<void> {
  const logger = AuditLogger.getInstance();
  await logger.log(
    AuditCategory.SECURITY,
    severity,
    action,
    actor,
    target,
    details
  );
} 
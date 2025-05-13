/**
 * Dead Letter Queue (DLQ) for handling unrecoverable errors in the Ordinals Indexer
 */

/**
 * Interface for a dead letter queue entry
 */
export interface DLQEntry {
  /** Unique ID for the entry */
  id: string;
  
  /** Timestamp when the entry was created */
  timestamp: number;
  
  /** Operation that failed */
  operation: string;
  
  /** Payload/data associated with the operation */
  payload: any;
  
  /** Error information */
  error: {
    /** Error message */
    message: string;
    
    /** Error name/type */
    name: string;
    
    /** Error stack trace, if available */
    stack?: string;
    
    /** Additional error context */
    context?: Record<string, any>;
  };
  
  /** Number of retry attempts made */
  attempts: number;
  
  /** Status of the DLQ entry */
  status: 'pending' | 'retrying' | 'succeeded' | 'failed';
  
  /** Last retry timestamp, if any */
  lastRetryTimestamp?: number;
}

/**
 * Interface for a Dead Letter Queue storage provider
 */
export interface DLQStorage {
  /**
   * Stores a new DLQ entry
   * 
   * @param entry - The entry to store
   */
  storeEntry(entry: DLQEntry): Promise<void>;
  
  /**
   * Gets a DLQ entry by ID
   * 
   * @param id - The ID of the entry to retrieve
   */
  getEntry(id: string): Promise<DLQEntry | null>;
  
  /**
   * Gets all DLQ entries, optionally filtered by status
   * 
   * @param status - Optional status filter
   */
  getEntries(status?: DLQEntry['status']): Promise<DLQEntry[]>;
  
  /**
   * Updates an existing DLQ entry
   * 
   * @param id - The ID of the entry to update
   * @param updates - The fields to update
   */
  updateEntry(id: string, updates: Partial<DLQEntry>): Promise<void>;
  
  /**
   * Deletes a DLQ entry
   * 
   * @param id - The ID of the entry to delete
   */
  deleteEntry(id: string): Promise<void>;
}

/**
 * In-memory implementation of DLQStorage for development and testing
 */
export class MemoryDLQStorage implements DLQStorage {
  private entries: Map<string, DLQEntry> = new Map();
  
  async storeEntry(entry: DLQEntry): Promise<void> {
    this.entries.set(entry.id, { ...entry });
  }
  
  async getEntry(id: string): Promise<DLQEntry | null> {
    const entry = this.entries.get(id);
    return entry ? { ...entry } : null;
  }
  
  async getEntries(status?: DLQEntry['status']): Promise<DLQEntry[]> {
    const entries = Array.from(this.entries.values()).map(entry => ({ ...entry }));
    
    if (status) {
      return entries.filter(entry => entry.status === status);
    }
    
    return entries;
  }
  
  async updateEntry(id: string, updates: Partial<DLQEntry>): Promise<void> {
    const entry = this.entries.get(id);
    
    if (!entry) {
      throw new Error(`DLQ entry with ID ${id} not found`);
    }
    
    this.entries.set(id, { ...entry, ...updates });
  }
  
  async deleteEntry(id: string): Promise<void> {
    this.entries.delete(id);
  }
}

/**
 * Dead Letter Queue implementation for handling unrecoverable errors
 */
export class DeadLetterQueue {
  private storage: DLQStorage;
  
  /**
   * Creates a new DeadLetterQueue instance
   * 
   * @param storage - Storage provider for the queue
   */
  constructor(storage: DLQStorage) {
    this.storage = storage;
  }
  
  /**
   * Adds a failed operation to the queue
   * 
   * @param operation - Name of the operation that failed
   * @param payload - Data or arguments associated with the operation
   * @param error - The error that occurred
   * @returns The ID of the created DLQ entry
   */
  async addEntry(
    operation: string,
    payload: any,
    error: Error & { context?: Record<string, any> }
  ): Promise<string> {
    const id = `dlq-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    const entry: DLQEntry = {
      id,
      timestamp: Date.now(),
      operation,
      payload,
      error: {
        message: error.message,
        name: error.name,
        stack: error.stack,
        context: error.context
      },
      attempts: 0,
      status: 'pending'
    };
    
    await this.storage.storeEntry(entry);
    
    return id;
  }
  
  /**
   * Gets all DLQ entries, optionally filtered by status
   * 
   * @param status - Optional status filter
   */
  async getEntries(status?: DLQEntry['status']): Promise<DLQEntry[]> {
    return this.storage.getEntries(status);
  }
  
  /**
   * Marks a DLQ entry as retrying and increments the attempt counter
   * 
   * @param id - The ID of the entry to mark as retrying
   */
  async markAsRetrying(id: string): Promise<void> {
    const entry = await this.storage.getEntry(id);
    
    if (!entry) {
      throw new Error(`DLQ entry with ID ${id} not found`);
    }
    
    await this.storage.updateEntry(id, {
      status: 'retrying',
      attempts: entry.attempts + 1,
      lastRetryTimestamp: Date.now()
    });
  }
  
  /**
   * Marks a DLQ entry as succeeded
   * 
   * @param id - The ID of the entry to mark as succeeded
   */
  async markAsSucceeded(id: string): Promise<void> {
    await this.storage.updateEntry(id, {
      status: 'succeeded'
    });
  }
  
  /**
   * Marks a DLQ entry as failed (terminal state)
   * 
   * @param id - The ID of the entry to mark as failed
   */
  async markAsFailed(id: string): Promise<void> {
    await this.storage.updateEntry(id, {
      status: 'failed'
    });
  }
  
  /**
   * Gets entries that have been in the queue for longer than a specific duration
   * 
   * @param durationMs - Duration in milliseconds
   * @param status - Optional status filter
   */
  async getOldEntries(durationMs: number, status?: DLQEntry['status']): Promise<DLQEntry[]> {
    const entries = await this.storage.getEntries(status);
    const now = Date.now();
    
    return entries.filter(entry => now - entry.timestamp > durationMs);
  }
  
  /**
   * Gets the DLQ storage instance
   */
  getStorage(): DLQStorage {
    return this.storage;
  }
} 
/**
 * Transaction Status Tracker
 * 
 * This module provides functionality to track and display the status of 
 * both commit and reveal transactions throughout the inscription process.
 */

import { EventEmitter } from 'events';
import { BitcoinNetwork } from '../types';
import { InscriptionError } from '../utils/error-handler';

/**
 * Transaction status enum
 */
export enum TransactionStatus {
  PENDING = 'PENDING',
  CONFIRMING = 'CONFIRMING',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED',
  PENDING_CONFIRMATION = 'PENDING_CONFIRMATION',
  MEMPOOL = 'MEMPOOL',
  FINALIZED = 'FINALIZED',
  DROPPED_OR_REPLACED = 'DROPPED_OR_REPLACED',
  UNWATCHED = 'UNWATCHED',
  ERROR = 'ERROR'
}

/**
 * Transaction type enum
 */
export enum TransactionType {
  COMMIT = 'COMMIT',
  REVEAL = 'REVEAL'
}

/**
 * Error details for a failed transaction
 */
export interface TransactionError {
  message: string;
  code?: string;
  details?: any;
}

/**
 * Interface for tracked transaction objects
 */
export interface TrackedTransaction {
  id: string;
  txid: string;
  type: TransactionType;
  status: TransactionStatus;
  createdAt: Date;
  lastUpdatedAt: Date;
  confirmations?: number;
  blockHeight?: number;
  blockHash?: string;
  parentId?: string; // For linking reveal to commit transactions
  error?: InscriptionError;
  metadata?: Record<string, any>;
}

/**
 * Progress event for transaction status updates
 */
export interface TransactionProgressEvent {
  transactionId: string;
  message: string;
  timestamp: Date;
  data?: any;
}

/**
 * Events that can be emitted by status tracker or related services regarding a transaction's lifecycle.
 */
export enum TransactionEvent {
  CREATED = 'CREATED',
  SIGNED = 'SIGNED',
  BROADCAST_ATTEMPT = 'BROADCAST_ATTEMPT',
  BROADCAST_SUCCESS = 'BROADCAST_SUCCESS',
  BROADCAST_FAILED = 'BROADCAST_FAILED',
  CONFIRMATION_CHECK_ATTEMPT = 'CONFIRMATION_CHECK_ATTEMPT',
  CONFIRMATION_CHECK_FAILED = 'CONFIRMATION_CHECK_FAILED',
  CONFIRMED_ONCE = 'CONFIRMED_ONCE',
  CONFIRMATIONS_UPDATED = 'CONFIRMATIONS_UPDATED',
  FINALIZED_PERSISTENCE = 'FINALIZED_PERSISTENCE',
  ERROR_ENCOUNTERED = 'ERROR_ENCOUNTERED',
  RETRY_ATTEMPT = 'RETRY_ATTEMPT',
  CANCELLED = 'CANCELLED',
  STATUS_CHANGE = 'STATUS_CHANGE',
  REORG_DETECTED_TRACKER = 'REORG_DETECTED_TRACKER',
  DROPPED_FROM_MEMPOOL = 'DROPPED_FROM_MEMPOOL',
}

/**
 * Service to track and manage transaction status
 */
export class TransactionStatusTracker extends EventEmitter {
  private transactions: Map<string, TrackedTransaction>;
  private progressEvents: Map<string, TransactionProgressEvent[]>;
  
  constructor() {
    super();
    this.transactions = new Map();
    this.progressEvents = new Map();
  }
  
  /**
   * Add a transaction to track
   */
  addTransaction(transaction: TrackedTransaction): void {
    this.transactions.set(transaction.id, transaction);
    this.emit('transactionAdded', transaction);
  }
  
  /**
   * Get a transaction by ID
   */
  getTransaction(id: string): TrackedTransaction | undefined {
    return this.transactions.get(id);
  }
  
  /**
   * Get all tracked transactions
   */
  getAllTransactions(): TrackedTransaction[] {
    return Array.from(this.transactions.values());
  }
  
  /**
   * Get transactions by type (commit or reveal)
   */
  getTransactionsByType(type: TransactionType): TrackedTransaction[] {
    return this.getAllTransactions().filter(tx => tx.type === type);
  }
  
  /**
   * Get transactions by status
   */
  getTransactionsByStatus(status: TransactionStatus): TrackedTransaction[] {
    return this.getAllTransactions().filter(tx => tx.status === status);
  }
  
  /**
   * Update the status of a transaction
   */
  setTransactionStatus(id: string, status: TransactionStatus): void {
    const transaction = this.transactions.get(id);
    
    if (transaction) {
      const previousStatus = transaction.status;
      transaction.status = status;
      transaction.lastUpdatedAt = new Date();
      this.transactions.set(id, transaction);
      
      this.emit('statusChanged', {
        id,
        previousStatus,
        newStatus: status
      });
    }
  }
  
  /**
   * Update confirmation count for a transaction
   */
  updateConfirmations(id: string, confirmations: number, blockHeight?: number, blockHash?: string): void {
    const transaction = this.transactions.get(id);
    
    if (transaction) {
      transaction.confirmations = confirmations;
      if (blockHeight) transaction.blockHeight = blockHeight;
      if (blockHash) transaction.blockHash = blockHash;
      transaction.lastUpdatedAt = new Date();
      
      // Update status based on confirmation count
      if (confirmations >= 1 && transaction.status === TransactionStatus.PENDING) {
        transaction.status = TransactionStatus.CONFIRMING;
        this.emit('statusChanged', {
          id,
          previousStatus: TransactionStatus.PENDING,
          newStatus: TransactionStatus.CONFIRMING
        });
      }
      
      if (confirmations >= 6 && transaction.status === TransactionStatus.CONFIRMING) {
        transaction.status = TransactionStatus.CONFIRMED;
        this.emit('statusChanged', {
          id,
          previousStatus: TransactionStatus.CONFIRMING,
          newStatus: TransactionStatus.CONFIRMED
        });
      }
      
      this.transactions.set(id, transaction);
      this.emit('confirmationsUpdated', {
        id,
        confirmations,
        blockHeight,
        blockHash
      });
    }
  }
  
  /**
   * Set an error on a transaction
   */
  setTransactionError(id: string, error: InscriptionError): void {
    const transaction = this.transactions.get(id);
    
    if (transaction) {
      transaction.error = error;
      transaction.lastUpdatedAt = new Date();
      this.transactions.set(id, transaction);
      
      this.emit('transactionError', {
        id,
        error
      });
    }
  }
  
  /**
   * Get a transaction explorer URL based on the network
   */
  getTransactionExplorerUrl(txid: string, network: BitcoinNetwork): string {
    if (network === 'mainnet') {
      return `https://mempool.space/tx/${txid}`;
    } else if (network === 'testnet') {
      return `https://mempool.space/testnet/tx/${txid}`;
    } else if (network === 'signet') {
      return `https://mempool.space/signet/tx/${txid}`;
    } else {
      return `https://mempool.space/tx/${txid}`;
    }
  }
  
  /**
   * Add a progress event for a transaction
   */
  addTransactionProgressEvent(event: TransactionProgressEvent): void {
    if (!this.progressEvents.has(event.transactionId)) {
      this.progressEvents.set(event.transactionId, []);
    }
    
    this.progressEvents.get(event.transactionId)?.push(event);
    this.emit('progressEvent', event);
  }
  
  /**
   * Get all progress events for a transaction
   */
  getTransactionProgressEvents(transactionId: string): TransactionProgressEvent[] {
    return this.progressEvents.get(transactionId) || [];
  }
  
  /**
   * Get child transactions (e.g., reveal transactions for a commit)
   */
  getChildTransactions(parentId: string): TrackedTransaction[] {
    return this.getAllTransactions().filter(tx => tx.parentId === parentId);
  }
  
  /**
   * Remove a transaction from tracking
   */
  removeTransaction(id: string): void {
    const transaction = this.transactions.get(id);
    
    if (transaction) {
      this.transactions.delete(id);
      this.progressEvents.delete(id);
      this.emit('transactionRemoved', transaction);
    }
  }
  
  /**
   * Update the TXID for a transaction
   * This is useful when a transaction is first created with a placeholder TXID
   * and then updated once the actual TXID is available after broadcast
   */
  updateTransactionTxid(id: string, txid: string): void {
    const transaction = this.transactions.get(id);
    
    if (transaction) {
      transaction.txid = txid;
      transaction.lastUpdatedAt = new Date();
      this.transactions.set(id, transaction);
      
      this.emit('txidUpdated', {
        id,
        txid
      });
    }
  }
  
  /**
   * Clear all tracked transactions
   */
  clearTransactions(): void {
    this.transactions.clear();
    this.progressEvents.clear();
    this.emit('transactionsCleared');
  }
}

// Export singleton instance
export const transactionTracker = new TransactionStatusTracker(); 
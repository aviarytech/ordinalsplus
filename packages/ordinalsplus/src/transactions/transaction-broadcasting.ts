/**
 * Transaction Broadcasting System
 * 
 * This module provides a robust system for broadcasting Bitcoin transactions
 * with support for multiple Bitcoin nodes, retry logic, and comprehensive error handling.
 */

import { EventEmitter } from 'events';
import { 
  TransactionStatus, 
  TransactionStatusTracker, 
  TrackedTransaction,
  TransactionType
} from './transaction-status-tracker';
import { BitcoinNetwork } from '../types';
import { generateId } from '../utils/id-generator';
import { ErrorCode, InscriptionError } from '../utils/error-handler';

/**
 * Configuration for a Bitcoin node
 */
export interface BitcoinNodeConfig {
  name: string;
  url: string;
  priority: number; // Lower number = higher priority
  apiKey?: string;
  enabled: boolean;
  networkType: BitcoinNetwork;
}

/**
 * Broadcast result interface
 */
export interface BroadcastResult {
  success: boolean;
  txid?: string;
  error?: InscriptionError;
  nodeName?: string;
}

/**
 * Available broadcast methods
 */
export enum BroadcastMethod {
  MEMPOOL_SPACE = 'MEMPOOL_SPACE',
  BLOCKSTREAM = 'BLOCKSTREAM',
  BITCOIN_RPC = 'BITCOIN_RPC',
  CUSTOM_API = 'CUSTOM_API'
}

/**
 * Transaction broadcast options
 */
export interface BroadcastOptions {
  network: BitcoinNetwork;
  maxRetries?: number;
  initialBackoffMs?: number;
  maxBackoffMs?: number;
  preferredMethod?: BroadcastMethod;
  preferredNodes?: string[];
  skipValidation?: boolean;
  timeout?: number; // Timeout in milliseconds
}

/**
 * Default broadcast options
 */
const DEFAULT_BROADCAST_OPTIONS: BroadcastOptions = {
  network: 'mainnet',
  maxRetries: 3,
  initialBackoffMs: 1000,
  maxBackoffMs: 30000,
  timeout: 30000, // 30 seconds
  skipValidation: false
};

/**
 * Default Bitcoin nodes configuration
 */
const DEFAULT_NODES: BitcoinNodeConfig[] = [
  {
    name: 'mempool-space-main',
    url: 'https://mempool.space/api/tx',
    priority: 1,
    enabled: true,
    networkType: 'mainnet'
  },
  {
    name: 'mempool-space-testnet',
    url: 'https://mempool.space/testnet/api/tx',
    priority: 1,
    enabled: true,
    networkType: 'testnet'
  },
  {
    name: 'mempool-space-signet',
    url: 'https://mempool.space/signet/api/tx',
    priority: 1,
    enabled: true,
    networkType: 'signet'
  },
  {
    name: 'blockstream-main',
    url: 'https://blockstream.info/api/tx',
    priority: 2,
    enabled: true,
    networkType: 'mainnet'
  },
  {
    name: 'blockstream-testnet',
    url: 'https://blockstream.info/testnet/api/tx',
    priority: 2,
    enabled: true,
    networkType: 'testnet'
  }
];

/**
 * @classdesc Transaction broadcasting service with multiple node support and retry logic
 */
export class TransactionBroadcaster extends EventEmitter {
  private statusTracker: TransactionStatusTracker;
  private nodes: BitcoinNodeConfig[];
  private activeRetries: Map<string, number>;
  private inProgressBroadcasts: Set<string>;
  
  /**
   * @constructor
   * @param statusTracker - Transaction status tracker instance
   * @param nodes - Array of Bitcoin node configurations (optional)
   */
  constructor(
    statusTracker: TransactionStatusTracker,
    nodes: BitcoinNodeConfig[] = DEFAULT_NODES
  ) {
    super();
    this.statusTracker = statusTracker;
    this.nodes = [...nodes]; // Create a copy to avoid external modifications
    this.activeRetries = new Map();
    this.inProgressBroadcasts = new Set();
  }
  
  /**
   * Add a new node to the broadcaster
   * @param node - Node configuration
   */
  public addNode(node: BitcoinNodeConfig): void {
    // Check if node with same name already exists
    const existingNodeIndex = this.nodes.findIndex(n => n.name === node.name);
    if (existingNodeIndex >= 0) {
      this.nodes[existingNodeIndex] = node;
    } else {
      this.nodes.push(node);
    }
  }
  
  /**
   * Enable or disable a node
   * @param nodeName - Name of the node
   * @param enabled - Whether to enable the node
   */
  public setNodeEnabled(nodeName: string, enabled: boolean): void {
    const node = this.nodes.find(n => n.name === nodeName);
    if (node) {
      node.enabled = enabled;
    }
  }
  
  /**
   * Get active nodes for a specific network
   * @param network - Bitcoin network
   * @param preferredNodes - Optional array of preferred node names
   * @returns Array of active nodes sorted by priority
   */
  private getActiveNodes(network: BitcoinNetwork, preferredNodes?: string[]): BitcoinNodeConfig[] {
    // Filter nodes by network and enabled status
    let activeNodes = this.nodes.filter(node => 
      node.enabled && node.networkType === network
    );
    
    // Sort by priority (lower number = higher priority)
    activeNodes.sort((a, b) => a.priority - b.priority);
    
    // If preferred nodes specified, prioritize them
    if (preferredNodes && preferredNodes.length > 0) {
      // Move preferred nodes to the front while maintaining their relative priority
      const preferred = activeNodes.filter(node => preferredNodes.includes(node.name));
      const others = activeNodes.filter(node => !preferredNodes.includes(node.name));
      activeNodes = [...preferred, ...others];
    }
    
    return activeNodes;
  }
  
  /**
   * Broadcast a transaction to a specific node
   * @param txHex - Transaction hex string
   * @param node - Node configuration
   * @param options - Broadcast options
   * @returns Promise resolving to broadcast result
   */
  private async broadcastToNode(txHex: string, node: BitcoinNodeConfig, options: BroadcastOptions): Promise<BroadcastResult> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), options.timeout);
      
      const response = await fetch(node.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
          ...(node.apiKey ? { 'Authorization': `Bearer ${node.apiKey}` } : {})
        },
        body: txHex,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          nodeName: node.name,
          error: new InscriptionError({
            code: ErrorCode.TRANSACTION_BROADCAST_FAILED,
            message: `Failed to broadcast transaction to ${node.name}: ${response.status} ${errorText}`,
            details: {
              statusCode: response.status,
              errorText,
              node: node.name
            }
          })
        };
      }
      
      const txid = await response.text();
      // Validate txid format (64 hex characters)
      if (!/^[a-fA-F0-9]{64}$/.test(txid)) {
        return {
          success: false,
          nodeName: node.name,
          error: new InscriptionError({
            code: ErrorCode.INVALID_RESPONSE,
            message: `Invalid txid format received from ${node.name}`,
            details: {
              responseText: txid,
              node: node.name
            }
          })
        };
      }
      
      return {
        success: true,
        txid,
        nodeName: node.name
      };
    } catch (error) {
      const isTimeout = error instanceof Error && error.name === 'AbortError';
      
      return {
        success: false,
        nodeName: node.name,
        error: new InscriptionError({
          code: isTimeout ? ErrorCode.TRANSACTION_BROADCAST_TIMEOUT : ErrorCode.TRANSACTION_BROADCAST_FAILED,
          message: isTimeout 
            ? `Broadcast to ${node.name} timed out after ${options.timeout}ms` 
            : `Failed to broadcast transaction to ${node.name}: ${error instanceof Error ? error.message : String(error)}`,
          details: {
            isTimeout,
            node: node.name,
            originalError: error
          }
        })
      };
    }
  }
  
  /**
   * Validate transaction hex before broadcasting
   * @param txHex - Transaction hex string
   * @returns True if valid, false otherwise
   */
  private validateTransactionHex(txHex: string): boolean {
    // Basic validation - check if it's a hex string with reasonable length
    return /^[a-fA-F0-9]+$/.test(txHex) && txHex.length > 10;
  }
  
  /**
   * Broadcast a transaction with retry logic
   * @param txHex - Transaction hex string
   * @param transactionId - Transaction ID for tracking
   * @param options - Broadcast options
   * @returns Promise resolving to broadcast result
   */
  private async broadcastWithRetry(
    txHex: string, 
    transactionId: string, 
    options: BroadcastOptions
  ): Promise<BroadcastResult> {
    const mergedOptions = { ...DEFAULT_BROADCAST_OPTIONS, ...options };
    const { network, maxRetries, initialBackoffMs, maxBackoffMs, preferredNodes } = mergedOptions;
    
    // Get active nodes for this network
    const activeNodes = this.getActiveNodes(network, preferredNodes);
    
    if (activeNodes.length === 0) {
      this.emit('broadcastError', {
        transactionId,
        error: new InscriptionError({
          code: ErrorCode.NO_ACTIVE_NODES,
          message: `No active nodes available for network ${network}`,
          details: { network }
        })
      });
      
      return {
        success: false,
        error: new InscriptionError({
          code: ErrorCode.NO_ACTIVE_NODES,
          message: `No active nodes available for network ${network}`,
          details: { network }
        })
      };
    }
    
    let currentRetry = 0;
    let lastError: InscriptionError | undefined;
    
    while (currentRetry <= maxRetries!) {
      // Update retry count in the map
      this.activeRetries.set(transactionId, currentRetry);
      
      // Try each node in priority order
      for (const node of activeNodes) {
        // Skip if currently in progress
        if (this.inProgressBroadcasts.has(`${transactionId}:${node.name}`)) {
          continue;
        }
        
        try {
          // Mark as in progress
          this.inProgressBroadcasts.add(`${transactionId}:${node.name}`);
          
          this.statusTracker.addTransactionProgressEvent({
            transactionId,
            message: `Attempting broadcast to ${node.name} (attempt ${currentRetry + 1})`,
            timestamp: new Date()
          });
          
          const result = await this.broadcastToNode(txHex, node, mergedOptions);
          
          // Remove in progress marker
          this.inProgressBroadcasts.delete(`${transactionId}:${node.name}`);
          
          if (result.success) {
            // Successful broadcast
            this.statusTracker.addTransactionProgressEvent({
              transactionId,
              message: `Broadcast successful via ${node.name}`,
              timestamp: new Date(),
              data: { txid: result.txid }
            });
            
            // Clear retry count
            this.activeRetries.delete(transactionId);
            
            return result;
          } else {
            // Failed broadcast but continue to next node
            lastError = result.error;
            
            this.statusTracker.addTransactionProgressEvent({
              transactionId,
              message: `Broadcast to ${node.name} failed: ${result.error?.message}`,
              timestamp: new Date(),
              data: { error: result.error }
            });
          }
        } catch (error) {
          // Unexpected error
          this.inProgressBroadcasts.delete(`${transactionId}:${node.name}`);
          
          const inscriptionError = new InscriptionError({
            code: ErrorCode.TRANSACTION_BROADCAST_FAILED,
            message: `Unexpected error broadcasting to ${node.name}: ${error instanceof Error ? error.message : String(error)}`,
            details: { originalError: error, node: node.name }
          });
          
          lastError = inscriptionError;
          
          this.statusTracker.addTransactionProgressEvent({
            transactionId,
            message: `Unexpected error with ${node.name}: ${inscriptionError.message}`,
            timestamp: new Date(),
            data: { error: inscriptionError }
          });
        }
      }
      
      // If we got here, all nodes failed for this retry
      if (currentRetry < maxRetries!) {
        // Calculate backoff with exponential increase
        const backoffMs = Math.min(
          initialBackoffMs! * Math.pow(2, currentRetry),
          maxBackoffMs!
        );
        
        this.statusTracker.addTransactionProgressEvent({
          transactionId,
          message: `All nodes failed, retry ${currentRetry + 1}/${maxRetries} in ${backoffMs}ms`,
          timestamp: new Date()
        });
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, backoffMs));
        currentRetry++;
      } else {
        // No more retries
        break;
      }
    }
    
    // If we get here, all retries failed
    this.activeRetries.delete(transactionId);
    
    return {
      success: false,
      error: lastError || new InscriptionError({
        code: ErrorCode.TRANSACTION_BROADCAST_FAILED,
        message: `Failed to broadcast transaction after ${maxRetries} retries`,
        details: { network, maxRetries }
      })
    };
  }
  
  /**
   * Broadcast a transaction
   * @param txHex - Transaction hex string
   * @param txType - Transaction type (commit or reveal)
   * @param options - Broadcast options
   * @param parentId - Optional parent transaction ID (for reveal transactions)
   * @returns Promise resolving to transaction ID and tracking ID
   */
  public async broadcastTransaction(
    txHex: string,
    txType: TransactionType,
    options: Partial<BroadcastOptions> = {},
    parentId?: string
  ): Promise<{ txid: string; transactionId: string }> {
    const mergedOptions = { ...DEFAULT_BROADCAST_OPTIONS, ...options };
    
    // Validate transaction hex if not skipped
    if (!mergedOptions.skipValidation && !this.validateTransactionHex(txHex)) {
      throw new InscriptionError({
        code: ErrorCode.INVALID_TRANSACTION_HEX,
        message: 'Invalid transaction hex format',
        details: { txHexLength: txHex.length }
      });
    }
    
    // Generate tracking ID
    const transactionId = generateId();
    
    // Create tracked transaction
    const trackedTx: TrackedTransaction = {
      id: transactionId,
      txid: '', // Will be updated once broadcast succeeds
      type: txType,
      status: TransactionStatus.PENDING,
      createdAt: new Date(),
      lastUpdatedAt: new Date(),
      parentId
    };
    
    // Add to tracker
    this.statusTracker.addTransaction(trackedTx);
    
    // Start broadcast process
    this.emit('broadcastStarted', { transactionId, txType });
    
    try {
      const result = await this.broadcastWithRetry(txHex, transactionId, mergedOptions);
      
      if (result.success && result.txid) {
        // Update transaction with txid
        this.statusTracker.updateTransactionTxid(transactionId, result.txid);
        
        this.emit('broadcastSuccess', {
          transactionId,
          txid: result.txid,
          nodeName: result.nodeName
        });
        
        return {
          txid: result.txid,
          transactionId
        };
      } else {
        // Update transaction with error
        this.statusTracker.setTransactionError(transactionId, result.error!);
        this.statusTracker.setTransactionStatus(transactionId, TransactionStatus.FAILED);
        
        this.emit('broadcastFailed', {
          transactionId,
          error: result.error
        });
        
        throw result.error;
      }
    } catch (error) {
      const inscriptionError = error instanceof InscriptionError 
        ? error 
        : new InscriptionError({
            code: ErrorCode.TRANSACTION_BROADCAST_FAILED,
            message: error instanceof Error ? error.message : String(error),
            details: { originalError: error }
          });
      
      // Update transaction with error
      this.statusTracker.setTransactionError(transactionId, inscriptionError);
      this.statusTracker.setTransactionStatus(transactionId, TransactionStatus.FAILED);
      
      this.emit('broadcastFailed', {
        transactionId,
        error: inscriptionError
      });
      
      throw inscriptionError;
    }
  }
  
  /**
   * Get the status of active retries
   * @returns Map of transaction IDs to retry counts
   */
  public getActiveRetries(): Map<string, number> {
    return new Map(this.activeRetries);
  }
  
  /**
   * Get the currently in-progress broadcasts
   * @returns Set of transaction ID:node name combinations
   */
  public getInProgressBroadcasts(): Set<string> {
    return new Set(this.inProgressBroadcasts);
  }
  
  /**
   * Cancel an active broadcast
   * @param transactionId - Transaction ID to cancel
   */
  public cancelBroadcast(transactionId: string): void {
    // Remove from active retries
    this.activeRetries.delete(transactionId);
    
    // Remove from in-progress broadcasts
    for (const key of this.inProgressBroadcasts) {
      if (key.startsWith(`${transactionId}:`)) {
        this.inProgressBroadcasts.delete(key);
      }
    }
    
    // Update transaction status
    const transaction = this.statusTracker.getTransaction(transactionId);
    if (transaction && transaction.status === TransactionStatus.PENDING) {
      this.statusTracker.setTransactionStatus(transactionId, TransactionStatus.FAILED);
      this.statusTracker.setTransactionError(
        transactionId,
        new InscriptionError({
          code: ErrorCode.TRANSACTION_BROADCAST_CANCELLED,
          message: 'Transaction broadcast cancelled',
          details: { transactionId }
        })
      );
    }
    
    this.emit('broadcastCancelled', { transactionId });
  }
} 
/**
 * Interface for Bitcoin transactions
 */
export interface Transaction {
  txid: string;
  vsize?: number;
  status?: string;
  error?: any;
}

/**
 * Transaction types used throughout the application
 */
export enum TransactionType {
  COMMIT = 'COMMIT',
  REVEAL = 'REVEAL'
} 
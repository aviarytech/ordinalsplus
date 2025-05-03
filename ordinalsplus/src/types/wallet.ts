/**
 * Interface for Bitcoin UTXO (Unspent Transaction Output)
 */
export interface UTXO {
  txid: string;
  vout: number;
  value: number;
  status?: string;
  height?: number;
  confirmations?: number;
  scriptPubKey?: string;
  address?: string;
}

/**
 * Wallet connection status
 */
export enum WalletStatus {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR'
}

/**
 * Interface for wallet balance information
 */
export interface WalletBalance {
  confirmed: number;
  unconfirmed: number;
  total: number;
} 
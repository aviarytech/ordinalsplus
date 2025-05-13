/**
 * Types and interfaces for resource creation functions in the ordinalsplus package.
 */

import { BitcoinNetwork, Utxo, LinkedResource } from './index';

/**
 * Configuration for resource creation wallet details
 */
export interface WalletConfig {
  network: BitcoinNetwork;
  privateKey?: string;         // WIF format private key
  publicKey: string;           // Hex-encoded public key (for address derivation)
  address: string;             // Address for receiving change/transactions
  utxos: Utxo[];               // Available UTXOs for funding transactions
}

/**
 * Resource metadata for creation
 */
export interface ResourceMetadata {
  type: string;                // Resource type identifier
  name?: string;               // Optional resource name
  description?: string;        // Optional resource description
  properties?: Record<string, any>; // Additional properties
  tags?: string[];             // Optional tags for categorization
}

/**
 * Inscription content configuration
 */
export interface InscriptionContent {
  contentType: string;         // MIME type of the content (e.g., 'application/json')
  content: string | Buffer;    // The actual content to inscribe
  encoding?: 'utf8' | 'base64' | 'hex'; // Encoding of string content, if applicable
}

/**
 * Transaction fee configuration
 */
export interface FeeConfig {
  feeRate: number;             // Fee rate in sats/vB
  maxFee?: number;             // Optional maximum total fee to allow
  priorityLevel?: 'low' | 'medium' | 'high'; // Optional priority level
}

/**
 * Output from resource creation operations
 */
export interface ResourceCreationOutput {
  resourceId: string;          // The created resource ID
  inscriptionId: string;       // ID of the created inscription
  transactions: {
    commit: string;            // Commit transaction ID
    reveal: string;            // Reveal transaction ID
  };
  linkedResource: LinkedResource; // The created linked resource
  fees: {
    commitFee: number;         // Fee paid for commit transaction
    revealFee: number;         // Fee paid for reveal transaction
    totalFee: number;          // Total fees paid
  };
}

/**
 * Parameters for creating a resource
 */
export interface CreateResourceParams {
  wallet: WalletConfig;        // Wallet configuration
  metadata: ResourceMetadata;  // Resource metadata
  content: InscriptionContent; // Content to inscribe
  fees: FeeConfig;             // Fee configuration
  satNumber?: number;          // Optional specific sat number to use
}

/**
 * Configuration for PSBT (Partially Signed Bitcoin Transaction)
 */
export interface PSBTConfig {
  network: BitcoinNetwork;
  inputs: Utxo[];              // UTXOs to use as inputs
  outputs: {
    address: string;           // Recipient address
    value: number;             // Amount in satoshis
  }[];
  changeAddress: string;       // Address for change
  feeRate: number;             // Fee rate in sats/vB
}

/**
 * PSBT operation result
 */
export interface PSBTResult {
  psbtBase64: string;          // Base64-encoded PSBT
  fee: number;                 // Estimated fee
  selectedUtxos: Utxo[];       // UTXOs selected for the transaction
  txid?: string;               // Transaction ID if finalized
  hex?: string;                // Transaction hex if finalized
} 
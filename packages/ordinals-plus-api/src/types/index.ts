import type { Inscription, LinkedResource } from 'ordinalsplus';

// Export collection types
export * from './collection';

/* // Commenting out problematic imports - Address later if needed
import {
    // Example types - adjust based on actual exports in ordinalsplus
    // DidDocument, // Assuming this is a default or named export
    // ResourceMetadata, // Example
    Utxo, // Example
    Inscription, // Example
    LinkedResource, // Example
    // Add other necessary types
} from "ordinalsplus";
*/

// Re-export specific named types
/* // Commenting out problematic re-exports
export type {
    LinkedResource, 
    Inscription, 
    ResourceProvider, 
    Utxo,
    // DIDDocumentResponse, // Assuming this might not exist or is named differently
    // ResourceResponse // Assuming this might not exist or is named differently
} from "ordinalsplus";
*/

// --- Define Utxo locally if import fails ---
// Minimal Utxo definition needed for request types
export interface Utxo {
  txid: string;
  vout: number;
  value: number;
  scriptPubKey?: string | undefined;
}

export interface ApiConfig {
  network: string;
  port: number;
  host: string;
  ordNodeUrl: string;
  ordscanApiKey?: string;
  corsOrigin?: string;
  rateLimit?: {
    windowMs: number;
    max: number;
  };
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: ApiError;
  meta?: {
    timestamp: string;
    requestId: string;
    [key: string]: unknown;
  };
}

/* Commenting out as ResourceMetadata and CuratedCollectionCredential 
   are not currently exported from ordinalsplus
export interface ResourceCollection {
  id: string;
  type: 'did' | 'heritage' | 'controller' | 'curated';
  resources: string[];
  metadata?: ResourceMetadata;
  credential?: CuratedCollectionCredential;
}
*/

export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  services: {
    ordNode: boolean;
    ordscan: boolean;
  };
  version: string;
}

export interface NetworkConfig {
  networks: Network[];
  defaultNetwork: string;
}

export interface Network {
  id: string;
  name: string;
  description?: string;
  isTestnet: boolean;
  apiEndpoint: string;
  explorerUrl: string;
}

// --- Inscription Creation Types --- 

// Shared interface for inscription requests
export interface GenericInscriptionRequest {
  contentType: string;
  contentBase64: string; // Base64 encoded content
  feeRate: number;       // Fee rate in sats/vbyte
  recipientAddress: string; // Address to send the inscription
  // senderPublicKey: string; // REMOVED - Not needed for reveal PSBT generation
  utxos?: Utxo[];         // Optional UTXOs for funding the transaction
  changeAddress?: string; // Optional change address (defaults to recipient if not provided)
  networkType?: NetworkType; // Optional network type (defaults to testnet if not provided)
}

// Specific request for DID inscription
export interface DidInscriptionRequest extends GenericInscriptionRequest {}

// Specific request for Resource inscription
export interface ResourceInscriptionRequest extends GenericInscriptionRequest {
  parentDid?: string;     // Optional DID the resource is linked to
  metadata?: Record<string, string>; // Optional metadata
  // Note: Extends Generic, so doesn't need fields listed again
  // unless overriding or adding specifics like parentDid/metadata
}

// --- Restore first PsbtResponse definition ---
export interface PsbtResponse {
  psbtBase64: string; // The partially signed reveal transaction, base64 encoded
  commitTxOutputValue: number; // The value (in sats) required for the commit transaction's P2TR output
  revealFee: number; // The estimated fee (in sats) for the reveal transaction itself
  revealSignerPrivateKeyWif: string; // The WIF private key needed to sign the reveal transaction input
}

// --- NEW: Combined Response for Commit + Reveal PSBTs --- 
export interface CombinedPsbtResponse {
  commitPsbtBase64: string;           // Base64 encoded unsigned commit PSBT
  unsignedRevealPsbtBase64: string;  // Base64 encoded unsigned reveal PSBT (with placeholders)
  revealSignerWif: string;           // WIF key to sign reveal input
  commitTxOutputValue: number;       // Value required for commit transaction's P2TR output
  revealFee: number;                 // Estimated fee for the reveal transaction
}

// --- Restore first FeeEstimateResponse definition ---
export interface FeeEstimateResponse {
  low: number; // sat/vB
  medium: number; // sat/vB
  high: number; // sat/vB
}

export interface TransactionStatusRequest {
  txid: string;
}

export interface TransactionStatusResponse {
  status: 'pending' | 'confirmed' | 'failed' | 'not_found';
  blockHeight?: number;
  inscriptionId?: string;
}

// --- Inscription Content Fetching (NEW) ---
export interface InscriptionDetailsResponse {
  inscriptionId: string;
  contentType: string;
  contentBase64: string;
  contentLength: number; // Byte length of the original content
}

// --- Error Response ---
export interface ErrorResponse {
  error: string;
  details?: any; // Optional additional details
}

// --- General API Response Structure (Placeholder - refine as needed) ---
export interface ApiResponse {
  linkedResources: LinkedResource[];
  dids?: any[]; // Define DID type if needed
  page?: number;
  totalItems?: number;
  itemsPerPage?: number;
  // error?: string; // REMOVED to avoid type conflict
}

// --- Explorer State (Mirrors frontend type) ---
export interface ExplorerState {
  linkedResources: LinkedResource[];
  isLoading: boolean;
  error: string | null;
  currentPage: number;
  totalItems: number;
  itemsPerPage: number;
}

// --- Inscription Response (from Ordinals Provider) ---
// Defines the expected structure from provider.fetchInscriptions
export interface InscriptionResponse {
  results: Inscription[]; // Assuming the provider returns inscriptions in a 'results' array
  total: number; // Total number of inscriptions available
  limit: number; // The limit used for the request
  offset: number; // The offset used for the request
}

// --- Network Configuration (NEW) ---
export interface NetworkInfo {
  id: string; // e.g., 'mainnet', 'testnet'
  name: string; // e.g., 'Bitcoin Mainnet', 'Bitcoin Testnet'
  // Add other relevant fields if needed, like explorer URLs, etc.
}

// --- Add NetworkType --- 
export type NetworkType = 'mainnet' | 'signet' | 'testnet';

// Define a placeholder type if DidDocument isn't available
type PlaceholderDidDocument = { id: string; [key: string]: any };

// --- UTXO Response --- 
// Define UtxoApiResponse for the GET /api/addresses/:address/utxos endpoint
export interface UtxoApiResponse {
  status: 'success'; // Only success status includes data
  data: Utxo[];
} 
// Error case is handled by ErrorResponse defined earlier

// --- Transaction Broadcast Response --- 
export interface BroadcastResponse {
// ... existing code ...
} 

// --- NEW: Request type for createInscriptionPsbts service function ---
export interface CreatePsbtsRequest extends GenericInscriptionRequest {
    utxos: Utxo[];
    changeAddress: string;
    networkType: NetworkType; // Added networkType for network config selection
    testMode?: boolean;  // Added testMode parameter for testing purposes
} 
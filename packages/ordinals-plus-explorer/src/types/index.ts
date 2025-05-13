import { LinkedResource } from 'ordinalsplus';

// Explorer-specific types
export interface ApiResponse {
  linkedResources: LinkedResource[];
  page: number;
  totalItems: number;
  itemsPerPage: number;
  error?: string;
}

export interface ExplorerState {
  linkedResources: LinkedResource[];
  isLoading: boolean;
  error: string | null;
  currentPage: number;
  totalItems: number;
  itemsPerPage: number;
}

export interface ResourceCollection {
  id: string;
  type: 'did' | 'heritage' | 'controller' | 'curated';
  resources: string[];
  // metadata?: ResourceMetadata;
  // credential?: CuratedCollectionCredential;
}

export interface NetworkConfig {
  name: string;
  baseUrl: string;
  apiKey?: string;
  isTestnet?: boolean;
}

export interface NetworkContextType {
  currentNetwork: string;
  setNetwork: (network: string) => void;
  isConnected: boolean;
  networks: Record<string, NetworkConfig>;
}

export interface Network {
  id: string;
  name: string;
  enabled: boolean;
  description: string;
}

// Types mirrored from ordinals-plus-api/src/types/index.ts
// Ensure these stay in sync with the backend definitions

// --- Inscription Creation Types --- 

export interface GenericInscriptionRequest {
  contentType: string;
  contentBase64: string;
  feeRate: number; // Fee rate in sat/vB
  recipientAddress: string;
}

export interface DidInscriptionRequest { 
  feeRate: number; // Fee rate in sat/vB
  // Add other fields if the did:btco spec requires them during creation
}

export interface ResourceInscriptionRequest {
  parentDid?: string; // Make optional - The did:btco URI to link to
  contentType: string;
  contentBase64: string; // Changed from 'content' to match form data prep
  feeRate: number; // Fee rate in sat/vB
  recipientAddress: string; // Added: Address to receive the inscription
  metadata?: Record<string, string>; // Add optional metadata field
}

// Duplicated and updated from ordinals-plus-api/src/types/index.ts
// TODO: Resolve type sharing issue between packages
export interface PsbtResponse {
  psbtBase64: string; // The partially signed transaction, base64 encoded
  commitTxOutputValue: number; // The value (in sats) required for the commit transaction's P2TR output
  revealFee: number; // The estimated fee (in sats) for the reveal transaction itself
  revealSignerPrivateKeyWif: string; // The WIF private key needed to sign the reveal transaction input
}

export interface FeeEstimateResponse {
  low: number; // sat/vB
  medium: number; // sat/vB
  high: number; // sat/vB
}

export interface TransactionStatusResponse {
  status: 'pending' | 'confirmed' | 'failed' | 'not_found';
  blockHeight?: number;
  inscriptionId?: string;
  seen?: boolean;
  confirmations?: number;
}

// --- Inscription Content Fetching (NEW - Mirrors backend) ---
export interface InscriptionDetailsResponse {
  inscriptionId: string;
  contentType: string;
  contentBase64: string;
  contentLength: number; // Byte length of the original content
}

// --- Network Information (Mirrors backend) ---
export interface NetworkInfo {
  id: string;
  name: string;
  type: 'mainnet' | 'testnet' | 'regtest' | 'signet';
  apiUrl?: string;
}

// Error response structure (optional, for typing error handlers)
export interface ApiErrorResponse {
  error: string;
  details?: any;
}

// Add the API response type definition here
export interface CreateCommitApiResponse {
    commitPsbtBase64: string;
    unsignedRevealPsbtBase64: string;
    revealSignerWif: string;
    commitTxOutputValue: number;
    revealFee: number;
}

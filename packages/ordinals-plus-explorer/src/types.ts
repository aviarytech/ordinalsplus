// Add or update types related to inscriptions and resources

// Fee Estimates
export interface FeeEstimateResponse {
  low: number;
  medium: number;
  high: number;
}

// Network Information
export interface NetworkInfo {
  id: string;
  name: string;
  chain?: string;
  testnet?: boolean;
  isDefault?: boolean;
}

// Inscription Details Response
export interface InscriptionDetailsResponse {
  id: string;
  number: number;
  address?: string;
  content?: string;
  contentType?: string;
  contentLength?: number;
  timestamp?: string;
  offset?: number;
  genesisTransaction?: string;
  location?: string;
  output?: string;
  preview?: string;
  sat?: number;
  satRarity?: string;
  satName?: string;
} 
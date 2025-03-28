import type { 
  CuratedCollectionCredential, 
  ResourceMetadata,
  DID, 
  LinkedResource, 
  Inscription, 
  InscriptionResponse, 
  ExplorerApiResponse 
} from "ordinalsplus";

// Re-export core types
export type { DID, LinkedResource, Inscription, InscriptionResponse, ExplorerApiResponse };

export interface ApiConfig {
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

export interface ResourceCollection {
  id: string;
  type: 'did' | 'heritage' | 'controller' | 'curated';
  resources: string[];
  metadata?: ResourceMetadata;
  credential?: CuratedCollectionCredential;
}

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
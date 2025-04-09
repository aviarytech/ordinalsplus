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

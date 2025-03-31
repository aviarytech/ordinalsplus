import { CuratedCollectionCredential, DID as OrdinalsDID, ExplorerApiResponse, LinkedResource, ResourceInfo, ResourceMetadata } from "ordinalsplus";

export type DID = OrdinalsDID;

// Explorer-specific types
export interface ApiResponse extends ExplorerApiResponse {
  linkedResources: LinkedResource[];
  dids: DID[];
  page: number;
  totalItems: number;
  itemsPerPage: number;
  error?: string;
}

export interface ExplorerState {
  dids: DID[];
  linkedResources: LinkedResource[];
  isLoading: boolean;
  error: string | null;
  currentPage: number;
  totalItems: number;
  itemsPerPage: number;
}

export interface CoreLinkedResource extends LinkedResource {
  id: string;
  type: string;
  didReference?: string;
  contentType: string;
  content: Record<string, unknown>;
  sat?: string;
  metadata?: ResourceMetadata;
  info?: ResourceInfo;
}

export interface ResourceCollection {
  id: string;
  type: 'did' | 'heritage' | 'controller' | 'curated';
  resources: string[];
  metadata?: ResourceMetadata;
  credential?: CuratedCollectionCredential;
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

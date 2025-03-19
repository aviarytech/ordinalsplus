export interface Inscription {
  id: string;
  number: number;
  address: string;
  content_type: string;
  content: string;
  content_length: number;
  timestamp: string;
  genesis_transaction: string;
  output_value: number;
  offset: number;
  location: string;
  genesis_fee: number;
}

export interface InscriptionResponse {
  limit: number;
  offset: number;
  total: number;
  results: Inscription[];
}

export interface DID {
  id: string; // did:xxx format (any DID method)
  inscriptionId: string;
  contentType: string;
  content: Record<string, unknown>;
}

export interface LinkedResource {
  id: string;
  resourceId: string; // Use for resource ID 
  type: string;
  resourceType: string; // Normalized resource type for display
  didReference?: string; // Reference to a DID if present
  did: string; // DID reference
  inscriptionId: string;
  contentType: string;
  content: string | Record<string, unknown>;
  createdAt: string; // Timestamp when resource was created
}

export interface ApiResponse {
  dids: DID[];
  linkedResources: LinkedResource[];
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

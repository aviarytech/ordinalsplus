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
  sat?: number;
  sat_ordinal?: string;
  content_url?: string;
  metadata?: any;
  inscriptionId?: string;
}

export interface InscriptionResponse {
  limit: number;
  offset: number;
  total: number;
  results: Inscription[];
}

export interface DID {
  id: string; // did:btco:xxx format
  inscriptionId: string;
  contentType: string;
  content: Record<string, unknown>;
}

export interface LinkedResource {
  id: string;
  type: string;
  didReference?: string; // Reference to a DID if present
  inscriptionId: string;
  contentType: string;
  content: Record<string, unknown>;
}

export interface ExplorerApiResponse {
  dids: DID[];
  linkedResources: LinkedResource[];
  error?: string;
} 
/**
 * Collection Types
 * 
 * This module defines TypeScript interfaces for curated collections
 * that group multiple inscriptions into authenticated collections.
 */
import type { VerifiableCredential, CredentialSubject, Issuer } from './verifiableCredential';

/**
 * Visibility settings for collections
 */
export enum CollectionVisibility {
  /** Publicly visible and searchable */
  PUBLIC = 'public',
  /** Visible only to the owner and explicitly shared users */
  PRIVATE = 'private',
  /** Publicly accessible via direct link but not listed in searches */
  UNLISTED = 'unlisted'
}

/**
 * Standard categories for collections
 */
export enum CollectionCategory {
  ART = 'art',
  COLLECTIBLES = 'collectibles',
  PHOTOGRAPHY = 'photography',
  MUSIC = 'music',
  VIDEO = 'video',
  DOCUMENTS = 'documents',
  GAMING = 'gaming',
  MEMES = 'memes',
  OTHER = 'other'
}

/**
 * Collection item representing an inscription or other resource in a collection
 */
export interface CollectionItem {
  /** DID of the item */
  did: string;
  /** Inscription ID if applicable */
  inscriptionId?: string;
  /** Order/position in the collection (for sorting) */
  order?: number;
  /** Notes specific to this item in the collection */
  notes?: string;
  /** Date added to the collection */
  addedAt: string;
  /** Additional item properties */
  [key: string]: any;
}

/**
 * Metadata for collections
 */
export interface CollectionMetadata {
  /** Name of the collection */
  name: string;
  /** Description of the collection */
  description: string;
  /** URL to the collection image/thumbnail */
  image?: string;
  /** Collection category */
  category: CollectionCategory;
  /** Additional tags for the collection */
  tags?: string[];
  /** Visibility setting */
  visibility: CollectionVisibility;
  /** Creation date (ISO string) */
  createdAt: string;
  /** Last updated date (ISO string) */
  updatedAt: string;
  /** Inscription ID if the collection is inscribed on-chain */
  inscriptionId?: string;
  /** Additional metadata properties */
  [key: string]: any;
}

/**
 * Subject for a collection credential
 */
export interface CollectionCredentialSubject extends CredentialSubject {
  /** Collection metadata */
  collection: CollectionMetadata;
  /** Items in the collection */
  items: CollectionItem[];
}

/**
 * Verifiable credential for a collection
 */
export interface CollectionCredential extends VerifiableCredential {
  /** Override to specify the collection credential subject */
  credentialSubject: CollectionCredentialSubject;
}

/**
 * Main collection interface
 */
export interface Collection {
  /** Unique identifier for the collection */
  id: string;
  /** DID of the curator/owner */
  curatorDid: string;
  /** Collection metadata */
  metadata: CollectionMetadata;
  /** Items in the collection */
  items: CollectionItem[];
  /** Verifiable credential for the collection (if issued) */
  credential?: CollectionCredential;
  /** Access control list (DIDs with access) */
  accessList?: string[];
}

/**
 * Parameters for creating a new collection
 */
export interface CreateCollectionParams {
  /** DID of the curator/owner */
  curatorDid: string;
  /** Collection name */
  name: string;
  /** Collection description */
  description: string;
  /** Collection image URL */
  image?: string;
  /** Collection category */
  category: CollectionCategory;
  /** Additional tags */
  tags?: string[];
  /** Visibility setting */
  visibility?: CollectionVisibility;
  /** Initial items to add to the collection */
  items?: Omit<CollectionItem, 'addedAt'>[];
}

/**
 * Parameters for issuing a collection credential
 */
export interface CollectionCredentialIssuanceParams {
  /** Collection ID */
  collectionId: string;
  /** DID of the issuer */
  issuerDid: string;
}

/**
 * Collection query parameters
 */
export interface CollectionQueryParams {
  /** Filter by curator DID */
  curatorDid?: string;
  /** Filter by item DID */
  itemDid?: string;
  /** Filter by category */
  category?: CollectionCategory;
  /** Filter by tags (must match all provided tags) */
  tags?: string[];
  /** Filter by visibility */
  visibility?: CollectionVisibility;
  /** Search term (matches name or description) */
  search?: string;
  /** Pagination: page number (1-based) */
  page?: number;
  /** Pagination: items per page */
  limit?: number;
  /** Sort field */
  sortBy?: 'createdAt' | 'updatedAt' | 'name';
  /** Sort direction */
  sortDirection?: 'asc' | 'desc';
}

/**
 * Collection update parameters
 */
export interface UpdateCollectionParams {
  /** Collection name */
  name?: string;
  /** Collection description */
  description?: string;
  /** Collection image URL */
  image?: string;
  /** Collection category */
  category?: CollectionCategory;
  /** Additional tags */
  tags?: string[];
  /** Visibility setting */
  visibility?: CollectionVisibility;
  /** Access control list */
  accessList?: string[];
}

/**
 * Collection item update parameters
 */
export interface UpdateCollectionItemParams {
  /** Order/position in the collection */
  order?: number;
  /** Notes specific to this item */
  notes?: string;
}

/**
 * Collection pagination result
 */
export interface CollectionPaginationResult {
  /** Collections matching the query */
  collections: Collection[];
  /** Total number of collections matching the query */
  total: number;
  /** Current page number */
  page: number;
  /** Number of items per page */
  limit: number;
}

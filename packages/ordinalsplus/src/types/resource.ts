/**
 * Types and interfaces for resource creation and management in the ordinalsplus package.
 * This file defines the data model for DID-linked resources, including content types,
 * size limits, metadata schema, and relationship to DIDs.
 */

import { BitcoinNetwork, Utxo, LinkedResource } from './index';

/**
 * Enum defining the supported resource types
 * Used for categorizing different kinds of resources linked to DIDs
 */
export enum ResourceType {
  SCHEMA = 'schema',           // JSON Schema definitions
  IMAGE = 'image',             // Images (PNG, JPEG, SVG, etc.)
  DOCUMENT = 'document',       // Documents (PDF, TXT, etc.)
  CREDENTIAL = 'credential',   // Verifiable Credential templates
  CODE = 'code',               // Code snippets or executable code
  AUDIO = 'audio',             // Audio files
  VIDEO = 'video',             // Video files
  DATA = 'data',               // Generic data files
  METADATA = 'metadata',       // Metadata about the DID or other resources
  OTHER = 'other'              // Other resource types
}

/**
 * Enum defining supported content types for resources
 * Maps to standard MIME types
 */
export enum ResourceContentType {
  // JSON types
  JSON = 'application/json',
  JSON_LD = 'application/ld+json',
  JSON_SCHEMA = 'application/schema+json',
  
  // Image types
  PNG = 'image/png',
  JPEG = 'image/jpeg',
  SVG = 'image/svg+xml',
  GIF = 'image/gif',
  WEBP = 'image/webp',
  
  // Document types
  PDF = 'application/pdf',
  TEXT = 'text/plain',
  HTML = 'text/html',
  MARKDOWN = 'text/markdown',
  
  // Audio types
  MP3 = 'audio/mpeg',
  WAV = 'audio/wav',
  
  // Video types
  MP4 = 'video/mp4',
  WEBM = 'video/webm',
  
  // Other types
  BINARY = 'application/octet-stream',
  CBOR = 'application/cbor',
  XML = 'application/xml'
}

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
 * Enhanced resource metadata for creation and management
 */
export interface ResourceMetadata {
  type: ResourceType | string;  // Resource type from enum or custom string
  name?: string;                // Optional resource name
  description?: string;         // Optional resource description
  properties?: Record<string, any>; // Additional properties
  tags?: string[];              // Optional tags for categorization
  size?: number;                // Size in bytes
  createdAt?: string;           // ISO timestamp of creation
  updatedAt?: string;           // ISO timestamp of last update
  version?: string;             // Optional version identifier
  parentDid?: string;           // DID that owns this resource
  index?: number;               // Index of this resource within the DID's resources
}

/**
 * Resource validation rules
 */
export interface ResourceValidationRules {
  maxSize: number;              // Maximum size in bytes
  allowedContentTypes: ResourceContentType[] | string[]; // Allowed content types
  requiredMetadataFields: string[]; // Required metadata fields
}

/**
 * Default validation rules by resource type
 */
export const DEFAULT_VALIDATION_RULES: Record<ResourceType, ResourceValidationRules> = {
  [ResourceType.SCHEMA]: {
    maxSize: 100 * 1024,        // 100KB
    allowedContentTypes: [
      ResourceContentType.JSON,
      ResourceContentType.JSON_SCHEMA
    ],
    requiredMetadataFields: ['name']
  },
  [ResourceType.IMAGE]: {
    maxSize: 1024 * 1024,       // 1MB
    allowedContentTypes: [
      ResourceContentType.PNG,
      ResourceContentType.JPEG,
      ResourceContentType.SVG,
      ResourceContentType.GIF,
      ResourceContentType.WEBP
    ],
    requiredMetadataFields: []
  },
  [ResourceType.DOCUMENT]: {
    maxSize: 2 * 1024 * 1024,   // 2MB
    allowedContentTypes: [
      ResourceContentType.PDF,
      ResourceContentType.TEXT,
      ResourceContentType.HTML,
      ResourceContentType.MARKDOWN
    ],
    requiredMetadataFields: []
  },
  [ResourceType.CREDENTIAL]: {
    maxSize: 100 * 1024,        // 100KB
    allowedContentTypes: [
      ResourceContentType.JSON,
      ResourceContentType.JSON_LD
    ],
    requiredMetadataFields: ['name']
  },
  [ResourceType.CODE]: {
    maxSize: 500 * 1024,        // 500KB
    allowedContentTypes: [
      ResourceContentType.TEXT
    ],
    requiredMetadataFields: []
  },
  [ResourceType.AUDIO]: {
    maxSize: 5 * 1024 * 1024,   // 5MB
    allowedContentTypes: [
      ResourceContentType.MP3,
      ResourceContentType.WAV
    ],
    requiredMetadataFields: []
  },
  [ResourceType.VIDEO]: {
    maxSize: 10 * 1024 * 1024,  // 10MB
    allowedContentTypes: [
      ResourceContentType.MP4,
      ResourceContentType.WEBM
    ],
    requiredMetadataFields: []
  },
  [ResourceType.DATA]: {
    maxSize: 1024 * 1024,       // 1MB
    allowedContentTypes: [
      ResourceContentType.JSON,
      ResourceContentType.XML,
      ResourceContentType.BINARY,
      ResourceContentType.CBOR
    ],
    requiredMetadataFields: []
  },
  [ResourceType.METADATA]: {
    maxSize: 100 * 1024,        // 100KB
    allowedContentTypes: [
      ResourceContentType.JSON,
      ResourceContentType.JSON_LD
    ],
    requiredMetadataFields: []
  },
  [ResourceType.OTHER]: {
    maxSize: 1024 * 1024,       // 1MB
    allowedContentTypes: [
      ResourceContentType.BINARY
    ],
    requiredMetadataFields: ['name', 'description']
  }
};

/**
 * DID URL resource path structure
 * Parses paths like: did:btco:<satNumber>/resources/<resourceIndex>
 */
export interface ResourcePath {
  did: string;                  // The base DID
  satNumber: string;            // Sat number from the DID
  resourcePath: string;         // The full path component
  resourceIndex?: number;       // Index of the resource (if specified)
  query?: Record<string, string>; // Query parameters
  fragment?: string;            // Fragment identifier
}

/**
 * Inscription content configuration
 */
export interface InscriptionContent {
  contentType: ResourceContentType | string; // MIME type of the content
  content: string | Buffer;     // The actual content to inscribe
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
 * Enhanced linked resource interface with additional metadata
 */
export interface EnhancedLinkedResource extends LinkedResource {
  metadata: ResourceMetadata;   // Resource metadata
  validationRules?: ResourceValidationRules; // Validation rules for this resource
  relationships?: {
    parentDid: string;          // Parent DID
    relatedResources?: string[]; // Related resource IDs
  };
  size: number;                 // Size in bytes
  createdAt: string;            // ISO timestamp of creation
  updatedAt: string;            // ISO timestamp of last update
}

/**
 * Resource collection for grouping related resources
 */
export interface ResourceCollection {
  id: string;                   // Collection ID
  name: string;                 // Collection name
  description?: string;         // Optional description
  resourceIds: string[];        // IDs of resources in this collection
  ownerDid: string;             // DID that owns this collection
  createdAt: string;            // ISO timestamp of creation
  updatedAt: string;            // ISO timestamp of last update
  metadata?: Record<string, any>; // Additional metadata
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
  linkedResource: EnhancedLinkedResource; // The created linked resource
  fees: {
    commitFee: number;         // Fee paid for commit transaction
    revealFee: number;         // Fee paid for reveal transaction
    totalFee: number;          // Total fees paid
  };
}

/**
 * Enhanced parameters for creating a resource
 */
export interface CreateResourceParams {
  wallet: WalletConfig;        // Wallet configuration
  metadata: ResourceMetadata;  // Resource metadata
  content: InscriptionContent; // Content to inscribe
  fees: FeeConfig;             // Fee configuration
  satNumber?: number;          // Optional specific sat number to use
  parentDid?: string;          // Parent DID to link this resource to
  resourceIndex?: number;      // Optional specific index for this resource
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
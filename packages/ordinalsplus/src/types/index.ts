export * from './did';
export * from './resource';
export * from './ordinals';
export * from './indexer';
// export * from './provider'; // Will be implemented later if needed

// Define supported Bitcoin networks
export type BitcoinNetwork = 'mainnet' | 'signet' | 'testnet';

// TODO: Consider adding 'regtest' if needed in the future

/**
 * Represents an ordinal inscription
 */
export interface Inscription {
    id: string;                 // Inscription ID (txid:vout)
    number?: number;            // Inscription number
    sat: number;                // Satoshi number
    sat_ordinal?: string;       // Ordinal representation of the sat
    content_type?: string;      // MIME type of the content
    content_url: string;        // URL to fetch the content
    timestamp?: number;         // Timestamp of when the inscription was created
    height?: number;            // Block height of the inscription
    metadata?: Uint8Array;      // CBOR encoded metadata
}

/**
 * Parsed components of a resource identifier from a DID URL
 * Format: did:btco:<satNumber>/resources/<index>
 */
export interface ParsedResourceId {
    did: string;                // The full DID
    satNumber: number;          // The sat number from the DID
    index?: number;             // Optional resource index
}

/**
 * Represents a resource linked to a DID
 * This is the basic interface used throughout the system
 */
export interface LinkedResource {
    id: string;                 // Resource ID (usually in format did:btco:<satNumber>/resources/<index>)
    type: string;               // Resource type (schema, image, document, etc.)
    inscriptionId: string;      // ID of the inscription containing this resource
    didReference: string;       // The DID this resource is linked to
    contentType: string;        // MIME type of the content
    content_url: string;        // URL to fetch the content
    sat: number;                // Satoshi number where this resource is inscribed
    inscriptionNumber?: number; // Inscription number (if available)
    size?: number;              // Size of the resource in bytes
    createdAt?: string;         // ISO timestamp of creation
    updatedAt?: string;         // ISO timestamp of last update
    metadata?: Record<string, any>; // Additional metadata for the resource
}

/**
 * Information about a resource, typically used in API responses
 */
export interface ResourceInfo {
    id: string;                 // Resource ID
    type: string;               // Resource type
    contentType: string;        // MIME type of the content
    createdAt: string;          // ISO timestamp of creation
    updatedAt: string;          // ISO timestamp of last update
    content_url: string;        // URL to fetch the content
    inscriptionId?: string;     // ID of the inscription containing this resource
    didReference?: string;      // The DID this resource is linked to
    sat?: number;               // Satoshi number where this resource is inscribed
    size?: number;              // Size of the resource in bytes
    name?: string;              // Optional name of the resource
    description?: string;       // Optional description of the resource
    index?: number;             // Index of this resource within the DID's resources
}

/**
 * Standard UTXO type definition used across the system
 */
export interface Utxo {
    txid: string;               // Transaction ID
    vout: number;               // Output index
    value: number;              // Amount in satoshis
    scriptPubKey?: string;      // Hex-encoded script public key
    status?: any;               // Optional status field from block explorer APIs
    script?: {                  // Script information including address
        type?: string;          // Script type
        address?: string;       // Associated address
    }
}

/**
 * Parameters for resource creation transaction
 */
export interface ResourceCreationParams {
    // Resource content information
    content: string | Buffer;   // The content to inscribe
    contentType: string;        // MIME type of the content
    resourceType: string;       // Type of resource (schema, image, document, etc.)
    
    // Wallet and transaction details
    publicKey: Buffer | Uint8Array; // Public key for transaction signing
    changeAddress: string;      // Address for change outputs
    recipientAddress: string;   // Address to receive the inscription
    utxos: Utxo[];              // UTXOs to use for funding
    feeRate: number;            // Fee rate in sats/vB
    network: BitcoinNetwork;    // Bitcoin network to use
    
    // Optional parameters
    metadata?: Record<string, any>; // Additional metadata for the resource
    parentDid?: string;         // Parent DID to link this resource to
    resourceIndex?: number;     // Optional specific index for this resource
    label?: string;             // Optional human-readable label
    description?: string;       // Optional description
}

/**
 * Result of resource creation transaction
 */
export interface ResourceCreationResult {
    commitPsbtBase64: string;   // Base64-encoded commit PSBT
    revealPsbtBase64: string;   // Base64-encoded reveal PSBT
    estimatedFees: number;      // Total estimated fees in satoshis
    resourceId?: string;        // ID of the created resource (if available)
    didUrl?: string;            // Full DID URL for the resource (if available)
}
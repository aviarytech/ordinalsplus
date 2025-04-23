export * from './did';
// Assuming ./resource.ts and ./provider.ts exist or will be created
// export * from './resource'; 
// export * from './provider';

// Define supported Bitcoin networks
export type BitcoinNetwork = 'mainnet' | 'signet';

// TODO: Consider adding 'testnet', 'regtest' if needed in the future

export interface Inscription {
    id: string;
    number?: number;
    sat: number;
    sat_ordinal?: string;
    content_type?: string;
    content_url: string;
    timestamp: string;
}

export interface ParsedResourceId {
    did: string;
    satNumber: number;
    index?: number;
}

export interface LinkedResource {
    id: string;
    type: string;
    inscriptionId: string;
    didReference: string;
    contentType: string;
    content_url: string;
    sat: number;
    inscriptionNumber?: number;
}

export interface ResourceInfo {
    id: string;
    type: string;
    contentType: string;
    createdAt: string;
    updatedAt: string;
    content_url: string;
    inscriptionId?: string;
    didReference?: string;
    sat?: number;
}

// Add a standard UTXO type definition
export interface Utxo {
    txid: string;
    vout: number;
    value: number; // Amount in satoshis
    scriptPubKey: string; // Hex-encoded script public key
    status?: any; // Optional status field from block explorer APIs
}
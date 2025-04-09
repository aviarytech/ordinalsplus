export * from './did';

export interface Inscription {
    id: string;
    number?: number;
    sat: number;
    sat_ordinal?: string;
    content_type?: string;
    content_url: string;
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
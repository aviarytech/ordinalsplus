export interface Inscription {
    id: string;
    number?: number;
    sat: number;
    sat_ordinal?: string;
    content_type?: string;
    content?: any;
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
    content: {
        value: any;
    };
    sat: number;
}

export interface ResourceInfo {
    id: string;
    type: string;
    contentType: string;
    createdAt: string;
    updatedAt: string;
} 
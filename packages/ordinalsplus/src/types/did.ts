export interface VerificationMethod {
    id: string;
    type: string;
    controller: string;
    publicKeyMultibase?: string;
}

export interface Service {
    id: string;
    type: string;
    serviceEndpoint: string | string[] | Record<string, unknown>;
}

export interface Resource {
    id: string;
    type: string;
    contentType: string;
    content: string;
    inscriptionId: string;
    sat: number;
}

export interface DidDocument {
    '@context': string | string[];
    id: string;
    controller?: string | string[];
    verificationMethod?: VerificationMethod[];
    authentication?: (string | { id: string; type: string })[];
    service?: Service[];
    deactivated?: boolean;
} 
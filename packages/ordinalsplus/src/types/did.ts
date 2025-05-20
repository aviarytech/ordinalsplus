export interface VerificationMethod {
    id: string;
    type: string;
    controller: string;
    publicKeyMultibase?: string;
    /** ISO timestamp when the key was revoked, if applicable */
    revoked?: string;
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

/** 
 * W3C DID Document 
 * Based on the W3C DID Core 1.0 specification 
 */
export interface DidDocument {
    '@context': string | string[];
    id: string;
    controller?: string | string[];
    verificationMethod?: VerificationMethod[];
    authentication?: (string | { id: string; type: string })[];
    /** Verification relationships for assertion capability */
    assertionMethod?: (string | { id: string; type: string })[];
    /** Verification relationships for key agreement capability */
    keyAgreement?: (string | { id: string; type: string })[];
    /** Verification relationships for invocation capability */
    capabilityInvocation?: (string | { id: string; type: string })[];
    /** Verification relationships for delegation capability */
    capabilityDelegation?: (string | { id: string; type: string })[];
    service?: Service[];
    /** Whether the DID document is deactivated (revoked) */
    deactivated?: boolean;
    /** ISO timestamp when the DID document was deactivated */
    deactivatedAt?: string;
    /** Additional properties that might be present in DID documents */
    [key: string]: any;
} 
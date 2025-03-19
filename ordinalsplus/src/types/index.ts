/**
 * Types for the BTCO DID Method
 */

export interface VerificationMethod {
  id: string;
  type: string;
  controller: string;
  publicKeyMultibase?: string;
  publicKeyJwk?: any;
}

export interface Service {
  id: string;
  type: string;
  serviceEndpoint: string | string[] | Record<string, any>;
}

export interface DidDocument {
  '@context': string | string[];
  id: string;
  controller?: string | string[];
  alsoKnownAs?: string[];
  verificationMethod?: VerificationMethod[];
  authentication?: (string | VerificationMethod)[];
  assertionMethod?: (string | VerificationMethod)[];
  keyAgreement?: (string | VerificationMethod)[];
  capabilityInvocation?: (string | VerificationMethod)[];
  capabilityDelegation?: (string | VerificationMethod)[];
  service?: Service[];
  deactivated?: boolean;
}

export interface DidResolutionResult {
  '@context'?: string | string[];
  didDocument: DidDocument | null;
  didResolutionMetadata: DidResolutionMetadata;
  didDocumentMetadata: DidDocumentMetadata;
}

export interface DidResolutionMetadata {
  contentType?: string;
  error?: string;
  message?: string;
}

export interface DidDocumentMetadata {
  created?: string;
  updated?: string;
  deactivated?: boolean;
  nextUpdate?: string;
  versionId?: string;
  nextVersionId?: string;
  equivalentId?: string[];
  canonicalId?: string;
}

/**
 * Types for the BTCO DID Linked Resources
 */

export interface ResourceInfo {
  resourceUri: string;
  resourceCollectionId: string;
  resourceId: string;
  resourceName: string;
  mediaType: string;
  created: string;
  resourceType: string;
  alsoKnownAs?: string[];
  previousVersionId?: string;
  nextVersionId?: string;
}

export interface ResourceContent {
  content: any;
  contentType: string;
}

export interface ResourceMetadata {
  [key: string]: any;
}

export interface ResourceCollectionPage {
  resources: string[];
  pagination: {
    next?: string;
    prev?: string;
    limit: number;
    total: number;
  };
}

export interface ResourceResolutionOptions {
  accept?: string;
  cacheControl?: string;
  ifNoneMatch?: string;
  ifModifiedSince?: string;
}

export interface ResourceError {
  error: string;
  message: string;
  details?: Record<string, any>;
}

/**
 * Types for BTCO Verifiable Metadata
 */

export interface VerifiableCredential {
  '@context': string[];
  type: string[];
  issuer: string | { id: string; [key: string]: any };
  validFrom?: string;
  validUntil?: string;
  credentialSubject: {
    id?: string;
    [key: string]: any;
  };
  proof?: {
    type: string;
    created: string;
    verificationMethod: string;
    proofPurpose: string;
    proofValue: string;
    [key: string]: any;
  };
}

export interface CuratedCollectionCredential extends VerifiableCredential {
  type: string[]; // Includes "CuratedCollectionCredential"
  credentialSubject: {
    id: string;
    type: "CuratedCollection";
    name?: string;
    description?: string;
    resources: string[];
    [key: string]: any;
  };
}

export interface InscriptionInfo {
  id: string;
  number: number;
  address: string;
  genesisAddress: string;
  genesisBlockHeight: number;
  genesisBlockHash: string;
  genesisTxid: string;
  genesisTimestamp: number;
  genesisLocation: string;
  contentType: string;
  contentLength: number;
  sat: string;
  satpoint: string;
  content: string;
  offset: number;
}

/**
 * Common utility types
 */

export type Fetch = typeof fetch;

export type BtcoDidString = `did:btco:${string}`;
export type ResourceIdString = `${BtcoDidString}/${string}`;

export interface ApiOptions {
  endpoint?: string;
  fetch?: Fetch;
  timeout?: number;
} 
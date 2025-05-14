/**
 * Verifiable Credential Types
 * 
 * This module defines TypeScript interfaces for W3C Verifiable Credentials
 * following the W3C VC Data Model 2.0 specification.
 * 
 * @see https://www.w3.org/TR/vc-data-model-2.0/
 */

/**
 * Base type for the credential context
 */
export type CredentialContext = string | Record<string, any> | Array<string | Record<string, any>>;

/**
 * Type of credential (string or array of strings)
 */
export type CredentialType = string | string[];

/**
 * Standard contexts for Verifiable Credentials
 */
export const VC_CONTEXTS = {
  CORE_V2: 'https://www.w3.org/ns/credentials/v2',
  ORDINALS_PLUS: 'https://ordinals.plus/v1'
};

/**
 * Standard types for Verifiable Credentials
 */
export const VC_TYPES = {
  VERIFIABLE_CREDENTIAL: 'VerifiableCredential',
  VERIFIABLE_COLLECTIBLE: 'VerifiableCollectible'
};

/**
 * Properties of the credential subject
 */
export interface CredentialSubject {
  /** DID of the subject */
  id: string;
  /** Type of the subject (e.g., 'Person', 'Collectible') */
  type?: string;
  /** Title of the credentialized item (for collectibles) */
  title?: string;
  /** Description of the credentialized item */
  description?: string;
  /** Creator of the item (DID or name) */
  creator?: string;
  /** Date of creation (ISO string) */
  creationDate?: string;
  /** Technical and physical properties of the item */
  properties?: {
    /** Content medium (e.g., 'Digital', 'Physical') */
    medium?: string;
    /** Content format (MIME type) */
    format?: string;
    /** Content dimensions */
    dimensions?: string | { width: number; height: number };
    /** Hash of the content */
    contentHash?: string;
    /** Additional properties */
    [key: string]: any;
  };
  /** Additional properties of the subject */
  [key: string]: any;
}

/**
 * Identifier for the credential issuer
 */
export interface Issuer {
  /** DID of the issuer */
  id: string;
  /** Optional additional properties of the issuer */
  [key: string]: any;
}

/**
 * Information about the cryptographic proof
 */
export interface CredentialProof {
  /** Type of proof (e.g., 'DataIntegrityProof', 'JWT') */
  type: string;
  /** ISO timestamp when the proof was created */
  created: string;
  /** Purpose of the proof (e.g., 'assertionMethod') */
  proofPurpose: string;
  /** Verification method (typically a DID URL) */
  verificationMethod: string;
  /** Value of the proof (e.g., JWS or signature value) */
  proofValue?: string;
  /** Domain for preventing replay attacks */
  domain?: string;
  /** Challenge for preventing replay attacks */
  challenge?: string;
  /** Additional proof properties */
  [key: string]: any;
}

/**
 * Type of proof used for the credential
 */
export enum ProofType {
  DATA_INTEGRITY = 'DataIntegrityProof',
  JWT = 'JwtProof',
  BBS = 'BbsProof'
}

/**
 * Main Verifiable Credential interface
 */
export interface VerifiableCredential {
  /** JSON-LD context */
  '@context': CredentialContext;
  /** Credential identifier (URI) */
  id?: string;
  /** Credential types */
  type: CredentialType;
  /** Credential issuer */
  issuer: Issuer;
  /** Date of issuance (ISO string) */
  issuanceDate: string;
  /** Date of expiration (ISO string) */
  expirationDate?: string;
  /** Credential subject (the entity the claims are about) */
  credentialSubject: CredentialSubject | CredentialSubject[];
  /** Cryptographic proof */
  proof?: CredentialProof | CredentialProof[];
  /** Credential status information */
  credentialStatus?: {
    /** ID of the status information */
    id: string;
    /** Type of the status (e.g., 'RevocationList2020Status') */
    type: string;
    /** Additional status properties */
    [key: string]: any;
  };
  /** Additional properties */
  [key: string]: any;
}

/**
 * Content information for credentials
 */
export interface ContentInfo {
  /** MIME type of the content */
  mimeType: string;
  /** Dimensions, if applicable */
  dimensions?: string | { width: number; height: number };
  /** Content hash */
  hash?: string;
  /** File size in bytes */
  size?: number;
}

/**
 * Parameters for issuing a credential
 */
export interface CredentialIssuanceParams {
  /** DID of the subject */
  subjectDid: string;
  /** DID of the issuer */
  issuerDid: string;
  /** Metadata for the credential */
  metadata: {
    /** Title of the item */
    title: string;
    /** Description of the item */
    description: string;
    /** Creator of the item */
    creator?: string;
    /** Creation date (ISO string) */
    creationDate?: string;
    /** Additional attributes */
    attributes?: Record<string, any>;
    /** Inscription ID associated with this credential */
    inscriptionId?: string;
  };
  /** Content information */
  contentInfo: ContentInfo;
}

/**
 * Response from the Aces API
 */
export interface AcesApiResponse {
  /** Status of the request */
  status: 'success' | 'error';
  /** Response data */
  data?: any;
  /** Error information */
  error?: {
    /** Error code */
    code: string;
    /** Error message */
    message: string;
    /** Additional error details */
    details?: any;
  };
} 
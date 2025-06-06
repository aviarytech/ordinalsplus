/**
 * Verifiable Credential Types
 * 
 * This module defines TypeScript interfaces for W3C Verifiable Credentials
 * following the W3C VC Data Model 2.0 specification.
 * 
 * @see https://www.w3.org/TR/vc-data-model-2.0/
 */

import { InscriptionMetadata } from '../inscription/content/mime-handling';

/**
 * Base type for the credential context
 */
export type CredentialContext = string | Record<string, any> | Array<string | Record<string, any>>;

/**
 * Base type for credential types
 */
export type CredentialType = string | string[];

/**
 * Standard proof types supported by Aces VC API
 */
export enum ProofType {
  JWT = 'jwt',
  DATA_INTEGRITY = 'DataIntegrityProof',
  LD_PROOF = 'LDProof',
}

/**
 * Technical details about the content being credentialized
 */
export interface ContentInfo {
  /** MIME type of the content */
  mimeType: string;
  /** Hash of the content (typically SHA-256) */
  hash: string;
  /** Content dimensions (for media like images or video) */
  dimensions?: {
    width: number;
    height: number;
  };
  /** File size in bytes */
  size?: number;
  /** Duration for time-based media (in seconds) */
  duration?: number;
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
 * Properties of the credential subject
 * Represents the entity about which claims are made
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
    /** Content format */
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
 * Main Verifiable Credential interface
 * Following W3C VC Data Model 2.0
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
 * Parameters for credential issuance
 */
export interface CredentialIssuanceParams {
  /** DID of the subject */
  subjectDid: string;
  /** DID of the issuer */
  issuerDid: string;
  /** Metadata from the inscription */
  metadata: InscriptionMetadata;
  /** Pre-computed technical information about the content */
  contentInfo?: ContentInfo;
  /** Raw content bytes (alternative to contentInfo) */
  content?: Uint8Array;
  /** MIME type of the content (required if content is provided) */
  contentType?: string;
}

/**
 * Response from the Aces VC API
 */
export interface AcesApiResponse {
  /** The issued credential */
  credential: VerifiableCredential;
  /** Status of the issuance request */
  status: 'success' | 'error';
  /** Error message (if status is 'error') */
  message?: string;
} 
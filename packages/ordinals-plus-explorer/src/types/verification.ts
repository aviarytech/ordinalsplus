/**
 * Verification Types
 * 
 * This module defines TypeScript interfaces for verification results and services
 * used in the Ordinals Plus Explorer.
 */

/**
 * Interface for a Verifiable Credential
 */
export interface VerifiableCredential {
  /** JSON-LD context */
  '@context': string | string[] | Record<string, any>;
  /** Credential identifier (URI) */
  id?: string;
  /** Credential types */
  type: string | string[];
  /** Credential issuer */
  issuer: string | { id: string; [key: string]: any };
  /** Date of issuance (ISO string) */
  issuanceDate: string;
  /** Date of expiration (ISO string) */
  expirationDate?: string;
  /** Credential subject (the entity the claims are about) */
  credentialSubject: {
    id: string;
    [key: string]: any;
  } | Array<{ id: string; [key: string]: any }>;
  /** Cryptographic proof */
  proof?: {
    type: string;
    created: string;
    proofPurpose: string;
    verificationMethod: string;
    proofValue?: string;
    [key: string]: any;
  } | Array<{
    type: string;
    created: string;
    proofPurpose: string;
    verificationMethod: string;
    proofValue?: string;
    [key: string]: any;
  }>;
  /** Additional properties */
  [key: string]: any;
}

/**
 * Possible verification status values
 */
export enum VerificationStatus {
  VALID = 'valid',
  INVALID = 'invalid',
  NO_METADATA = 'noMetadata',
  ERROR = 'error',
  LOADING = 'loading'
}

/**
 * Information about the issuer of a credential
 */
export interface IssuerInfo {
  /** DID of the issuer */
  did: string;
  /** Name of the issuer, if available */
  name?: string;
  /** URL of the issuer, if available */
  url?: string;
  /** Avatar/logo of the issuer, if available */
  avatar?: string;
  /** The resolved DID document, if available */
  didDocument?: any;
}

/**
 * Result of a verification operation
 */
export interface VerificationResult {
  /** Status of the verification */
  status: VerificationStatus;
  /** Message explaining the verification result */
  message?: string;
  /** The verified credential, if available */
  credential?: VerifiableCredential;
  /** Information about the issuer, if available */
  issuer?: IssuerInfo;
  /** Timestamp when the verification was performed */
  verifiedAt?: Date;
  /** Error details if verification failed */
  error?: Error;
}

/**
 * Interface for verification service
 */
export interface IVerificationService {
  /**
   * Verify an inscription by its ID
   * 
   * @param inscriptionId - The ID of the inscription to verify
   * @param existingInscriptionData - The existing inscription data to verify (required to avoid refetching)
   * @param network - Optional network override
   * @returns Promise resolving to verification result
   */
  verifyInscription(
    inscriptionId: string,
    existingInscriptionData: {
      contentBase64?: string;
      contentType?: string;
      metadata?: any;
    },
    network?: 'mainnet' | 'testnet' | 'signet'
  ): Promise<VerificationResult>;
  
  /**
   * Verify a credential directly
   * 
   * @param credential - The credential to verify
   * @returns Promise resolving to verification result
   */
  verifyCredential(credential: VerifiableCredential): Promise<VerificationResult>;
  
  /**
   * Get issuer information for a DID
   * 
   * @param did - The DID to get information for
   * @returns Promise resolving to issuer information
   */
  getIssuerInfo(did: string): Promise<IssuerInfo>;
  
  /**
   * Clear the verification cache
   */
  clearCache(): void;
}

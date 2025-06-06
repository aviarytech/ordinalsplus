/**
 * Verification Types
 * 
 * This module defines TypeScript interfaces for verification results and services
 * used in the Ordinals Plus API.
 */

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
  credential?: any;
  /** Information about the issuer, if available */
  issuer?: IssuerInfo;
  /** Timestamp when the verification was performed */
  verifiedAt?: Date;
  /** Error details if verification failed */
  error?: Error;
  /** The inscription ID if verifying an inscription */
  inscriptionId?: string;
}

/**
 * Verification check result
 */
export interface VerificationCheck {
  /** Unique identifier for the check */
  id: string;
  /** Display name of the check */
  name: string;
  /** Category of the check */
  category: string;
  /** Whether the check passed */
  passed: boolean;
  /** Explanation of the check result */
  explanation: string;
  /** Technical details (optional) */
  details?: string;
}

/**
 * API response format for verification endpoints
 */
export interface VerificationResponse {
  /** Status of the verification */
  status: string;
  /** Message explaining the verification result */
  message: string;
  /** Detailed verification information */
  details: {
    /** The inscription ID if verifying an inscription */
    inscriptionId?: string;
    /** Information about the issuer, if available */
    issuer?: IssuerInfo;
    /** Timestamp when the verification was performed */
    verifiedAt: string;
    /** List of verification checks performed */
    checks: VerificationCheck[];
  };
  /** The verified credential, if available */
  credential?: any;
}

/**
 * API response format for issuer endpoints
 */
export interface IssuerResponse {
  /** Status of the operation */
  status: string;
  /** Issuer information */
  issuer: IssuerInfo;
}

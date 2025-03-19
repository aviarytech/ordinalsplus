import { DID } from '../types';

/**
 * Extracts verifiable metadata from a DID document
 * This is a simple implementation that detects common verifiable metadata patterns
 */
export const extractVerifiableMetadata = (did: DID): Record<string, unknown> => {
  const metadata: Record<string, unknown> = {};
  
  // Look for verification methods
  if (Array.isArray(did.content.verificationMethod)) {
    metadata.verificationMethod = did.content.verificationMethod;
  }
  
  // Look for authentication methods
  if (Array.isArray(did.content.authentication)) {
    metadata.authentication = did.content.authentication;
  }
  
  // Look for services
  if (Array.isArray(did.content.service)) {
    metadata.service = did.content.service;
  }
  
  // Look for controllers
  if (did.content.controller) {
    metadata.controller = did.content.controller;
  }
  
  // Look for assertionMethod
  if (Array.isArray(did.content.assertionMethod)) {
    metadata.assertionMethod = did.content.assertionMethod;
  }
  
  // Look for proofs if they exist
  if (did.content.proof) {
    metadata.proof = did.content.proof;
  }
  
  return metadata;
};

/**
 * Checks if a DID document has verifiable metadata
 */
export const hasVerifiableMetadata = (did: DID): boolean => {
  const metadata = extractVerifiableMetadata(did);
  return Object.keys(metadata).length > 0;
};

/**
 * Interface for verification method objects in DID documents
 */
interface VerificationMethod {
  id: string;
  type: string;
  controller: string;
  publicKeyMultibase?: string;
  publicKeyJwk?: Record<string, unknown>;
  blockchainAccountId?: string;
  [key: string]: unknown;
}

/**
 * Validates basic structure of the DID document according to DID Core spec
 * This is a minimal implementation
 */
export const validateDidDocument = (did: DID): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  // Check if the DID document has an ID
  if (!did.content.id) {
    errors.push('DID document is missing required "id" property');
  } else if (did.content.id !== did.id) {
    errors.push('DID document "id" does not match the DID');
  }
  
  // Check verification method format if present
  if (Array.isArray(did.content.verificationMethod)) {
    did.content.verificationMethod.forEach((vm: VerificationMethod, index: number) => {
      if (!vm.id) {
        errors.push(`Verification method at index ${index} is missing required "id" property`);
      }
      
      if (!vm.type) {
        errors.push(`Verification method at index ${index} is missing required "type" property`);
      }
      
      if (!vm.controller) {
        errors.push(`Verification method at index ${index} is missing required "controller" property`);
      }
    });
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

import { DidDocument, VerificationMethod, Service } from '../types/did';
import { BitcoinNetwork } from '../types';
import { generateEd25519KeyPair, publicKeyToMultibase } from '../utils/keyUtils';
import { getDidPrefix } from './did-utils';

/**
 * Interface for a DID Document with associated key material
 */
export interface DidDocumentWithKeys {
  document: DidDocument;
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

/**
 * Options for creating a DID Document
 */
export interface CreateDidDocumentOptions {
  controller?: string;
  services?: Service[];
  deactivated?: boolean;
}

/**
 * Creates a new DID Document for a Bitcoin Ordinals (BTCO) DID
 * 
 * @param satNumber - The satoshi number to use in the DID
 * @param network - The Bitcoin network ('mainnet', 'testnet', 'signet')
 * @param options - Optional settings for the DID Document
 * @returns A DID Document with its associated key material
 */
export function createDidDocument(
  satNumber: number | string, 
  network: BitcoinNetwork = 'mainnet',
  options: CreateDidDocumentOptions = {}
): DidDocumentWithKeys {
  // Generate a key pair for the DID
  const keyPair = generateEd25519KeyPair();
  
  // Create the DID using the network-specific prefix
  const didPrefix = getDidPrefix(network);
  const did = `${didPrefix}:${satNumber}`;
  
  // Create the verification method entry
  const verificationMethod: VerificationMethod = {
    id: `${did}#key-1`,
    type: 'Ed25519VerificationKey2020',
    controller: options.controller || did,
    publicKeyMultibase: publicKeyToMultibase(keyPair.publicKey)
  };
  
  // Create the DID Document
  const document: DidDocument = {
    '@context': [
      'https://www.w3.org/ns/did/v1',
      'https://w3id.org/security/suites/ed25519-2020/v1'
    ],
    id: did,
    verificationMethod: [verificationMethod],
    authentication: [`${did}#key-1`]
  };
  
  // Add optional fields if provided
  if (options.controller) {
    document.controller = options.controller;
  }
  
  if (options.services && options.services.length > 0) {
    document.service = options.services;
  }
  
  if (options.deactivated) {
    document.deactivated = true;
  }
  
  return {
    document,
    publicKey: keyPair.publicKey,
    secretKey: keyPair.secretKey
  };
}

/**
 * Validates a DID Document against W3C standards
 * 
 * @param document - The DID Document to validate
 * @returns An object with validation result and any error messages
 */
export function validateDidDocument(document: DidDocument): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check required fields
  if (!document['@context']) {
    errors.push('Missing required field: @context');
  } else if (!Array.isArray(document['@context']) && typeof document['@context'] !== 'string') {
    errors.push('@context must be a string or array of strings');
  }
  
  if (!document.id) {
    errors.push('Missing required field: id');
  } else if (typeof document.id !== 'string') {
    errors.push('id must be a string');
  }
  
  // Verify verification methods if present
  if (document.verificationMethod) {
    if (!Array.isArray(document.verificationMethod)) {
      errors.push('verificationMethod must be an array');
    } else {
      document.verificationMethod.forEach((vm, index) => {
        if (!vm.id) errors.push(`verificationMethod[${index}] is missing id`);
        if (!vm.type) errors.push(`verificationMethod[${index}] is missing type`);
        if (!vm.controller) errors.push(`verificationMethod[${index}] is missing controller`);
        
        // Ensure at least one key representation is present
        if (!vm.publicKeyMultibase) {
          errors.push(`verificationMethod[${index}] is missing publicKeyMultibase`);
        }
      });
    }
  }
  
  // Verify authentication if present
  if (document.authentication) {
    if (!Array.isArray(document.authentication)) {
      errors.push('authentication must be an array');
    } else {
      document.authentication.forEach((auth, index) => {
        if (typeof auth !== 'string' && typeof auth !== 'object') {
          errors.push(`authentication[${index}] must be a string or object`);
        }
      });
    }
  }
  
  // Verify services if present
  if (document.service) {
    if (!Array.isArray(document.service)) {
      errors.push('service must be an array');
    } else {
      document.service.forEach((svc, index) => {
        if (!svc.id) errors.push(`service[${index}] is missing id`);
        if (!svc.type) errors.push(`service[${index}] is missing type`);
        if (!svc.serviceEndpoint) errors.push(`service[${index}] is missing serviceEndpoint`);
      });
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Serializes a DID Document to JSON
 * 
 * @param document - The DID Document to serialize
 * @returns A JSON string representing the DID Document
 */
export function serializeDidDocument(document: DidDocument): string {
  return JSON.stringify(document, null, 2);
}

/**
 * Deserializes a JSON string to a DID Document
 * 
 * @param json - The JSON string to deserialize
 * @returns A DID Document object or null if invalid
 */
export function deserializeDidDocument(json: string): DidDocument | null {
  try {
    const document = JSON.parse(json) as DidDocument;
    const validation = validateDidDocument(document);
    return validation.isValid ? document : null;
  } catch (error) {
    return null;
  }
} 
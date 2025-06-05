import { DidDocument, VerificationMethod, Service } from '../types/did';
import { BitcoinNetwork } from '../types';
import { generateEd25519KeyPair } from '../utils/keyUtils';
import { getDidPrefix } from './did-utils';
import { KeyPair } from '../key-management/key-pair-generator';
import { logDidDocumentCreation, logDidDocumentUpdate, AuditSeverity, logSecurityEvent } from '../utils/audit-logger';
import { MULTICODEC_ED25519_PUB_HEADER, multikey } from '../utils/encoding';

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
  /** Whether to add tamper protection */
  tamperProtection?: boolean;
  /** Actor identifier for audit logging */
  actor?: string;
}

/**
 * Options for adding a key to a DID Document
 */
export interface AddKeyOptions {
  /**
   * The ID suffix for the verification method (e.g., "key-2")
   * If not provided, an ID will be generated
   */
  id?: string;
  
  /**
   * The relationship the key will have with the DID
   * If not provided, the key will only be added as a verification method
   */
  relationships?: ('authentication' | 'assertionMethod' | 'keyAgreement' | 'capabilityInvocation' | 'capabilityDelegation')[];
  
  /**
   * The controller of the key, defaults to the DID itself
   */
  controller?: string;
  
  /**
   * The type of the verification method, defaults based on key type
   */
  type?: string;
  /** Actor identifier for audit logging */
  actor?: string;
}

/**
 * Options for rotating a key in a DID Document
 */
export interface RotateKeyOptions {
  /**
   * Whether to mark the old key as revoked instead of removing it
   */
  markAsRevoked?: boolean;
  
  /**
   * Whether to preserve relationships for the old key
   * If false (default), all relationships will be transferred to the new key
   */
  preserveOldKeyRelationships?: boolean;
  id?: string;
  type?: string;
  controller?: string;
  /** Actor identifier for audit logging */
  actor?: string;
}

/**
 * Creates a new DID Document for a Bitcoin Ordinals (BTCO) DID
 * 
 * @param satNumber - The satoshi number to use in the DID
 * @param network - The Bitcoin network ('mainnet', 'testnet', 'signet')
 * @param options - Optional settings for the DID Document
 * @returns A DID Document with its associated key material
 */
export async function createDidDocument(
  satNumber: number | string, 
  network: BitcoinNetwork = 'mainnet',
  options: CreateDidDocumentOptions = {}
): Promise<DidDocumentWithKeys> {
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
    publicKeyMultibase: multikey.encode(MULTICODEC_ED25519_PUB_HEADER, keyPair.publicKey)
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

  let finalDocument = document;
  
  // Log the document creation
  await logDidDocumentCreation(did, options.actor, {
    network,
    hasServices: Boolean(options.services?.length),
    verificationMethodCount: 1,
    hasTamperProtection: options.tamperProtection
  });
  
  return {
    document: finalDocument,
    publicKey: keyPair.publicKey,
    secretKey: keyPair.secretKey
  };
}

/**
 * Adds a key to an existing DID Document
 * 
 * @param document - The DID Document to update
 * @param keyPair - The key pair to add
 * @param options - Options for the key addition
 * @returns The updated DID Document
 */
export async function addKeyToDidDocument(
  document: DidDocument,
  keyPair: KeyPair,
  options: AddKeyOptions = {}
): Promise<DidDocument> {
  if (document.deactivated) {
    throw new Error('Cannot add key to a deactivated DID Document');
  }

  // Create a shallow copy of the document to avoid mutations
  const updatedDocument = { ...document };
  
  // Ensure verificationMethod array exists
  if (!updatedDocument.verificationMethod) {
    updatedDocument.verificationMethod = [];
  }
  
  // Generate a key ID if not provided
  const keyIdSuffix = options.id || `key-${updatedDocument.verificationMethod.length + 1}`;
  const keyId = `${updatedDocument.id}#${keyIdSuffix}`;
  
  // Determine the verification method type based on key type
  let keyType: string;
  switch (keyPair.type) {
    case 'Ed25519':
      keyType = options.type || 'Ed25519VerificationKey2020';
      break;
    case 'secp256k1':
      keyType = options.type || 'EcdsaSecp256k1VerificationKey2019';
      break;
    case 'schnorr':
      keyType = options.type || 'SchnorrSecp256k1VerificationKey2019';
      break;
    default:
      throw new Error(`Unsupported key type: ${keyPair.type}`);
  }
  
  // Create the verification method
  const verificationMethod: VerificationMethod = {
    id: keyId,
    type: keyType,
    controller: options.controller || updatedDocument.id,
    publicKeyMultibase: multikey.encode(MULTICODEC_ED25519_PUB_HEADER, keyPair.publicKey)
  };
  
  // Add the verification method to the document
  updatedDocument.verificationMethod.push(verificationMethod);
  
  // Add to verification relationships if requested
  if (options.relationships && options.relationships.length > 0) {
    for (const relationship of options.relationships) {
      if (!updatedDocument[relationship]) {
        updatedDocument[relationship] = [];
      }
      
      (updatedDocument[relationship] as string[]).push(keyId);
    }
  }
  
  // Log the key addition to the audit log
  await logDidDocumentUpdate(document.id, options.actor, {
    action: 'key_added',
    keyId,
    keyType: keyPair.type,
    purposes: options.relationships || []
  });
  
  return updatedDocument;
}

/**
 * Rotates a key in a DID Document, replacing an old key with a new one
 * 
 * @param document - The DID Document to update
 * @param oldKeyId - The ID of the key to replace
 * @param newKeyPair - The new key pair to use
 * @param options - Options for the key rotation
 * @returns The updated DID Document
 */
export async function rotateKeyInDidDocument(
  document: DidDocument,
  oldKeyId: string,
  newKeyPair: KeyPair,
  options: RotateKeyOptions = {}
): Promise<DidDocument> {
  if (document.deactivated) {
    throw new Error('Cannot rotate keys in a deactivated DID Document');
  }
  
  // Create a shallow copy of the document to avoid mutations
  const updatedDocument = { ...document };
  
  // Verify that the old key exists
  if (!updatedDocument.verificationMethod || 
      !updatedDocument.verificationMethod.some(vm => vm.id === oldKeyId)) {
    throw new Error(`Key not found: ${oldKeyId}`);
  }
  
  // Find the old verification method
  const oldVerificationMethodIndex = updatedDocument.verificationMethod.findIndex(vm => vm.id === oldKeyId);
  const oldVerificationMethod = updatedDocument.verificationMethod[oldVerificationMethodIndex];
  
  // Generate a key ID for the new key if not provided
  const keyIdSuffix = options.id || `key-${Date.now()}`;
  const newKeyId = `${updatedDocument.id}#${keyIdSuffix}`;
  
  // Determine the verification method type based on key type
  let keyType: string;
  switch (newKeyPair.type) {
    case 'Ed25519':
      keyType = options.type || 'Ed25519VerificationKey2020';
      break;
    case 'secp256k1':
      keyType = options.type || 'EcdsaSecp256k1VerificationKey2019';
      break;
    case 'schnorr':
      keyType = options.type || 'SchnorrSecp256k1VerificationKey2019';
      break;
    default:
      throw new Error(`Unsupported key type: ${newKeyPair.type}`);
  }
  
  // Create the new verification method
  const newVerificationMethod: VerificationMethod = {
    id: newKeyId,
    type: keyType,
    controller: options.controller || oldVerificationMethod.controller,
    publicKeyMultibase: multikey.encode(MULTICODEC_ED25519_PUB_HEADER, newKeyPair.publicKey)
  };
  
  // If we're marking the old key as revoked, update it
  if (options.markAsRevoked) {
    updatedDocument.verificationMethod[oldVerificationMethodIndex] = {
      ...oldVerificationMethod,
      revoked: new Date().toISOString()
    };
    
    // Add the new verification method
    updatedDocument.verificationMethod.push(newVerificationMethod);
  } else {
    // Replace the old verification method with the new one
    updatedDocument.verificationMethod[oldVerificationMethodIndex] = newVerificationMethod;
  }
  
  // Find all relationships that reference the old key
  const relationships = [
    'authentication',
    'assertionMethod',
    'keyAgreement',
    'capabilityInvocation',
    'capabilityDelegation'
  ];
  
  // Update references to the key in all relationships
  for (const rel of relationships) {
    if (updatedDocument[rel]) {
      const relArray = updatedDocument[rel] as (string | { id: string, type: string })[];
      
      for (let i = 0; i < relArray.length; i++) {
        const item = relArray[i];
        
        if (typeof item === 'string' && item === oldKeyId) {
          // Update string reference
          relArray[i] = newKeyId;
        } else if (typeof item === 'object' && item.id === oldKeyId) {
          // Update embedded reference
          relArray[i] = {
            ...item,
            id: newKeyId,
            type: keyType
          };
        }
      }
    }
  }
  
  // Log the key rotation to the audit log
  await logDidDocumentUpdate(document.id, options.actor, {
    action: 'key_rotated',
    oldKeyId,
    newKeyId,
    keyType: newKeyPair.type,
    revoked: options.markAsRevoked
  });
  
  return updatedDocument;
}

/**
 * Revokes a key in a DID Document without replacing it
 * 
 * @param document - The DID Document to update
 * @param keyId - The ID of the key to revoke
 * @returns The updated DID Document
 */
export function revokeKeyInDidDocument(
  document: DidDocument,
  keyId: string
): DidDocument {
  if (document.deactivated) {
    throw new Error('Cannot revoke keys in a deactivated DID Document');
  }
  
  // Create a shallow copy of the document to avoid mutations
  const updatedDocument = { ...document };
  
  // Verify that the key exists
  if (!updatedDocument.verificationMethod || 
      !updatedDocument.verificationMethod.some(vm => vm.id === keyId)) {
    throw new Error(`Key not found: ${keyId}`);
  }
  
  // Find the verification method to revoke
  const verificationMethodIndex = updatedDocument.verificationMethod.findIndex(vm => vm.id === keyId);
  
  // Mark the key as revoked
  updatedDocument.verificationMethod[verificationMethodIndex] = {
    ...updatedDocument.verificationMethod[verificationMethodIndex],
    revoked: new Date().toISOString()
  };
  
  // Remove the key from all relationship arrays
  const relationships = [
    'authentication',
    'assertionMethod',
    'keyAgreement',
    'capabilityInvocation',
    'capabilityDelegation'
  ];
  
  for (const relationship of relationships) {
    if (updatedDocument[relationship] && Array.isArray(updatedDocument[relationship])) {
      updatedDocument[relationship] = updatedDocument[relationship].filter(ref => {
        return ref !== keyId && (typeof ref !== 'object' || ref.id !== keyId);
      });
    }
  }
  
  return updatedDocument;
}

/**
 * Deactivates a DID Document, marking it as revoked
 * 
 * @param document - The DID Document to deactivate
 * @returns The deactivated DID Document
 */
export function deactivateDidDocument(document: DidDocument): DidDocument {
  // Create a shallow copy of the document to avoid mutations
  const updatedDocument = { ...document };
  
  // Mark the document as deactivated
  updatedDocument.deactivated = true;
  
  // Add deactivation timestamp
  updatedDocument.deactivatedAt = new Date().toISOString();
  
  return updatedDocument;
}

/**
 * Validates a DID Document against W3C standards and checks for security issues
 * 
 * @param document - The DID Document to validate
 * @param actor - Optional actor identifier for audit logging
 * @returns An object with validation result and any error messages
 */
export async function validateDidDocument(
  document: DidDocument,
  actor?: string
): Promise<{ isValid: boolean; errors: string[] }> {
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
  
  return { isValid: errors.length === 0, errors };
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
 * @param actor - Optional actor identifier for audit logging
 * @returns A DID Document object or null if invalid
 */
export async function deserializeDidDocument(
  json: string,
  actor?: string
): Promise<DidDocument | null> {
  try {
    const document = JSON.parse(json) as DidDocument;
    const validation = await validateDidDocument(document, actor);
    
    if (!validation.isValid) {
      // Log validation failure
      await logSecurityEvent(
        'deserialization_validation_failed',
        AuditSeverity.WARNING,
        document.id || 'unknown',
        actor,
        { errors: validation.errors }
      );
      return null;
    }
    
    return document;
  } catch (error) {
    // Log deserialization failure
    await logSecurityEvent(
      'deserialization_failed',
      AuditSeverity.ERROR,
      'unknown',
      actor,
      { error: error instanceof Error ? error.message : String(error) }
    );
    return null;
  }
} 
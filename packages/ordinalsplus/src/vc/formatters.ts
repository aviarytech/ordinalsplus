/**
 * Verifiable Credential Formatters
 * 
 * This module provides utilities for preparing and formatting Verifiable
 * Credentials according to the W3C VC Data Model 2.0 specification.
 * 
 * @see https://www.w3.org/TR/vc-data-model-2.0/
 */

import { 
  VerifiableCredential, 
  CredentialSubject, 
  ContentInfo, 
  CredentialContext, 
  CredentialIssuanceParams 
} from './types';
import { InscriptionMetadata } from '../inscription/content/mime-handling';

/**
 * Standard contexts for Verifiable Credentials
 */
export const VC_CONTEXTS = {
  CORE_V2: 'https://www.w3.org/ns/credentials/v2',
  ORDINALS_PLUS: 'https://ordinals.plus/v1',
  JSON_SCHEMA_V2: 'https://www.w3.org/ns/credentials/examples/json-schema-v2',
};

/**
 * Standard credential types
 */
export const VC_TYPES = {
  VERIFIABLE_CREDENTIAL: 'VerifiableCredential',
  VERIFIABLE_COLLECTIBLE: 'VerifiableCollectible',
};

/**
 * Standard subject types
 */
export const SUBJECT_TYPES = {
  COLLECTIBLE: 'Collectible',
  INSCRIPTION: 'Inscription',
};

/**
 * Extract dimension information from content if available
 * 
 * @param contentType - MIME type of the content
 * @param content - The binary content
 * @returns Dimension information or undefined
 */
export function extractDimensions(contentType: string, content?: Uint8Array): { width: number; height: number } | undefined {
  // Implementation would analyze image/video headers to extract dimensions
  // This is a simplified placeholder
  
  if (!content || content.length === 0) {
    return undefined;
  }
  
  // For images, we would parse headers to get actual dimensions
  // For this implementation, we're returning placeholder dimensions
  if (contentType.startsWith('image/')) {
    return {
      width: 800,
      height: 600
    };
  }
  
  return undefined;
}

/**
 * Calculate hash of content using Web Crypto API
 * 
 * @param content - The binary content to hash
 * @param algorithm - Hash algorithm to use (default: SHA-256)
 * @returns Hex-encoded hash string
 */
export async function calculateContentHash(content: Uint8Array, algorithm = 'SHA-256'): Promise<string> {
  const hashBuffer = await crypto.subtle.digest(algorithm, content);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Extract technical content information
 * 
 * @param content - The binary content
 * @param contentType - MIME type of the content
 * @returns ContentInfo object
 */
export async function extractContentInfo(content: Uint8Array, contentType: string): Promise<ContentInfo> {
  const contentInfo: ContentInfo = {
    mimeType: contentType,
    hash: await calculateContentHash(content),
    size: content.length,
  };
  
  // Add dimensions for media types
  const dimensions = extractDimensions(contentType, content);
  if (dimensions) {
    contentInfo.dimensions = dimensions;
  }
  
  // Add duration for time-based media (would require actual media parsing)
  if (contentType.startsWith('audio/') || contentType.startsWith('video/')) {
    // Placeholder - would actually analyze media headers
    contentInfo.duration = 0;
  }
  
  return contentInfo;
}

/**
 * Format metadata into credential subject properties
 * 
 * @param metadata - Inscription metadata
 * @returns Formatted properties
 */
export function formatSubjectProperties(metadata: InscriptionMetadata): Record<string, any> {
  const properties: Record<string, any> = {
    medium: 'Digital',
  };
  
  // Map known metadata fields
  if (metadata.format) properties.format = metadata.format;
  if (metadata.dimensions) properties.dimensions = metadata.dimensions;
  if (metadata.contentHash) properties.contentHash = metadata.contentHash;
  
  // Add any additional metadata as properties
  for (const [key, value] of Object.entries(metadata)) {
    // Skip fields already handled or that are standard subject fields
    if (['format', 'dimensions', 'contentHash', 'title', 'description', 'creator', 'creationDate'].includes(key)) {
      continue;
    }
    
    properties[key] = value;
  }
  
  return properties;
}

/**
 * Prepare a credential subject from inscription metadata and content info
 * 
 * @param subjectDid - DID of the subject
 * @param metadata - Inscription metadata
 * @param contentInfo - Technical content information
 * @returns Formatted credential subject
 */
export function prepareCredentialSubject(
  subjectDid: string,
  metadata: InscriptionMetadata,
  contentInfo: ContentInfo,
  issuerDid?: string
): CredentialSubject {
  // Create base subject
  const subject: CredentialSubject = {
    id: subjectDid,
    type: SUBJECT_TYPES.COLLECTIBLE,
  };
  
  // Add standard metadata fields
  if (metadata.title) subject.title = metadata.title;
  if (metadata.description) subject.description = metadata.description;
  
  // Default creator to issuer if not specified
  subject.creator = metadata.creator || issuerDid || '';
  
  // Default creation date to today if not specified
  subject.creationDate = metadata.creationDate || new Date().toISOString().split('T')[0];
  
  // Add properties including content info
  subject.properties = {
    ...formatSubjectProperties(metadata),
    format: contentInfo.mimeType,
    contentHash: contentInfo.hash,
  };
  
  // Add content dimensions if available
  if (contentInfo.dimensions) {
    subject.properties.dimensions = contentInfo.dimensions;
  }
  
  return subject;
}

/**
 * Prepare a complete verifiable credential from inscription data
 * 
 * @param params - Parameters for credential issuance
 * @returns Formatted verifiable credential ready for signing
 */
export async function prepareCredential(params: CredentialIssuanceParams): Promise<VerifiableCredential> {
  const { subjectDid, issuerDid, metadata, content, contentType } = params;
  
  // Extract content info if content is provided
  let contentInfo: ContentInfo;
  if (content && contentType) {
    contentInfo = await extractContentInfo(content, contentType);
  } else if (params.contentInfo) {
    contentInfo = params.contentInfo;
  } else {
    throw new Error('Either content+contentType or contentInfo must be provided');
  }
  
  // Prepare the credential subject
  const credentialSubject = prepareCredentialSubject(
    subjectDid,
    metadata,
    contentInfo,
    issuerDid
  );
  
  // Prepare the full credential
  const credential: VerifiableCredential = {
    '@context': [
      VC_CONTEXTS.CORE_V2,
      VC_CONTEXTS.ORDINALS_PLUS
    ],
    type: [VC_TYPES.VERIFIABLE_CREDENTIAL, VC_TYPES.VERIFIABLE_COLLECTIBLE],
    issuer: { id: issuerDid },
    issuanceDate: new Date().toISOString(),
    credentialSubject
  };
  
  // Add expiration date if provided in metadata
  if (metadata.expirationDate) {
    credential.expirationDate = metadata.expirationDate;
  }
  
  // Add unique ID if provided
  if (metadata.id) {
    credential.id = metadata.id;
  }
  
  return credential;
} 
/**
 * Utility functions for working with DID-linked resources
 * Provides validation, path parsing, and helper functions for the resource data model
 */

import { 
  ResourceType, 
  ResourceContentType, 
  ResourceValidationRules, 
  DEFAULT_VALIDATION_RULES,
  ResourceMetadata,
  ResourcePath
} from '../types/resource';
import { ParsedResourceId } from '../types';

/**
 * Regular expression for parsing resource paths in DID URLs
 * Format: did:btco:<satNumber>/resources/<resourceIndex>
 */
const RESOURCE_PATH_REGEX = /^did:btco:([0-9]+)(\/resources(?:\/([0-9]+))?)?([\?][^#]*)?(#.*)?$/;

/**
 * Maximum allowed resource size in bytes (default: 10MB)
 * This is a global limit; individual resource types may have lower limits
 */
export const MAX_RESOURCE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Parse a DID URL with a resource path into its components
 * 
 * @param didUrl - The DID URL to parse (e.g., "did:btco:123456/resources/0")
 * @returns The parsed resource path or null if invalid
 */
export function parseResourcePath(didUrl: string): ResourcePath | null {
  if (!didUrl) return null;
  
  const match = RESOURCE_PATH_REGEX.exec(didUrl);
  if (!match) return null;
  
  const [, satNumber, resourcePath, resourceIndexStr, query, fragment] = match;
  
  // Parse resource index if present
  let resourceIndex: number | undefined = undefined;
  if (resourceIndexStr) {
    resourceIndex = parseInt(resourceIndexStr, 10);
    if (isNaN(resourceIndex) || resourceIndex < 0) {
      return null; // Invalid resource index
    }
  }
  
  // Parse query parameters if present
  let queryParams: Record<string, string> | undefined = undefined;
  if (query) {
    queryParams = {};
    const searchParams = new URLSearchParams(query.substring(1));
    searchParams.forEach((value, key) => {
      if (queryParams) queryParams[key] = value;
    });
  }
  
  return {
    did: `did:btco:${satNumber}`,
    satNumber,
    resourcePath: resourcePath || '',
    resourceIndex,
    query: queryParams,
    fragment: fragment ? fragment.substring(1) : undefined
  };
}

/**
 * Parse a resource ID into its components
 * 
 * @param resourceId - The resource ID to parse
 * @returns The parsed resource ID or null if invalid
 */
export function parseResourceId(resourceId: string): ParsedResourceId | null {
  const resourcePath = parseResourcePath(resourceId);
  if (!resourcePath) return null;
  
  return {
    did: resourcePath.did,
    satNumber: parseInt(resourcePath.satNumber, 10),
    index: resourcePath.resourceIndex
  };
}

/**
 * Create a resource ID from a DID and resource index
 * 
 * @param did - The DID to use
 * @param index - The resource index
 * @returns The resource ID
 */
export function createResourceId(did: string, index: number): string {
  if (!did.startsWith('did:btco:')) {
    throw new Error('Invalid DID format. Must start with "did:btco:"');
  }
  
  return `${did}/resources/${index}`;
}

/**
 * Get validation rules for a specific resource type
 * 
 * @param resourceType - The resource type to get rules for
 * @returns The validation rules for the specified type
 */
export function getValidationRules(resourceType: ResourceType | string): ResourceValidationRules {
  // If it's a known ResourceType enum value, return the default rules
  if (Object.values(ResourceType).includes(resourceType as ResourceType)) {
    return DEFAULT_VALIDATION_RULES[resourceType as ResourceType];
  }
  
  // For custom resource types, return the rules for OTHER
  return DEFAULT_VALIDATION_RULES[ResourceType.OTHER];
}

/**
 * Validate a resource against the validation rules
 * 
 * @param content - The resource content
 * @param contentType - The content type
 * @param metadata - The resource metadata
 * @param resourceType - The resource type
 * @returns An object with validation result and any error messages
 */
export function validateResource(
  content: string | Buffer,
  contentType: string,
  metadata: ResourceMetadata,
  resourceType: ResourceType | string
): { valid: boolean; errors: string[] } {
  const rules = getValidationRules(resourceType);
  const errors: string[] = [];
  
  // Check content size
  const contentSize = Buffer.isBuffer(content) 
    ? content.length 
    : Buffer.from(content).length;
  
  if (contentSize > rules.maxSize) {
    errors.push(`Resource size (${contentSize} bytes) exceeds maximum allowed size (${rules.maxSize} bytes) for type ${resourceType}`);
  }
  
  // Check content type
  const allowedTypes = rules.allowedContentTypes;
  if (allowedTypes.length > 0 && !allowedTypes.includes(contentType as any)) {
    errors.push(`Content type "${contentType}" is not allowed for resource type ${resourceType}. Allowed types: ${allowedTypes.join(', ')}`);
  }
  
  // Check required metadata fields
  for (const field of rules.requiredMetadataFields) {
    if (!(field in metadata) || metadata[field as keyof ResourceMetadata] === undefined) {
      errors.push(`Required metadata field "${field}" is missing for resource type ${resourceType}`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get the appropriate MIME type for a file extension
 * 
 * @param extension - The file extension (without the dot)
 * @returns The corresponding MIME type or application/octet-stream if unknown
 */
export function getMimeTypeFromExtension(extension: string): string {
  const ext = extension.toLowerCase().replace(/^\./, '');
  
  // Map common extensions to MIME types
  const mimeMap: Record<string, string> = {
    'json': ResourceContentType.JSON,
    'jsonld': ResourceContentType.JSON_LD,
    'schema.json': ResourceContentType.JSON_SCHEMA,
    'png': ResourceContentType.PNG,
    'jpg': ResourceContentType.JPEG,
    'jpeg': ResourceContentType.JPEG,
    'svg': ResourceContentType.SVG,
    'gif': ResourceContentType.GIF,
    'webp': ResourceContentType.WEBP,
    'pdf': ResourceContentType.PDF,
    'txt': ResourceContentType.TEXT,
    'html': ResourceContentType.HTML,
    'htm': ResourceContentType.HTML,
    'md': ResourceContentType.MARKDOWN,
    'mp3': ResourceContentType.MP3,
    'wav': ResourceContentType.WAV,
    'mp4': ResourceContentType.MP4,
    'webm': ResourceContentType.WEBM,
    'xml': ResourceContentType.XML,
    'cbor': ResourceContentType.CBOR
  };
  
  return mimeMap[ext] || ResourceContentType.BINARY;
}

/**
 * Get the appropriate resource type for a MIME type
 * 
 * @param mimeType - The MIME type
 * @returns The corresponding resource type
 */
export function getResourceTypeFromMimeType(mimeType: string): ResourceType {
  const mime = mimeType.toLowerCase();
  
  if (mime.startsWith('image/')) {
    return ResourceType.IMAGE;
  } else if (mime === 'application/pdf' || mime.startsWith('text/')) {
    return ResourceType.DOCUMENT;
  } else if (mime.startsWith('audio/')) {
    return ResourceType.AUDIO;
  } else if (mime.startsWith('video/')) {
    return ResourceType.VIDEO;
  } else if (mime === 'application/json' || mime === 'application/schema+json') {
    return ResourceType.SCHEMA;
  } else if (mime === 'application/ld+json') {
    return ResourceType.CREDENTIAL;
  }
  
  return ResourceType.OTHER;
}

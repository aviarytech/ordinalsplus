/**
 * Resource Validation Rules
 * 
 * This module defines validation rules for resources to ensure they meet
 * the requirements for inscription and linking to DIDs.
 */

import { ResourceType } from 'ordinalsplus';

/**
 * Interface for resource validation rules
 */
export interface ResourceValidationRules {
  /** Maximum size of resource content in bytes */
  maxSize: number;
  /** Allowed content types */
  allowedContentTypes: string[];
  /** Whether to enforce strict schema validation */
  enforceSchema: boolean;
  /** Whether to require a parent DID */
  requireParentDid: boolean;
  /** Whether to validate relationships */
  validateRelationships: boolean;
  /** Whether to enforce uniqueness constraints */
  enforceUniqueness: boolean;
}

/**
 * Default validation rules for resources
 */
export const DEFAULT_VALIDATION_RULES: ResourceValidationRules = {
  maxSize: 1024 * 1024 * 4, // 4MB
  allowedContentTypes: [
    'text/plain',
    'text/html',
    'text/markdown',
    'application/json',
    'application/ld+json',
    'image/png',
    'image/jpeg',
    'image/svg+xml',
    'application/pdf'
  ],
  enforceSchema: true,
  requireParentDid: false,
  validateRelationships: true,
  enforceUniqueness: true
};

/**
 * Validation rules by resource type
 */
export const VALIDATION_RULES_BY_TYPE: Record<ResourceType, Partial<ResourceValidationRules>> = {
  [ResourceType.DOCUMENT]: {
    maxSize: 1024 * 1024 * 2, // 2MB for documents
    allowedContentTypes: [
      'text/plain',
      'text/html',
      'text/markdown',
      'application/pdf'
    ]
  },
  [ResourceType.DATA]: {
    maxSize: 1024 * 1024 * 4, // 4MB for data
    allowedContentTypes: [
      'application/json',
      'application/ld+json',
      'text/csv',
      'application/xml'
    ]
  },
  [ResourceType.SCHEMA]: {
    maxSize: 1024 * 100, // 100KB for schemas
    allowedContentTypes: [
      'application/json',
      'application/ld+json',
      'application/schema+json'
    ],
    enforceSchema: true
  },
  [ResourceType.IMAGE]: {
    maxSize: 1024 * 1024 * 3, // 3MB for images
    allowedContentTypes: [
      'image/png',
      'image/jpeg',
      'image/gif',
      'image/svg+xml',
      'image/webp'
    ]
  },
  [ResourceType.CREDENTIAL]: {
    maxSize: 1024 * 100, // 100KB for credentials
    allowedContentTypes: [
      'application/json',
      'application/ld+json'
    ],
    enforceSchema: true,
    validateRelationships: true
  },
  [ResourceType.CODE]: {
    maxSize: 1024 * 1024, // 1MB for code
    allowedContentTypes: [
      'text/plain',
      'application/javascript',
      'text/javascript',
      'text/x-python',
      'text/x-java'
    ]
  },
  [ResourceType.AUDIO]: {
    maxSize: 1024 * 1024 * 10, // 10MB for audio
    allowedContentTypes: [
      'audio/mpeg',
      'audio/ogg',
      'audio/wav',
      'audio/webm'
    ]
  },
  [ResourceType.VIDEO]: {
    maxSize: 1024 * 1024 * 20, // 20MB for video
    allowedContentTypes: [
      'video/mp4',
      'video/webm',
      'video/ogg'
    ]
  },
  [ResourceType.METADATA]: {
    maxSize: 1024 * 100, // 100KB for metadata
    allowedContentTypes: [
      'application/json',
      'application/ld+json'
    ]
  },
  [ResourceType.OTHER]: {
    maxSize: 1024 * 1024, // 1MB for other types
    allowedContentTypes: [] // Allow any content type
  }
};

/**
 * Get validation rules for a specific resource type
 * 
 * @param resourceType - The type of resource to get validation rules for
 * @returns Validation rules for the specified resource type
 */
export function getValidationRulesForType(resourceType: ResourceType): ResourceValidationRules {
  const typeRules = VALIDATION_RULES_BY_TYPE[resourceType] || {};
  return {
    ...DEFAULT_VALIDATION_RULES,
    ...typeRules
  };
}

/**
 * Validate resource content against validation rules
 * 
 * @param content - The content to validate
 * @param contentType - The content type
 * @param rules - The validation rules to apply
 * @returns Whether the content is valid
 */
export function validateResourceContent(
  content: Buffer | string,
  contentType: string,
  rules: ResourceValidationRules
): boolean {
  // Check content size
  const contentSize = content instanceof Buffer ? content.length : Buffer.from(content as string).length;
  if (contentSize > rules.maxSize) {
    return false;
  }

  // Check content type
  if (rules.allowedContentTypes.length > 0 && !rules.allowedContentTypes.includes(contentType)) {
    return false;
  }

  // Additional validation logic can be added here

  return true;
}

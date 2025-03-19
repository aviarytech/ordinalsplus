/**
 * Constants used throughout the Ordinals Plus library
 */

export const DEFAULT_API_ENDPOINT = 'https://api.ordinalsplus.com';
export const DEFAULT_TIMEOUT = 30000; // 30 seconds

// DID-related constants
export const BTCO_METHOD = 'btco';
export const DID_PREFIX = 'did';
export const DID_CONTEXT = 'https://www.w3.org/ns/did/v1';
export const MULTIKEY_CONTEXT = 'https://w3id.org/security/multikey/v1';
export const ORDINALS_PLUS_CONTEXT = 'https://ordinals.plus/v1';

// Resource-related constants
export const INFO_SUFFIX = 'info';
export const META_SUFFIX = 'meta';
export const CHILD_SUFFIX = 'child';
export const PARENT_SUFFIX = 'parent';
export const HERITAGE_SUFFIX = 'heritage';
export const CONTROLLER_SUFFIX = 'controller';

// Error codes
export const ERROR_CODES = {
  INVALID_DID: 'invalidDid',
  INVALID_RESOURCE_ID: 'invalidResourceId',
  RESOURCE_NOT_FOUND: 'resourceNotFound',
  INVALID_IDENTIFIER: 'invalidIdentifier',
  CONTENT_TYPE_UNSUPPORTED: 'contentTypeUnsupported',
  METADATA_INVALID: 'metadataInvalid',
  COLLECTION_EMPTY: 'collectionEmpty',
  RESOLUTION_TIMEOUT: 'resolutionTimeout',
  TIMEOUT: 'timeout',
  NETWORK_ERROR: 'networkError',
  API_ERROR: 'apiError',
  UNEXPECTED_ERROR: 'unexpectedError'
}; 
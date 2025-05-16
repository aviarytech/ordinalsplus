/**
 * BTCO method name for DIDs
 */
export const BTCO_METHOD = 'btco';

/**
 * Maximum allowed sat number (total supply across all rarity tiers)
 */
export const MAX_SAT_NUMBER = 2099999997690000;

/**
 * Error codes used throughout the library
 */
export const ERROR_CODES = {
    INVALID_DID: 'invalidDid',
    INVALID_RESOURCE_ID: 'invalidResourceId',
    INVALID_RESOURCE_TYPE: 'invalidResourceType',
    INVALID_CONTENT_TYPE: 'invalidContentType',
    RESOURCE_TOO_LARGE: 'resourceTooLarge',
    MISSING_METADATA: 'missingMetadata',
    INVALID_INSCRIPTION: 'invalidInscription',
    NOT_FOUND: 'notFound',
    NETWORK_ERROR: 'networkError',
    RESOLUTION_FAILED: 'resolutionFailed',
    METHOD_NOT_SUPPORTED: 'methodNotSupported',
    RESOURCE_VALIDATION_FAILED: 'resourceValidationFailed',
    RESOURCE_NOT_FOUND: 'resourceNotFound'
} as const;

/**
 * Content types used throughout the library
 */
export const CONTENT_TYPES = {
    JSON: 'application/json',
    JSON_LD: 'application/ld+json',
    JSON_SCHEMA: 'application/schema+json',
    TEXT: 'text/plain',
    HTML: 'text/html',
    MARKDOWN: 'text/markdown',
    PNG: 'image/png',
    JPEG: 'image/jpeg',
    SVG: 'image/svg+xml',
    PDF: 'application/pdf',
    BINARY: 'application/octet-stream',
    CBOR: 'application/cbor'
} as const;

/**
 * Default resource index
 */
export const DEFAULT_INDEX = 0;

/**
 * Resource-related constants
 */
export const RESOURCE_CONSTANTS = {
    // Path components
    RESOURCES_PATH: 'resources',
    
    // Size limits
    MAX_RESOURCE_SIZE: 10 * 1024 * 1024, // 10MB global limit
    DEFAULT_MAX_SIZE: 1024 * 1024, // 1MB default limit
    
    // Validation
    DEFAULT_ALLOWED_CONTENT_TYPES: ['application/json', 'text/plain'],
    
    // DID URL components
    QUERY_PARAM_VERSION: 'version',
    QUERY_PARAM_FORMAT: 'format',
    QUERY_PARAM_TRANSFORM: 'transform'
} as const;

/**
 * Resource relationship types
 */
export const RESOURCE_RELATIONSHIPS = {
    PARENT: 'parent',
    CHILD: 'child',
    RELATED: 'related',
    REFERENCES: 'references',
    REFERENCED_BY: 'referencedBy',
    REPLACES: 'replaces',
    REPLACED_BY: 'replacedBy',
    DERIVES_FROM: 'derivesFrom',
    DERIVED_WORKS: 'derivedWorks'
} as const;
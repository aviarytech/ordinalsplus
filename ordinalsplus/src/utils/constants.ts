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
    INVALID_INSCRIPTION: 'invalidInscription',
    NOT_FOUND: 'notFound',
    NETWORK_ERROR: 'networkError'
} as const;

export const CONTENT_TYPES = {
    JSON: 'application/json',
    TEXT: 'text/plain',
    BINARY: 'application/octet-stream'
} as const;

export const DEFAULT_INDEX = 0; 
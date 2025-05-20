/**
 * Enhanced Ordinals Inscription Module
 * 
 * This module provides a cleaner, more maintainable approach to ordinals inscription
 * generation based on the micro-ordinals library. It handles script generation,
 * content preparation, and key management for ordinals inscriptions.
 */

// Export P2TR key utilities
export * from './p2tr/key-utils';

// Export content preparation and MIME handling
export * from './content/mime-handling';

// Export ordinal inscription script generation
export * from './scripts/ordinal-reveal';

/**
 * Main Inscription API
 * 
 * This file serves as the main entry point for the enhanced inscription functionality.
 * It provides a simplified API surface for the most common operations.
 */

import { 
  InscriptionContent, 
  prepareContent, 
  guessMimeType 
} from './content/mime-handling';
import { 
  prepareInscription, 
  PrepareInscriptionParams, 
  PreparedInscription 
} from './scripts/ordinal-reveal';
import { 
  generateP2TRKeyPair, 
  P2TRKeyPair 
} from './p2tr/key-utils';
import { BitcoinNetwork } from '../types';

/**
 * Parameters for creating an inscription in a single step
 */
export interface CreateInscriptionParams {
  /** The content to inscribe (string or binary data) */
  content: Uint8Array | string;
  /** The MIME type of the content (if known) */
  contentType?: string;
  /** The filename to use for guessing the MIME type (if contentType is not provided) */
  filename?: string;
  /** Additional metadata for the inscription */
  metadata?: Record<string, string>;
  /** The Bitcoin network to use */
  network?: BitcoinNetwork;
  /** An existing public key to use for the reveal transaction (if not provided, one will be generated) */
  revealPublicKey?: Uint8Array;
  /** A recovery public key to use for the commit address (optional) */
  recoveryPublicKey?: Uint8Array;
}

/**
 * Creates an inscription in a single step
 * 
 * This is a convenience function that combines content preparation and
 * inscription script generation into a single operation.
 * 
 * @param params - Parameters for creating the inscription
 * @returns A fully prepared inscription
 */
export function createInscription(params: CreateInscriptionParams): PreparedInscription {
  const { 
    content, 
    contentType, 
    filename, 
    metadata, 
    network, 
    revealPublicKey, 
    recoveryPublicKey 
  } = params;
  
  // Determine content type if not provided
  const resolvedContentType = contentType || (filename && guessMimeType(filename, content)) || 'application/octet-stream';
  
  // Prepare the content
  const preparedContent = prepareContent(content, resolvedContentType, metadata);
  
  // Prepare the inscription
  return prepareInscription({
    content: preparedContent,
    revealPublicKey,
    network,
    recoveryPublicKey
  });
}

/**
 * Creates a test inscription with text content
 * 
 * This is a convenience function for quickly creating a test inscription
 * with plain text content.
 * 
 * @param text - The text to inscribe
 * @param network - The Bitcoin network to use
 * @returns A fully prepared inscription
 */
export function createTextInscription(text: string, network: BitcoinNetwork = 'mainnet'): PreparedInscription {
  return createInscription({
    content: text,
    contentType: 'text/plain',
    network
  });
}

/**
 * Creates a test inscription with JSON content
 * 
 * This is a convenience function for quickly creating a test inscription
 * with JSON content.
 * 
 * @param jsonData - The JSON object to inscribe
 * @param network - The Bitcoin network to use
 * @returns A fully prepared inscription
 */
export function createJsonInscription(jsonData: any, network: BitcoinNetwork = 'mainnet'): PreparedInscription {
  const jsonString = JSON.stringify(jsonData);
  
  return createInscription({
    content: jsonString,
    contentType: 'application/json',
    network
  });
} 
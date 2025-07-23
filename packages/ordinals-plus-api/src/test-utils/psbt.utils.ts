/**
 * PSBT test utilities
 * 
 * This file provides testing utilities for PSBT-related operations
 * including direct imports from ordinalsplus package for testing.
 */

// Import from ordinalsplus package - using direct path for test safety
import { 
  createInscriptionPsbts as createInscriptionPsbtsFn,
  calculateTxFee as calculateTxFeeFn,
  getBitcoinJsNetwork
} from 'ordinalsplus';

// Type-only imports
import type { 
  InscriptionData, 
  InscriptionScripts 
} from 'ordinalsplus';

type BitcoinNetwork = 'mainnet' | 'signet' | 'testnet';

/**
 * Verify that required PSBT functions are available from ordinalsplus
 * @returns Object indicating which functions are available
 */
export function verifyPsbtImports() {
  return {
    createInscriptionPsbtsFn: typeof createInscriptionPsbtsFn === 'function',
    calculateTxFeeFn: typeof calculateTxFeeFn === 'function',
    getBitcoinJsNetwork: typeof getBitcoinJsNetwork === 'function'
  };
}

// Export functions and types for use in tests
export {
  createInscriptionPsbtsFn,
  calculateTxFeeFn,
  getBitcoinJsNetwork
};

export type {
  InscriptionData,
  InscriptionScripts,
  BitcoinNetwork
}; 
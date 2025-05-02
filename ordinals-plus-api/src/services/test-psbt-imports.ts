// Test the imports from ordinalsplus
import { 
  createInscriptionPsbts as createInscriptionPsbtsFn,
  calculateTxFee as calculateTxFeeFn,
  getBitcoinJsNetwork
} from '../../../ordinalsplus/src/transactions/psbt-creation';

// Type-only imports
import type { 
  InscriptionData, 
  InscriptionScripts 
} from '../../../ordinalsplus/src/transactions/psbt-creation';
import type { BitcoinNetwork } from '../../../ordinalsplus/src/types';

// Log the imported functions
console.log('Imports working:', {
  createInscriptionPsbtsFn: typeof createInscriptionPsbtsFn === 'function',
  calculateTxFeeFn: typeof calculateTxFeeFn === 'function',
  getBitcoinJsNetwork: typeof getBitcoinJsNetwork === 'function'
});

// Export for type checking
export { createInscriptionPsbtsFn }; 
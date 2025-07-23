// Test the imports from ordinalsplus
import { 
  createInscriptionPsbts as createInscriptionPsbtsFn,
  calculateTxFee as calculateTxFeeFn,
  getBitcoinJsNetwork
} from '../../../ordinalsplus/src/transactions/psbt-creation';


// Log the imported functions
console.log('Imports working:', {
  createInscriptionPsbtsFn: typeof createInscriptionPsbtsFn === 'function',
  calculateTxFeeFn: typeof calculateTxFeeFn === 'function',
  getBitcoinJsNetwork: typeof getBitcoinJsNetwork === 'function'
});

// Export for type checking
export { createInscriptionPsbtsFn }; 
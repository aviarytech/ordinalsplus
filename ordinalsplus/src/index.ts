// Export DID classes
import { BtcoDid } from './did/btco-did';

// Export DID utility functions
import { 
  createDidFromInscription,
  createLinkedResourceFromInscription
} from './did/did-utils';

// Export Resource classes
import { ResourceResolver } from './resources/resource-resolver';

// Export utility functions
import {
  isValidBtcoDid,
  isValidResourceId,
  parseBtcoDid,
  parseResourceId,
  createDidFromInscriptionData,
  createResourceIdFromInscription
} from './utils/validators';

// Export constants
import * as constants from './utils/constants';

// Export services
import { OrdinalsService, OrdinalsProviderType } from './services/OrdinalsService';
import { IOrdinalsProvider, BaseOrdinalsProvider } from './services/providers/IOrdinalsProvider';
import { OrdiscanProvider } from './services/providers/OrdiscanProvider';

// Export all types
export * from './types';

// Re-export services and interfaces directly for easier imports
export type { IOrdinalsProvider, OrdinalsProviderType };
export { BaseOrdinalsProvider };

// Main exports
export {
  // Classes
  BtcoDid,
  ResourceResolver,
  
  // DID functions
  createDidFromInscription,
  createLinkedResourceFromInscription,
  createDidFromInscriptionData,
  
  // Utility functions
  isValidBtcoDid,
  isValidResourceId,
  parseBtcoDid,
  parseResourceId,
  createResourceIdFromInscription,
  
  // Constants
  constants,
  
  // Services
  OrdinalsService,
  OrdiscanProvider
};

// Create a convenience function to get a properly configured provider
export function getOrdinalsProvider(
  type: OrdinalsProviderType = 'ordiscan',
  apiKey?: string,
  endpoint?: string
): IOrdinalsProvider {
  return OrdinalsService.getInstance().initProvider(type, {
    apiKey,
    endpoint
  });
}

// Default export
const OrdinalsPlus = {
  BtcoDid,
  ResourceResolver,
  utils: {
    createDidFromInscription,
    createLinkedResourceFromInscription,
    createDidFromInscriptionData,
    isValidBtcoDid,
    isValidResourceId,
    parseBtcoDid,
    parseResourceId,
    createResourceIdFromInscription,
    constants
  },
  services: {
    OrdinalsService,
    getOrdinalsProvider
  }
};

export default OrdinalsPlus; 
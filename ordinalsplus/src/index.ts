import { OrdiscanProvider } from './resources/providers/ordiscan-provider';
import { OrdNodeProvider } from './resources/providers/ord-node-provider';

// --- Type Exports ---
// Export all types directly from the types index
export * from './types';

// --- DID Exports ---
export { BtcoDid, createDidFromInscriptionData, isBtcoDid } from './did/index';

// --- Resource Exports ---
// Note: createLinkedResourceFromInscription is exported from both ./did and ./resources
// We need to choose one or rename/alias. Let's pick the one from ./resources for now.
export { 
    createLinkedResourceFromInscription, 
    ResourceResolver, 
    formatResourceContent 
} from './resources/index';
// Explicitly export provider types if needed, assuming they are in ./resources/providers/types
export type { ResourceProvider, ResourceResolverOptions } from './resources/index';

// --- Inscription Exports ---
export { prepareInscriptionEnvelope } from './inscription/index';

// --- Utility Exports ---
// Avoid re-exporting things already exported above (like createDidFrom...)
export { 
    isValidBtcoDid, 
    isValidResourceId, 
    parseBtcoDid, 
    parseResourceId, 
    extractSatNumber, 
    extractIndexFromInscription, 
    BTCO_METHOD, 
    ERROR_CODES, 
    MAX_SAT_NUMBER 
} from './utils/index';
// Export the new address utilities
export * from './utils/address-utils';

// --- Specific Provider Exports (if needed beyond default) ---
export { OrdiscanProvider } from './resources/providers/ordiscan-provider';

// --- Default Export Configuration ---
export { OrdiscanProvider as default, OrdNodeProvider };

export * from './utils/constants';
export * from './utils/address-utils';

// --- Transaction Utilities Export --- 
export * from './transactions/inscription-utils';
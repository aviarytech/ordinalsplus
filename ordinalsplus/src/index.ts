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

export type { ResourceProvider, ResourceResolverOptions } from './resources/index';

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

export * from './utils/address-utils';
export { NETWORKS, getScureNetwork } from './utils/networks';

export { OrdiscanProvider } from './resources/providers/ordiscan-provider';

export { OrdiscanProvider as default, OrdNodeProvider };

export * from './utils/constants';

// --- Transaction Exports ---
export {
    calculateFee,
    prepareResourceInscription, 
    validateResourceCreationParams,
    prepareCommitTransaction
} from './transactions';

export type { 
    PreparedResourceInfo,
    CommitTransactionParams,
    CommitTransactionResult
} from './transactions';

// --- Inscription Exports ---
export {
    createInscription,
    createTextInscription,
    createJsonInscription
} from './inscription';

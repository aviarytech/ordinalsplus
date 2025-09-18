import { OrdiscanProvider } from './resources/providers/ordiscan-provider';
import { OrdNodeProvider } from './resources/providers/ord-node-provider';
import { StaticDataProvider } from './resources/providers/static-data-provider';

// --- Type Exports ---
// Export all types directly from the types index
export * from './types';

// --- DID Exports ---
export { BtcoDidResolver, createDidFromInscriptionData, isBtcoDid } from './did/index';
export type { BtcoDidResolutionResult, BtcoDidResolutionOptions } from './did/btco-did-resolver';

// --- Key Management Exports ---
export {
    KeyManager,
    defaultKeyManager,
    KeyPairGenerator,
    generateEd25519KeyPair,
    generateSecp256k1KeyPair,
    generateSchnorrKeyPair
} from './key-management';

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
    extractSatNumber, 
    extractIndexFromInscription,
    encoding,
    BTCO_METHOD, 
    ERROR_CODES, 
    MAX_SAT_NUMBER 
} from './utils/index';

export * from './utils/address-utils';
export { NETWORKS, getScureNetwork } from './utils/networks';

// --- CBOR Utility Exports ---
export {
    encodeCbor,
    decodeCbor,
    isCbor,
    extractCborMetadata
} from './utils/cbor-utils';

// --- Resource Utility Exports ---
export {
    validateResource,
    parseResourcePath,
    parseResourceId,
    createResourceId,
    getValidationRules,
    getMimeTypeFromExtension,
    getResourceTypeFromMimeType,
    MAX_RESOURCE_SIZE
} from './utils/resource-utils';

// --- PSBT Utility Exports ---
export { 
    finalizePsbt, 
    extractTransaction, 
    finalizeAndExtractTransaction 
} from './utils/psbt-utils';

export { OrdiscanProvider } from './resources/providers/ordiscan-provider';

export { OrdiscanProvider as default, OrdNodeProvider, StaticDataProvider };

export * from './utils/constants';

// --- Transaction Exports ---
export {
    calculateFee,
    prepareResourceInscription, 
    validateResourceCreationParams,
    prepareCommitTransaction,
    createRevealTransaction,
    transactionTracker,
    prepareBatchCommitTransaction,
    inscribeWithSatpoint,
    createRevealForSatpointCommit,
    prepareMultiInscriptionCommitTransaction,
    estimateRequiredCommitAmountForBatch
} from './transactions';

export type { 
    PreparedResourceInfo,
    CommitTransactionParams,
    CommitTransactionResult,
    RevealTransactionParams,
    RevealTransactionResult,
    BatchCommitTransactionParams,
    BatchCommitTransactionResult,
    BatchCommitOutputInfo,
    InscribeWithSatpointParams,
    InscribeWithSatpointResult
} from './transactions';

// --- Transaction Status Tracking Exports ---
export {
    TransactionStatus,
    TransactionType,
    TransactionStatusTracker
} from './transactions/transaction-status-tracker';

export type {
    TrackedTransaction,
    TransactionError,
    TransactionProgressEvent
} from './transactions/transaction-status-tracker';

// --- Component Exports ---
// Note: components are not part of the published API here

// --- Inscription Exports ---
export {
    createInscription,
    createTextInscription,
    createJsonInscription,
    prepareBatchInscription
} from './inscription';

// --- Indexer Exports ---
export {
  OrdinalsIndexer,
  MemoryIndexerDatabase
} from './indexer';

export {
    VCService
} from './vc/service';

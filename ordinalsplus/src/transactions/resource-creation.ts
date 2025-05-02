import * as btc from '@scure/btc-signer';
import { 
    InscriptionData, 
    PreparedInscriptionScripts,
    prepareInscriptionScripts,
    estimateRevealFee,
    CommitP2TRInfo // Import if needed for types
} from '../inscription'; // Correct path to inscription module
import { calculateFee } from './fee-calculation'; // Correct path to fee calculation
import { ResourceCreationParams, ResourceCreationResult, Utxo, BitcoinNetwork } from '../types'; // Adjust ResourceCreationResult later
import { getScureNetwork } from '../utils/networks';

// Constants from inscription module might be needed
const POSTAGE_VALUE = 1000n; // Use bigint
const DUST_LIMIT = 546n;    // Use bigint

// Define the NEW expected result for the preparation step
export interface PreparedResourceInfo {
    preparedScripts: PreparedInscriptionScripts;
    estimatedRevealFee: bigint;
    requiredCommitAmount: bigint;
}

/**
 * Prepares the scripts and estimates fees for creating a resource inscription.
 * This function handles the first part of the inscription process.
 * 
 * @param params The resource creation parameters.
 * @returns Information needed to prompt the user for the commit transaction funding.
 * @throws Error if preparation fails.
 */
export async function prepareResourceInscription(
    params: ResourceCreationParams
): Promise<PreparedResourceInfo> {
    const {
        content,
        contentType,
        resourceType,
        publicKey, // Expecting the reveal public key here
        // changeAddress, // Not needed for preparation step
        recipientAddress, // Destination address for the final inscription
        // utxos, // Not needed for preparation step
        feeRate,
        network: networkType,
        metadata = {}
    } = params;
    console.log('[prepareResourceInscription] Starting inscription preparation...');

    // 1. Validate Core Params (adjust validation if needed)
    validateResourceCreationParams(params); // Might need adjustment

    // 2. Get Network
    const network = getScureNetwork(networkType);

    // 3. Prepare Inscription Data
    const resourceMetadata = {
        ...metadata,
        type: resourceType
    };
    const inscriptionData: InscriptionData = {
        contentType: contentType,
        content: content, // Pass content directly (string or Bytes)
        metadata: resourceMetadata,
        // parentInscriptionId: params.parentInscriptionId, // Add if needed
    };

    try {
        // 4. Prepare Inscription Scripts
        // Use the provided publicKey as the reveal key. Recovery key can be added later if needed.
        const preparedScripts = prepareInscriptionScripts({
            recoveryPublicKey: publicKey, 
            inscriptionData: inscriptionData,
            network: network,
            // recoveryPublicKey: publicKey // Optional: Can use the same key or a different one
        });
        console.log(`[prepareResourceInscription] Scripts prepared. Commit Address: ${preparedScripts.commitP2TRDetails.address}`);

        // 5. Estimate Reveal Fee
        // We need an estimated commit amount for fee calculation.
        // Let's use POSTAGE_VALUE as the target output amount for the reveal tx.
        const estimatedRevealFee = estimateRevealFee({
            commitP2TRScript: preparedScripts.commitP2TRDetails.script,
            commitAmount: POSTAGE_VALUE, // Estimate fee based on typical postage output
            destinationAddress: recipientAddress,
            feeRate: feeRate,
            network: network,
            inscriptionLeafScript: preparedScripts.inscriptionLeafScript
        });
        console.log(`[prepareResourceInscription] Estimated Reveal Fee: ${estimatedRevealFee} sats`);

        // 6. Calculate Required Commit Amount
        // User needs to send enough to cover the reveal fee plus the final inscription output value (postage)
        const requiredCommitAmount = estimatedRevealFee + POSTAGE_VALUE;
        console.log(`[prepareResourceInscription] Required Commit Amount: ${requiredCommitAmount} sats`);

        // 7. Return the prepared info
        return {
            preparedScripts,
            estimatedRevealFee,
            requiredCommitAmount
        };

    } catch (error) {
        console.error('[prepareResourceInscription] Error during preparation:', error);
        if (error instanceof Error) {
            throw new Error(`Failed to prepare resource inscription: ${error.message}`);
        }
        throw new Error('Failed to prepare resource inscription: Unknown error');
    }
}

// Keep validation, but it might need adjustment as params changed
export function validateResourceCreationParams(params: ResourceCreationParams): void {
    const { content, contentType, resourceType, publicKey, /*changeAddress,*/ recipientAddress, /*utxos,*/ feeRate, network } = params;
    
    if (!content) throw new Error('Resource content is required');
    if (!contentType) throw new Error('Content type is required');
    if (!resourceType) throw new Error('Resource type is required');
    if (!publicKey || !(publicKey instanceof Uint8Array || (typeof publicKey === 'string'))) throw new Error('Valid public key is required');
    // if (!changeAddress) throw new Error('Change address is required'); // Not needed for prepare step
    if (!recipientAddress) throw new Error('Recipient address is required');
    // if (!utxos || !Array.isArray(utxos) || utxos.length === 0) throw new Error('At least one UTXO is required'); // Not needed for prepare step
    if (typeof feeRate !== 'number' || feeRate <= 0) throw new Error('Fee rate must be a positive number');
    if (!network || !['mainnet', 'signet', 'testnet'].includes(network)) throw new Error(`Valid network is required (mainnet, signet, testnet)`);
}

// --- Remove the old createResourceTransaction function ---
/*
export async function createResourceTransaction(
    params: ResourceCreationParams,
    testMode = false
): Promise<ResourceCreationResult> { 
    // ... OLD OBSOLETE IMPLEMENTATION ...
}
*/ 
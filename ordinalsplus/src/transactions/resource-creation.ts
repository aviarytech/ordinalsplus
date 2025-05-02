import * as btc from '@scure/btc-signer';
import { calculateFee } from './fee-calculation';
import { ResourceCreationParams, ResourceCreationResult, Utxo, BitcoinNetwork } from '../types';
import { getScureNetwork } from '../utils/networks';
import { 
  prepareInscription, 
  PreparedInscription 
} from '../inscription/scripts/ordinal-reveal';
import { 
  prepareContent,
  guessMimeType
} from '../inscription/content/mime-handling';
import { prepareCommitTransaction } from './commit-transaction';

// Constants
const POSTAGE_VALUE = 1000n; // Use bigint
const DUST_LIMIT = 546n;    // Use bigint

// Define the expected result for the preparation step
export interface PreparedResourceInfo {
    preparedInscription: PreparedInscription;
    estimatedRevealFee: number;
    requiredCommitAmount: number;
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

    // 1. Validate Core Params
    validateResourceCreationParams(params);

    // 2. Get Network
    const network = getScureNetwork(networkType);

    // 3. Prepare Resource Metadata
    const resourceMetadata = {
        ...metadata,
        type: resourceType
    };

    try {
        // 4. Prepare the content with the proper content type
        const resolvedContentType = contentType || 
            (typeof content === 'string' && content.startsWith('{') ? 'application/json' : 'text/plain');
        
        // 5. Prepare the inscription content
        const preparedContent = prepareContent(content, resolvedContentType, resourceMetadata);
        
        // 6. Create the inscription using the micro-ordinals approach
        const preparedInscription = prepareInscription({
            content: preparedContent,
            revealPublicKey: publicKey instanceof Uint8Array ? publicKey : undefined,
            network: networkType
        });
        
        console.log(`[prepareResourceInscription] Inscription prepared. Commit Address: ${preparedInscription.commitAddress.address}`);

        // 7. Estimate the fees for the reveal transaction
        // This is a simplified estimation - in a real implementation,
        // you would calculate this based on the actual transaction size
        const estimatedRevealVBytes = 200; // Approximate size for a reveal transaction
        const estimatedRevealFee = Number(calculateFee(estimatedRevealVBytes, feeRate));
        
        console.log(`[prepareResourceInscription] Estimated Reveal Fee: ${estimatedRevealFee} sats`);

        // 8. Calculate Required Commit Amount
        // User needs to send enough to cover the reveal fee plus the final inscription output value (postage)
        const requiredCommitAmount = estimatedRevealFee + Number(POSTAGE_VALUE);
        console.log(`[prepareResourceInscription] Required Commit Amount: ${requiredCommitAmount} sats`);

        // 9. Return the prepared info
        return {
            preparedInscription,
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

// Keep validation, but update it for the new parameters structure
export function validateResourceCreationParams(params: ResourceCreationParams): void {
    const { content, contentType, resourceType, publicKey, recipientAddress, feeRate, network } = params;
    
    if (!content) throw new Error('Resource content is required');
    if (!resourceType) throw new Error('Resource type is required');
    if (!publicKey) throw new Error('Valid public key is required');
    if (!recipientAddress) throw new Error('Recipient address is required');
    if (typeof feeRate !== 'number' || feeRate <= 0) throw new Error('Fee rate must be a positive number');
    if (!network || !['mainnet', 'signet', 'testnet'].includes(network)) throw new Error(`Valid network is required (mainnet, signet, testnet)`);
}

// The old createResourceTransaction function is removed as it's replaced by the commit-transaction.ts implementation 
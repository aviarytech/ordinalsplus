import type {
    FeeEstimateResponse,
    TransactionStatusResponse,
    NetworkType,
} from '../types';
import { getFeeEstimates as fetchFeeEstimates } from '../services/feeService';
import { getTransactionStatus as fetchTransactionStatus } from '../services/blockchainService';
import type { ResourceCreationParams, PreparedResourceInfo } from 'ordinalsplus';
import { prepareResourceInscription } from 'ordinalsplus';
// --- Fee Estimation (Remains the same) ---
/**
 * Get fee estimates from the fee service
 * @returns Fee estimates (low, medium, high)
 */
export async function getFeeEstimates(network: NetworkType = 'mainnet'): Promise<FeeEstimateResponse> {
    console.log('[inscriptionsController] Fetching fee estimates for network:', network);
    try {
        const estimates = await fetchFeeEstimates(network);
        return estimates;
    } catch (error) {
        console.error('[inscriptionsController] Error fetching fee estimates:', error);
        // Propagate the error for the router to handle
        throw error;
    }
}

// --- Remove Obsolete PSBT Creation Functions ---
/*
export async function createGenericInscriptionPsbt(request: GenericInscriptionRequest): Promise<PsbtResponse> { ... }
export async function createDidInscriptionPsbt(request: DidInscriptionRequest): Promise<PsbtResponse> { ... }
export async function createInscriptionPsbts(request: CreatePsbtsRequest): Promise<CombinedPsbtResponse> { ... }
*/

/**
 * Prepares the inscription scripts and calculates commit/fee details.
 * This endpoint handles the first step of the inscription process, returning
 * the necessary information for the client to prompt the user for funding.
 *
 * @param request Parameters matching ResourceCreationParams from ordinalsplus package.
 * @returns PreparedResourceInfo containing commit details and fee estimates.
 */
 // Use the imported type alias if needed, otherwise use local ResourceCreationParams if they match
export async function prepareInscriptionForFunding(
    request: ResourceCreationParams
): Promise<PreparedResourceInfo> {
    console.log('[inscriptionsController] Preparing Inscription for Funding...');
    try {
        // The request should directly match the ResourceCreationParams expected by the package function.
        // Add validation here if necessary, beyond what the ordinalsplus package does.
        if (!request.publicKey || !request.recipientAddress || !request.content) {
            throw new Error("Missing required fields in request (publicKey, recipientAddress, content).");
        }

        console.log('[inscriptionsController] Calling prepareResourceInscription with params:', {
            ...request,
            content: typeof request.content === 'string' ? '<string>' : `<Uint8Array length ${request.content.length}>` // Avoid logging large content
        });

        // Directly use the function from ordinalsplus package
        const result: PreparedResourceInfo = await prepareResourceInscription(request);

        console.log('[inscriptionsController] Successfully prepared inscription info.');
        console.log(`[inscriptionsController] Commit Address: ${result.preparedScripts.commitP2TRDetails.address}`);
        console.log(`[inscriptionsController] Required Amount: ${result.requiredCommitAmount.toString()}`); // Use toString for BigInt logging
        console.log(`[inscriptionsController] Estimated Reveal Fee: ${result.estimatedRevealFee.toString()}`); // Use toString for BigInt logging

        // Return the result directly (it should match PreparedResourceInfo)
        // Ensure BigInts are handled correctly if sending as JSON (usually requires string conversion)
        // For now, returning the object as is, assuming Elysia/client handles BigInt serialization if needed.
        return result;

    } catch (error) {
        console.error('[inscriptionsController] Error preparing inscription:', error);
        // Avoid leaking internal details in production errors
        throw new Error(`Failed to prepare inscription: ${error instanceof Error ? error.message : 'An unexpected error occurred'}`);
    }
}

// --- Transaction Status (Remains the same) ---
/**
 * Get transaction status from the blockchain service
 * @param txid Transaction ID
 * @returns Transaction status
 */
export async function getTransactionStatus(txid: string): Promise<TransactionStatusResponse> {
    console.log(`[inscriptionsController] Checking status for transaction: ${txid}`);
    try {
        // Assuming network handling is part of fetchTransactionStatus or context
        const status = await fetchTransactionStatus(txid);
        return status;
    } catch (error) {
        console.error(`[inscriptionsController] Error checking transaction status for ${txid}:`, error);
        // Propagate the error
        throw error;
    }
} 
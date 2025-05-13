// Export the utility function for use in the UI
export function createSignedRevealPsbt(params: CreateSignedRevealPsbtParams): string {
    try {
        // Enhanced debug logging for key analysis
        console.log('[DEBUG:createSignedRevealPsbt] Starting with parameters:');
        console.log(`[DEBUG:createSignedRevealPsbt] - commitTxid: ${params.commitTxid}`);
        console.log(`[DEBUG:createSignedRevealPsbt] - commitVout: ${params.commitVout}`);
        console.log(`[DEBUG:createSignedRevealPsbt] - commitTxHex length: ${params.commitTxHex.length}`);
        console.log(`[DEBUG:createSignedRevealPsbt] - unsignedRevealPsbtBase64 length: ${params.unsignedRevealPsbtBase64.length}`);
        console.log(`[DEBUG:createSignedRevealPsbt] - Network: ${params.network.bech32}`);
        
        // Analyze WIF key (safest way without exposing private data)
        if (params.revealSignerWif) {
            try {
                const keyPair = ECPair.fromWIF(params.revealSignerWif, params.network);
                const pubKeyBuffer = Buffer.from(keyPair.publicKey);
                console.log(`[DEBUG:createSignedRevealPsbt] - Derived public key length: ${pubKeyBuffer.length}`);
                console.log(`[DEBUG:createSignedRevealPsbt] - Derived public key prefix: ${pubKeyBuffer[0]}`);
                console.log(`[DEBUG:createSignedRevealPsbt] - Derived x-only pubkey: ${pubKeyBuffer.slice(1, 33).toString('hex')}`);
            } catch (keyError) {
                console.error(`[DEBUG:createSignedRevealPsbt] Error analyzing WIF key: ${keyError instanceof Error ? keyError.message : String(keyError)}`);
            }
        } else {
            console.error('[DEBUG:createSignedRevealPsbt] No WIF key provided!');
        }
        
        // Original function call with the same parameters
        return ordinalsLibrary.createSignedRevealPsbt(params);
    } catch (error) {
        console.error(`[DEBUG:createSignedRevealPsbt] Error calling library function: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
    }
} 
import { Utxo } from '../types';
// --- Import ResourceProvider interface and location type --- 
import { ResourceProvider, InscriptionRefWithLocation } from '../resources/providers/types';
// Removed direct provider imports

/**
 * Fetches UTXOs, including scriptPubKey, for a given Bitcoin address,
 * excluding UTXOs known to contain ordinal inscriptions (identified via a provided ResourceProvider).
 *
 * @param address The Bitcoin address to fetch UTXOs for.
 * @param provider An instance of ResourceProvider capable of fetching inscription locations.
 * @param network The network ('mainnet' or 'testnet'). Defaults to 'mainnet'.
 * @returns A promise that resolves to an array of UTXOs suitable for spending (non-ordinal).
 * @throws Error if fetching fails or the address/provider is invalid.
 */
export async function getAddressUtxos(
    address: string, 
    provider: ResourceProvider, // Accept provider as argument
    network: 'mainnet' | 'testnet' | 'signet' = 'mainnet'
): Promise<Utxo[]> {
    if (!address) {
        throw new Error('Address is required.');
    }
    if (!provider || typeof provider.getInscriptionLocationsByAddress !== 'function') {
        // Basic check to ensure a valid provider with the required method is passed
        throw new Error('A valid ResourceProvider instance with getInscriptionLocationsByAddress method is required.');
    }

    // --- Remove Ordiscan API Key Check and direct instantiation --- 
    /*
    const ordiscanApiKey = process.env.ORDISCAN_API_KEY;
    if (!ordiscanApiKey) { ... }
    const ordiscanOptions: OrdiscanProviderOptions = { apiKey: ordiscanApiKey };
    const ordiscanProvider = new OrdiscanProvider(ordiscanOptions);
    */

    // --- Use passed-in provider --- 
    const baseMempoolUrl = network === 'testnet'
        ? 'https://mempool.space/testnet/api'
        : network === 'signet'
            ? 'https://mempool.space/signet/api'
            : 'https://mempool.space/api';
    const utxoListUrl = `${baseMempoolUrl}/address/${address}/utxo`;

    console.log(`[getAddressUtxos] Fetching base UTXO list from: ${utxoListUrl}`);
    console.log(`[getAddressUtxos] Fetching ordinal locations using provided ResourceProvider for address ${address}...`);

    try {
        // --- Fetch Ordinal Locations (Provider) and UTXOs (Mempool) in Parallel ---
        const [utxoResponse, inscriptionLocationsResult] = await Promise.all([
            fetch(utxoListUrl),
            provider.getInscriptionLocationsByAddress(address) // Use the passed-in provider
        ]);

        // 1. Process Ordinal Locations from Provider
        const ordinalLocations = new Set<string>();
        console.log(`[getAddressUtxos] Received ${inscriptionLocationsResult.length} inscription locations from provider.`);
        inscriptionLocationsResult.forEach(inscriptionRef => {
            ordinalLocations.add(inscriptionRef.location);
        });
        console.log(`[getAddressUtxos] Identified ${ordinalLocations.size} unique ordinal locations.`);

        // 2. Process Basic UTXO list from Mempool
        if (!utxoResponse.ok) {
            let errorBody = '';
            try { errorBody = await utxoResponse.text(); } catch {}
            throw new Error(`Mempool API error (UTXO list) ${utxoResponse.status}: ${errorBody || utxoResponse.statusText}`);
        }
        const basicUtxos = await utxoResponse.json() as { txid: string; vout: number; value: number; status: any }[];

        if (!basicUtxos || basicUtxos.length === 0) {
            console.log(`[getAddressUtxos] No basic UTXOs found for address ${address} on ${network}.`);
            return [];
        }
        console.log(`[getAddressUtxos] Found ${basicUtxos.length} basic UTXOs from Mempool. Filtering ordinals and fetching scriptPubKeys...`);

        // 3. Fetch full transaction details for each UTXO (to get scriptPubKey) and filter ordinals
        const enrichedUtxosPromises = basicUtxos.map(async (basicUtxo): Promise<Utxo | null> => {
            const utxoLocationKey = `${basicUtxo.txid}:${basicUtxo.vout}`;
            if (ordinalLocations.has(utxoLocationKey)) {
                console.log(`[getAddressUtxos] Filtering ordinal UTXO: ${utxoLocationKey} (found in provider results)`);
                return null; // Skip this UTXO as it contains an ordinal
            }

            // Fetch TX details only if it's not an ordinal
            const txDetailUrl = `${baseMempoolUrl}/tx/${basicUtxo.txid}`;
            try {
                const txResponse = await fetch(txDetailUrl);
                if (!txResponse.ok) {
                    console.warn(`[getAddressUtxos] Failed to fetch TX details for ${basicUtxo.txid}. Status: ${txResponse.status}`);
                    return null; // Skip this UTXO if TX details fail
                }
                const txDetails = await txResponse.json();

                const txDetailsTyped = txDetails as { vout: any[] };
                const output = (txDetailsTyped && Array.isArray(txDetailsTyped.vout)) ? txDetailsTyped.vout[basicUtxo.vout] : undefined;
                const scriptPubKey = output?.scriptpubkey;

                if (scriptPubKey) {
                    return {
                        txid: basicUtxo.txid,
                        vout: basicUtxo.vout,
                        value: basicUtxo.value,
                        scriptPubKey: scriptPubKey,
                        status: basicUtxo.status
                    };
                } else {
                    console.warn(`[getAddressUtxos] scriptpubkey not found for output ${basicUtxo.vout} in TX ${basicUtxo.txid}. Output data:`, output);
                    return null;
                }
            } catch (txError) {
                console.warn(`[getAddressUtxos] Error fetching/processing TX details for ${basicUtxo.txid}:`, txError);
                return null;
            }
        });

        const results = await Promise.all( enrichedUtxosPromises );
        const utxos: Utxo[] = results.filter((utxo): utxo is Utxo => utxo !== null);

        console.log(`[getAddressUtxos] Successfully enriched ${utxos.length} spendable (non-ordinal) UTXOs for address ${address} on ${network}.`);
        return utxos;

    } catch (error) {
        console.error(`[getAddressUtxos] Error during UTXO/Ordinal fetching process for ${address} on ${network}:`, error);
        if (error instanceof Error) {
            throw new Error(`Failed to fetch UTXOs or check ordinals: ${error.message}`);
        } else {
            throw new Error(`Failed to fetch UTXOs or check ordinals: ${String(error)}`);
        }
    }
}
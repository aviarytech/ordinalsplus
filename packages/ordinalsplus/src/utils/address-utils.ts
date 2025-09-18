import type { Utxo } from '../types';
// --- Import ResourceProvider interface and location type --- 
import { ResourceProvider } from '../resources/providers/types';
// Removed direct provider imports
import { fetchWithTimeout } from './fetch-utils';

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
    console.log(`[getAddressUtxos] Fetching outputs for address ${address} on ${network}...`);

    try {
        // Try provider first (Ord node with address index)
        let outputs: string[] = [];
        try {
            outputs = await provider.getAddressOutputs(address);
        } catch (primaryErr) {
            console.warn(`[getAddressUtxos] provider.getAddressOutputs failed, attempting Esplora fallback:`, primaryErr);
        }

        // Fallback: use Esplora to enumerate address UTXOs when Ord node lacks --index-addresses
        if (!outputs || outputs.length === 0) {
            const esploraBase = network === 'mainnet'
                ? 'https://mempool.space/api'
                : network === 'testnet'
                    ? 'https://mempool.space/testnet/api'
                    : 'https://mempool.space/signet/api';
            const url = `${esploraBase}/address/${address}/utxo`;
            console.log(`[getAddressUtxos] Fetching UTXOs from Esplora: ${url}`);
            type EsploraUtxo = { txid: string; vout: number; value: number };
            const resp = await fetchWithTimeout<EsploraUtxo[]>(url, { timeout: 8000, headers: { 'Accept': 'application/json' } });
            console.log(`[getAddressUtxos] Esplora response:`, resp, url);
            const esploraUtxos = resp.data || [];
            outputs = esploraUtxos.map(u => `${u.txid}:${u.vout}`);
        }

        if (!outputs || outputs.length === 0) {
            console.log(`[getAddressUtxos] No outputs found for address ${address}.`);
            return [];
        }

        // For each output, fetch details, filter out spent or ordinal-bearing outputs
        const utxoPromises = outputs.map(async (out: string): Promise<Utxo | null> => {
            try {
                const [txid, voutStr] = out.split(':');
                const vout = parseInt(voutStr, 10);
                console.log(`[getAddressUtxos] Fetching output details for ${out}`);
                const details = await provider.getOutputDetails(out);
                if (details.spent) {
                    return null;
                }
                if (Array.isArray(details.inscriptions) && details.inscriptions.length > 0) {
                    return null;
                }

                return {
                    txid,
                    vout,
                    value: details.value,
                    scriptPubKey: details.script_pubkey,
                } as Utxo;
            } catch (e) {
                console.warn(`[getAddressUtxos] Failed to fetch/process output ${out}:`, e);
                return null;
            }
        });

        const results = await Promise.all(utxoPromises);
        const utxos: Utxo[] = results.filter((u): u is Utxo => u !== null);

        console.log(`[getAddressUtxos] Prepared ${utxos.length} spendable (non-ordinal) UTXOs for address ${address}.`);
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
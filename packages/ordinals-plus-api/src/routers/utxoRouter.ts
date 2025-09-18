import { Elysia, t } from 'elysia';
import { getProvider } from '../services/providerService';
import type { NetworkType } from '../types';
import { getAddressUtxos, type ResourceProvider } from 'ordinalsplus';

export const utxoRouter = new Elysia({ prefix: '/api' })
    // --- UTXO Route ---
    .get('/addresses/:address/utxos', async ({ params, query, set }) => {
        const { address } = params;
        const network = query.network || 'mainnet'; // Default to mainnet if undefined

        if (!address) {
            set.status = 400;
            throw new Error('Address parameter is required.');
        }
        console.log(`[API] Received GET /api/addresses/${address}/utxos request for network ${network}`);

        try {
            // Get the correct network type from the query param
            const networkForLib: NetworkType = network === 'signet' ? 'signet'
                                         : network === 'testnet' ? 'testnet'
                                         : 'mainnet';
            const provider = getProvider(networkForLib);
            if (!provider) {
                throw new Error('Resource provider not available or configured.');
            }
            
            console.log(`[API] Using provider: ${provider.constructor?.name || 'Unknown Provider'}`);

            console.log(`[API] Calling getAddressUtxos for network: ${networkForLib}`);
            // Cast provider to ResourceProvider to bypass type error
            const utxos = await getAddressUtxos(address, provider as ResourceProvider, networkForLib);
            
            console.log(`[API] Found ${utxos.length} UTXOs for address ${address}.`);
            return { data: utxos };
        } catch (error) {
            console.error(`[API] Error fetching UTXOs for ${address}:`, error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error fetching UTXOs';
            throw new Error(errorMessage);
        }
    }, {
        params: t.Object({
            address: t.String({ description: 'Bitcoin address' })
        }),
        query: t.Object({
            network: t.Optional(t.Union([
                t.Literal('mainnet'),
                t.Literal('signet'),
                t.Literal('testnet')
            ], { default: 'mainnet' }))
        }),
        response: {
            // Match the expected response structure
            200: t.Object({
                data: t.Array(t.Object({
                    txid: t.String(),
                    vout: t.Number(),
                    value: t.Number(),
                    scriptPubKey: t.Optional(t.String())
                }))
            }),
        },
        detail: {
            summary: 'Get UTXOs for an Address',
            description: 'Retrieves the unspent transaction outputs (UTXOs) for a given Bitcoin address.',
            tags: ['Address Information']
        }
    })
    // --- Address Inscriptions Route ---
    .get('/addresses/:address/inscriptions', async ({ params, query, set }) => {
        const { address } = params;
        const network = query.network || 'mainnet';

        if (!address) {
            set.status = 400;
            throw new Error('Address parameter is required.');
        }
        console.log(`[API] Received GET /api/addresses/${address}/inscriptions request for network ${network}`);

        try {
            const networkForLib: NetworkType = network === 'signet' ? 'signet'
                                         : network === 'testnet' ? 'testnet'
                                         : 'mainnet';
            const provider = getProvider(networkForLib);
            if (!provider) {
                throw new Error('Resource provider not available or configured.');
            }
            console.log(`[API] Using provider: ${provider.constructor?.name || 'Unknown Provider'}`);

            if (!('getInscriptionLocationsByAddress' in provider) || typeof (provider as any).getInscriptionLocationsByAddress !== 'function') {
                throw new Error('Provider does not support getInscriptionLocationsByAddress method.');
            }

            const locations = await (provider as any).getInscriptionLocationsByAddress(address) as Array<{ id: string; location: string }>;
            const data = locations.map(l => ({ id: l.id, owner_output: l.location }));
            console.log(`[API] Found ${data.length} inscriptions for address ${address}.`);
            return { data };
        } catch (error) {
            console.error(`[API] Error fetching inscriptions for ${address}:`, error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error fetching inscriptions';
            throw new Error(errorMessage);
        }
    }, {
        params: t.Object({
            address: t.String({ description: 'Bitcoin address' })
        }),
        query: t.Object({
            network: t.Optional(t.Union([
                t.Literal('mainnet'),
                t.Literal('signet'),
                t.Literal('testnet')
            ], { default: 'mainnet' }))
        }),
        response: {
            200: t.Object({
                data: t.Array(t.Object({
                    id: t.String(),
                    owner_output: t.String()
                }))
            })
        },
        detail: {
            summary: 'Get inscriptions for an address',
            description: 'Returns inscriptions owned by the address, with their current owner_output outpoint.',
            tags: ['Address Information']
        }
    })
    // --- UTXO Sat Number Route ---
    .get('/utxo/:utxo/sat-number', async ({ params, query, set }) => {
        const { utxo } = params;
        const network = query.network || 'mainnet';

        if (!utxo) {
            set.status = 400;
            throw new Error('UTXO parameter is required.');
        }
        // Decode URL-encoded UTXO (e.g., txid%3Avout → txid:vout)
        const decodedUtxo = (() => { try { return decodeURIComponent(utxo); } catch { return utxo; } })();
        console.log(`[API] Received GET /api/utxo/${decodedUtxo}/sat-number request for network ${network}`);

        try {
            const provider = getProvider(network);
            if (!provider) {
                throw new Error('Resource provider not available or configured.');
            }
            
            console.log(`[API] Using provider: ${provider.constructor?.name || 'Unknown Provider'}`);

            // Check if provider has getSatNumber method
            if (!('getSatNumber' in provider) || typeof provider.getSatNumber !== 'function') {
                throw new Error('Provider does not support getSatNumber method.');
            }

            const satNumber = await provider.getSatNumber(decodedUtxo);
            
            console.log(`[API] Found sat number ${satNumber} for UTXO ${decodedUtxo}.`);
            return { data: { satNumber } };
        } catch (error) {
            console.error(`[API] Error fetching sat number for UTXO ${decodedUtxo}:`, error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error fetching sat number';
            throw new Error(errorMessage);
        }
    }, {
        params: t.Object({
            utxo: t.String({ description: 'UTXO in format txid:vout' })
        }),
        query: t.Object({
            network: t.Optional(t.Union([
                t.Literal('mainnet'),
                t.Literal('signet'),
                t.Literal('testnet')
            ], { default: 'mainnet' }))
        }),
        response: {
            200: t.Object({
                data: t.Object({
                    satNumber: t.Number()
                })
            }),
        },
        detail: {
            summary: 'Get Sat Number for a UTXO',
            description: 'Retrieves the first sat number from a UTXO\'s sat ranges.',
            tags: ['UTXO Information']
        }
    }); 
import { Elysia } from 'elysia';
import { getProvider } from '../services/providerService';
import { BtcoDidResolver } from 'ordinalsplus';

/**
 * DID Router - handles DID resolution endpoints with enhanced resolver
 */
export const didRouter = new Elysia({ prefix: '/api/dids' })
    .get('/:did/resolve', async ({ params, query }) => {
        // Decode the URL-encoded DID parameter
        const did = decodeURIComponent(params.did);
        
        console.log(`[DID Router] Resolving DID: ${did}`);
        
        const didService = new BtcoDidResolver();
        return await didService.resolve(did);
    }, {
        detail: {
            summary: 'Resolve DID',
            description: 'Resolves a DID to its content (DID document, credential, or other) using the enhanced BTCO DID resolver',
            tags: ['DID'],
            params: {
                did: 'The DID to resolve (e.g., did:btco:12345 or did:btco:sig:67890)'
            },
            query: {
                network: 'The Bitcoin network (mainnet, testnet, signet). Defaults to mainnet.',
                contentType: 'Expected content type: "did-document", "credential", or omit for auto-detection'
            }
        }
    })
    .get('/:did/resources', async ({ params, query }) => {
        // Decode the URL-encoded DID parameter
        const did = decodeURIComponent(params.did);
        const { network = 'mainnet' } = query;
        
        console.log(`[DID Router] Getting resources for DID: ${did} on network: ${network}`);
        
        try {
            // Get the appropriate provider for the network
            const provider = getProvider(network as string);
            if (!provider) {
                return {
                    status: 'error',
                    message: `No provider available for network: ${network}`,
                    data: null
                };
            }

            // Resolve collection/resources for the DID
            const resources = await provider.resolveCollection(did, {
                limit: 50 // Default limit, could be parameterized
            });

            return {
                status: 'success',
                data: {
                    did,
                    resources,
                    count: resources.length
                }
            };
        } catch (error) {
            console.error(`[DID Router] Error getting resources for DID ${did}:`, error);
            return {
                status: 'error',
                message: error instanceof Error ? error.message : 'Failed to get resources',
                data: null
            };
        }
    }, {
        detail: {
            summary: 'Get DID Resources',
            description: 'Gets all resources associated with a DID',
            tags: ['DID'],
            params: {
                did: 'The DID to get resources for'
            },
            query: {
                network: 'The Bitcoin network (mainnet, testnet, signet). Defaults to mainnet.'
            }
        }
    }); 
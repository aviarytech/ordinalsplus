import { Elysia, t } from 'elysia';
import { 
    getFeeEstimates, 
    getTransactionStatus 
} from '../controllers/inscriptionsController';
import { extractCborMetadata } from 'ordinalsplus';
import { getProvider } from '../services/providerService';
import { prepareInscriptionForFunding } from '../controllers/inscriptionsController';
import { env } from '../config/envConfig';

import type { 
    CreatePsbtsRequest,
    NetworkType
} from '../types';

// Extend the Inscription interface to include metadata
interface InscriptionWithMetadata {
    id: string;
    sat: number;
    content_type?: string;
    content_url: string;
    metadata?: Uint8Array;
}

export const inscriptionRouter = new Elysia({ prefix: '/api' })
    // --- Fee Estimation Endpoint ---
    .get('/fees', async ({ query }) => {
        const network = query.network as NetworkType || 'mainnet';
        return await getFeeEstimates(network);
    }, {
        query: t.Object({
            network: t.Optional(t.String({ default: 'mainnet', description: 'Network name (mainnet, signet, testnet)' }))
        }),
        response: {
            200: t.Object({
                low: t.Number(),
                medium: t.Number(),
                high: t.Number()
            }),
        },
        detail: {
            summary: 'Get fee rate estimates',
            description: 'Retrieves current fee rate estimates (sat/vB) for different priority levels.',
            tags: ['Inscriptions']
        }
    })

    // --- Inscription Metadata Endpoint ---
    .get('/inscriptions/:inscriptionId/metadata', async ({ params, query, set }) => {
        const { inscriptionId } = params;
        const network = (query.network as NetworkType) || 'mainnet';
        
        if (!inscriptionId) {
            set.status = 400;
            return {
                error: 'Missing inscription ID'
            };
        }

        try {
            // Get the appropriate provider for the network
            const provider = getProvider(network);
            if (!provider) {
                set.status = 500;
                return {
                    error: `No provider available for network: ${network}`
                };
            }
            console.log('inscriptionId', inscriptionId);

            // Get inscription basic info first
            const inscription = await provider.resolveInscription(inscriptionId);
            if (!inscription) {
                set.status = 404;
                return {
                    error: `Inscription ${inscriptionId} not found`
                };
            }

            // For ord node provider, we need to fetch the inscription content directly
            // and parse it for CBOR metadata since the basic API doesn't include metadata
            try {
                // Fetch the raw inscription content to look for CBOR metadata
                const overrideBase = env.CONTENT_ORD_NODE_URL || undefined;
                const contentUrl = overrideBase && inscription.content_url
                  ? inscription.content_url.replace(/^(https?:\/\/[^/]+)(?=\/content\/)/, overrideBase)
                  : inscription.content_url;
                console.log(`[inscriptionRouter] Fetching inscription content for ${inscriptionId} from ${contentUrl}`);
                const contentResponse = await fetch(contentUrl);
                if (!contentResponse.ok) {
                    throw new Error(`Failed to fetch inscription content: ${contentResponse.status}`);
                }

                // Get the raw content as bytes
                const contentBuffer = await contentResponse.arrayBuffer();
                const contentBytes = new Uint8Array(contentBuffer);

                // Try to extract CBOR metadata from the content
                // For now, we'll check if the content appears to be CBOR encoded
                let decodedMetadata = null;
                let rawMetadata = null;
                let hasMetadata = false;

                // Check if the content might be CBOR metadata itself
                try {
                    if (inscription.content_type === 'application/cbor' || 
                        inscription.content_type === 'application/octet-stream') {
                        decodedMetadata = extractCborMetadata(contentBytes);
                        if (decodedMetadata !== null) {
                            rawMetadata = contentBytes;
                            hasMetadata = true;
                        }
                    }
                } catch (error) {
                    console.warn(`Failed to decode potential CBOR content for inscription ${inscriptionId}:`, error);
                }

                // If we didn't find CBOR metadata in the content, check if we can get it from the ord node
                if (!hasMetadata) {
                    // For now, we'll return that no metadata was found
                    // In the future, we could implement a more sophisticated approach
                    // to extract metadata from the inscription envelope data
                    set.status = 404;
                    return {
                        error: 'No CBOR metadata found for this inscription',
                        details: {
                            inscriptionId,
                            contentType: inscription.content_type,
                            message: 'The inscription exists but does not contain CBOR metadata or metadata extraction is not yet supported through this provider'
                        }
                    };
                }

                return {
                    inscriptionId,
                    hasMetadata: true,
                    metadata: decodedMetadata,
                    rawMetadata: rawMetadata ? Array.from(rawMetadata) : undefined, // Convert Uint8Array to regular array for JSON, handle null case
                    contentType: inscription.content_type
                };

            } catch (contentError) {
                console.error(`Error fetching content for inscription ${inscriptionId}:`, contentError);
                set.status = 500;
                return {
                    error: `Failed to fetch inscription content: ${contentError instanceof Error ? contentError.message : 'Unknown error'}`
                };
            }

        } catch (error) {
            console.error(`Error fetching metadata for inscription ${inscriptionId}:`, error);
            set.status = 500;
            return {
                error: `Failed to fetch metadata: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }, {
        params: t.Object({
            inscriptionId: t.String({ minLength: 1, description: 'The inscription ID' })
        }),
        query: t.Object({
            network: t.Optional(t.String({ default: 'mainnet', description: 'Network name (mainnet, signet, testnet)' }))
        }),
        response: {
            200: t.Object({
                inscriptionId: t.String(),
                hasMetadata: t.Boolean(),
                metadata: t.Any(),
                rawMetadata: t.Optional(t.Array(t.Number())),
                contentType: t.Optional(t.String())
            }),
            400: t.Object({
                error: t.String()
            }),
            404: t.Object({
                error: t.String(),
                details: t.Optional(t.Any())
            }),
            500: t.Object({
                error: t.String()
            })
        },
        detail: {
            summary: 'Get inscription metadata',
            description: 'Retrieves and decodes CBOR metadata from an inscription. Currently supports inscriptions where the entire content is CBOR encoded.',
            tags: ['Inscriptions']
        }
    })

    // --- Transaction Status Endpoint ---
    .get('/transactions/:txid/status', async ({ params }) => {
        return await getTransactionStatus(params.txid);
    }, {
        params: t.Object({
            txid: t.String({ minLength: 64, maxLength: 64, description: 'Transaction ID to check' })
        }),
        response: {
            200: t.Object({
                status: t.Union([
                    t.Literal('pending'),
                    t.Literal('confirmed'),
                    t.Literal('failed'),
                    t.Literal('not_found')
                ]),
                blockHeight: t.Optional(t.Number()),
                inscriptionId: t.Optional(t.String())
            })
        },
        detail: {
            summary: 'Get transaction status',
            description: 'Checks the status of a transaction.',
            tags: ['Inscriptions']
        }
    })

    // --- Create Inscription PSBTs Endpoint ---
    .post('/inscriptions/commit', async ({ body, set }) => {
        try {
            console.log('[inscriptionRouter] Creating Inscription PSBTs...');
            
            // For now, we'll just return an error since the prepareInscriptionForFunding function
            // expects different parameters than what we're providing
            set.status = 501;
            return {
                error: 'Inscription PSBT creation is not yet implemented. The function signature needs to be updated to match the expected interface.'
            };
            
        } catch (error) {
            console.error('[inscriptionRouter] Error creating inscription PSBTs:', error);
            set.status = 500;
            return {
                error: `Failed to create inscription PSBTs: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }, {
        body: t.Object({
            contentType: t.String({ minLength: 1 }),
            contentBase64: t.String({ minLength: 1 }),
            feeRate: t.Number({ minimum: 1 }),
            recipientAddress: t.String({ minLength: 1 }),
            utxos: t.Array(
                t.Object({
                    txid: t.String({ minLength: 64, maxLength: 64 }),
                    vout: t.Number({ minimum: 0 }),
                    value: t.Number({ minimum: 546 }), // MIN_DUST
                    scriptPubKey: t.String({ minLength: 1 })
                }),
                { minItems: 1 }
            ),
            changeAddress: t.String({ minLength: 1 }),
            networkType: t.Optional(t.Union([
                t.Literal('mainnet'),
                t.Literal('signet'),
                t.Literal('testnet')
            ], { default: 'testnet' })),
            testMode: t.Optional(t.Boolean({ default: false }))
        }),
        response: {
            200: t.Object({
                commitPsbtBase64: t.String(),
                unsignedRevealPsbtBase64: t.String(),
                revealSignerWif: t.String(),
                commitTxOutputValue: t.Number(),
                revealFee: t.Number()
            }),
            500: t.Object({
                error: t.String()
            })
        },
        detail: {
            summary: 'Create Inscription PSBTs',
            description: 'Creates commit and reveal PSBTs for inscribing content on-chain.',
            tags: ['Inscriptions']
        }
    }); 
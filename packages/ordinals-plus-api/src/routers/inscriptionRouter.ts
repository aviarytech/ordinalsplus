import { Elysia, t } from 'elysia';
import { 
    getFeeEstimates, 
    getTransactionStatus 
} from '../controllers/inscriptionsController';

import type { 
    CreatePsbtsRequest,
    NetworkType
} from '../types';

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
    .post('/inscriptions/commit', async ({ body }) => {
        // Ensure networkType has a default value if undefined
        const request: CreatePsbtsRequest = {
            ...body,
            networkType: body.networkType || 'testnet'
        };
        console.log('[inscriptionRouter] Creating Inscription PSBTs...');
        const result = await prepareInscriptionForFunding(request);
        console.log('[inscriptionRouter] Inscription PSBTs created:', result);
        return result;
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
            })
        },
        detail: {
            summary: 'Create Inscription PSBTs',
            description: 'Creates commit and reveal PSBTs for inscribing content on-chain.',
            tags: ['Inscriptions']
        }
    }); 
import { Elysia, t } from 'elysia';
import { 
    getAllResources, 
    getResourceById, 
    getResourcesByDid
} from '../controllers/resourcesController';


export const resourceRouter = new Elysia({ prefix: '/api' })
    // --- Get All Resources (Paginated) ---
    .get('/resources', async ({ query }) => {
        console.log(`[Route] GET /api/resources with query:`, query);
        const options = {
            network: query.network,
            page: query.page,
            limit: query.limit,
            contentType: query.contentType
        };
        return await getAllResources(options);
    }, {
        query: t.Object({
            network: t.String({ default: 'mainnet', description: 'Network type (mainnet, signet)' }),
            page: t.Numeric({ default: 1, minimum: 1 }),
            limit: t.Numeric({ default: 20, minimum: 1, maximum: 100 }),
            contentType: t.Optional(t.String({ minLength: 1 }))
        }),
        response: {
            200: t.Object({
                linkedResources: t.Array(t.Any()), // Use t.Any() for now
                page: t.Optional(t.Number()),
                totalItems: t.Optional(t.Number()),
                itemsPerPage: t.Optional(t.Number())
            }),
        },
        detail: {
            summary: 'Get All Resources',
            description: 'Retrieves a paginated list of all resources/inscriptions.',
            tags: ['Resources']
        }
    })

    // --- Get Resource By ID ---
    .get('/resources/:id', async ({ params }) => {
        return await getResourceById(params.id);
    }, {
        params: t.Object({
            id: t.String({ minLength: 1, description: 'Resource ID or DID' })
        }),
        response: {
            200: t.Object({
                linkedResources: t.Array(t.Any()),
                page: t.Optional(t.Number()),
                totalItems: t.Optional(t.Number()),
                itemsPerPage: t.Optional(t.Number())
            }),
        },
        detail: {
            summary: 'Get Resource by ID',
            description: 'Retrieves a specific resource by its ID.',
            tags: ['Resources']
        }
    })
    
    // --- Get Resources by DID ---
    .get('/resources/did/:did', async ({ params }) => {
        return await getResourcesByDid(params.did);
    }, {
        params: t.Object({
            did: t.String({ minLength: 1, description: 'DID to fetch resources for' })
        }),
        response: {
            200: t.Object({
                linkedResources: t.Array(t.Any()),
                page: t.Optional(t.Number()),
                totalItems: t.Optional(t.Number()),
                itemsPerPage: t.Optional(t.Number())
            }),
        },
        detail: {
            summary: 'Get Resources by DID',
            description: 'Retrieves all resources associated with a specific DID.',
            tags: ['Resources']
        }
    })
    
    // --- Create Resource ---
    // .post('/resources', async ({ body }) => {
    //     // Cast the body to ResourceCreationParams since we've verified it matches the schema
    //     return await createResourcePsbt(body as ResourceCreationParams);
    // }, {
    //     body: t.Object({
    //         content: t.String({ minLength: 1 }),
    //         contentType: t.String({ minLength: 1 }),
    //         resourceType: t.String({ minLength: 1 }),
    //         publicKey: t.Any(), // This will need proper handling
    //         changeAddress: t.String({ minLength: 1 }),
    //         recipientAddress: t.String({ minLength: 1 }),
    //         utxos: t.Array(
    //             t.Object({
    //                 txid: t.String({ minLength: 64, maxLength: 64 }),
    //                 vout: t.Number({ minimum: 0 }),
    //                 value: t.Number({ minimum: 546 }), // MIN_DUST
    //                 scriptPubKey: t.String({ minLength: 1 })
    //             }),
    //             { minItems: 1 }
    //         ),
    //         feeRate: t.Number({ minimum: 1 }),
    //         network: t.Union([
    //             t.Literal('mainnet'),
    //             t.Literal('signet'),
    //             t.Literal('testnet')
    //         ]),
    //         metadata: t.Optional(t.Record(t.String(), t.String()))
    //     }),
    //     response: {
    //         200: t.Object({
    //             commitPsbtBase64: t.String(),
    //             revealPsbtBase64: t.String(),
    //             estimatedFees: t.Number(),
    //             resourceId: t.Optional(t.String())
    //         })
    //     },
    //     detail: {
    //         summary: 'Create Resource',
    //         description: 'Creates a new resource and returns PSBTs for broadcasting.',
    //         tags: ['Resources']
    //     }
    // }); 
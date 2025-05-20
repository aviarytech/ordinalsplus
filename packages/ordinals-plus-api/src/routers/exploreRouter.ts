import { Elysia, t } from 'elysia';
import { getAllResources } from '../controllers/resourcesController';
import { getInscriptionDetails } from '../services/inscriptionService';
import type { ApiResponse } from '../types';

export const exploreRouter = new Elysia({ prefix: '/api' })
    // --- Legacy exploration endpoint ---
    .get('/explore', async ({ query }) => {
        console.log(`[Route] GET /api/explore with query:`, query);
        const options = {
            network: query.network,
            page: query.page,
            limit: query.limit,
            contentType: query.contentType
        };
        const result: ApiResponse = await getAllResources(options);
        return result;
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
            summary: 'Explore All Linked Resources (Legacy)',
            description: 'Retrieves a paginated list of all linked resources, optionally filtered by content type and network.',
            tags: ['Resource Management', 'Exploration']
        }
    })
    
    // --- Fetch Inscription Details ---
    .get('/inscription/:inscriptionId', async ({ params, set }) => {
        console.log(`[Route] GET /inscription/${params.inscriptionId}`);
        const details = await getInscriptionDetails(params.inscriptionId);
        set.status = 200;
        return details;
    }, {
        params: t.Object({
            inscriptionId: t.String({ minLength: 1, description: 'The inscription ID' })
        }),
        response: {
            200: t.Object({
                inscriptionId: t.String(),
                contentType: t.String(),
                contentBase64: t.String(),
                contentLength: t.Number()
            }),
        },
        detail: {
            summary: 'Fetch Inscription Details by ID',
            description: 'Retrieves the raw content (Base64 encoded) and content type for a specific inscription directly from the Ord node.',
            tags: ['Inscription Fetching'],
        }
    }); 
import { Elysia, t } from 'elysia';
import { resourceManager } from '../services/resourceManager';

const ORD_SERVER_URL = process.env.ORD_SERVER_URL || 'http://localhost:80';

export const indexerRouter = new Elysia({ prefix: '/api/indexer' })
  /**
   * GET /indexer/ordinals-plus
   * Get all Ordinals Plus inscriptions from the indexer cache in reverse chronological order
   */
  .get('/ordinals-plus', async ({ query }) => {
    try {
      const contentNodeUrl = process.env.CONTENT_ORD_NODE_URL ? process.env.CONTENT_ORD_NODE_URL : ORD_SERVER_URL;
      const page = parseInt(query.page as string) || 1;
      const limit = Math.min(parseInt(query.limit as string) || 50, 100); // Max 100 per page
      const sort = (query.sort as string) === 'asc' ? 'asc' : 'desc';
      const networkFilter = typeof query.network === 'string' ? query.network.toLowerCase() : undefined; // 'mainnet' | 'signet' | 'testnet'
      
      // Calculate pagination
      const totalCount = await resourceManager.getOrdinalsCount();
      const totalPages = Math.ceil(totalCount / limit);
      // Load ALL items to enable global sort by mined block, then paginate
      const allInscriptionData = await resourceManager.getOrdinalsWithData(0, totalCount, sort as any);
      
      // Transform to API response format expected by the UI
      console.log(`contentNodeUrl ${contentNodeUrl}`);
      const baseInscriptions = allInscriptionData.map((resource: any) => ({
        inscriptionId: resource.inscriptionId,
        inscriptionNumber: resource.inscriptionNumber,
        resourceId: resource.resourceId, // This is the DID path (did:btco:123/0 or did:btco:sig:123/0)
        ordinalsType: resource.ordinalsType,
        contentType: resource.contentType,
        network: resource.network,
        indexedAt: resource.indexedAt,
        indexedBy: resource.indexedBy,
        blockHeight: resource.blockHeight,
        blockTimestamp: resource.blockTimestamp,
        contentUrl: `${contentNodeUrl}/content/${resource.inscriptionId}`,
        inscriptionUrl: `${contentNodeUrl}/inscription/${resource.inscriptionId}`,
        metadataUrl: `${contentNodeUrl}/r/metadata/${resource.inscriptionId}`
      }));

      // Final ordering strictly by mined block height (global)
      const inscriptions = baseInscriptions.sort((a: any, b: any) => {
        const ha = typeof a.blockHeight === 'number' ? a.blockHeight : null;
        const hb = typeof b.blockHeight === 'number' ? b.blockHeight : null;
        if (ha !== null && hb !== null) {
          return sort === 'asc' ? ha - hb : hb - ha;
        }
        // Push unknown heights to the end regardless of sort
        if (ha !== null && hb === null) return -1;
        if (ha === null && hb !== null) return 1;
        return 0;
      });
      
      // Paginate after global sort
      const start = (page - 1) * limit;
      const end = Math.min(start + limit, inscriptions.length);
      const pageInscriptions = inscriptions.slice(start, end);
      
      // Get indexer stats
      const stats = await resourceManager.getStats();
      // Try to get current block height from ORD server if available
      let blockHeight: number | null = null;
      try {
        const resp = await fetch(`${ORD_SERVER_URL}/blockheight`);
        if (resp.ok) {
          const txt = await resp.text();
          const h = parseInt(txt, 10);
          if (!Number.isNaN(h)) blockHeight = h;
        }
      } catch (_) {
        // ignore
      }
      
      return {
        success: true,
        data: {
          inscriptions: pageInscriptions,
          pagination: {
            page,
            limit,
            // Report counts based on filtered view when a filter is applied
            total: (networkFilter ? allInscriptionData.length : totalCount),
            totalPages: Math.ceil((networkFilter ? allInscriptionData.length : totalCount) / limit),
            hasNext: page < totalPages,
            hasPrev: page > 1
          },
          stats: {
            totalOrdinalsPlus: totalCount,
            lastUpdated: stats?.lastUpdated ? new Date(stats.lastUpdated).toISOString() : null,
            indexerVersion: process.env.npm_package_version || 'unknown',
            cursor: stats?.cursor ?? null,
            blockHeight
          }
        }
      };
    } catch (error) {
      console.error('Error fetching Ordinals Plus inscriptions:', error);
      return {
        success: false,
        error: `Failed to fetch Ordinals Plus inscriptions: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }, {
    query: t.Object({
      page: t.Optional(t.String()),
      limit: t.Optional(t.String()),
      sort: t.Optional(t.String()),
      network: t.Optional(t.String())
    }),
    detail: {
      summary: 'Get Ordinals Plus Inscriptions',
      description: 'Retrieve all Ordinals Plus inscriptions from the indexer cache. Use sort=desc (default) for reverse chronological, sort=asc for chronological order.',
      tags: ['Indexer']
    }
  })

  /**
   * GET /indexer/stats
   * Get indexer statistics and status
   */
  .get('/stats', async () => {
    try {
      const stats = await resourceManager.getStats();
      const totalCount = await resourceManager.getOrdinalsCount();
      // Try to get current block height from ORD server if available
      let blockHeight: number | null = null;
      try {
        const resp = await fetch(`${ORD_SERVER_URL}/blockheight`);
        if (resp.ok) {
          const txt = await resp.text();
          const h = parseInt(txt, 10);
          if (!Number.isNaN(h)) blockHeight = h;
        }
      } catch (_) {
        // ignore
      }
      
      return {
        success: true,
        data: {
          totalOrdinalsPlus: totalCount,
          totalProcessed: stats?.totalProcessed || 0,
          ordinalsFound: stats?.ordinalsFound || 0,
          errors: stats?.errors || 0,
          lastUpdated: stats?.lastUpdated ? new Date(stats.lastUpdated).toISOString() : null,
          indexerVersion: process.env.npm_package_version || 'unknown',
          cursor: stats?.cursor ?? null,
          blockHeight
        }
      };
    } catch (error) {
      console.error('Error fetching indexer stats:', error);
      return {
        success: false,
        error: `Failed to fetch indexer stats: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }, {
    detail: {
      summary: 'Get Indexer Statistics',
      description: 'Retrieve indexer statistics and status information',
      tags: ['Indexer']
    }
  })

  /**
   * GET /indexer/inscription/:id
   * Get details for a specific Ordinals Plus inscription
   */
  .get('/inscription/:id', async ({ params }) => {
    try {
      const { id } = params;
      const contentNodeUrl = process.env.CONTENT_ORD_NODE_URL ? process.env.CONTENT_ORD_NODE_URL : ORD_SERVER_URL;
      
      // Get resource data from our cache
      const resourceData = await resourceManager.getResourceData(id);
      
      if (!resourceData) {
        return {
          success: false,
          error: 'Inscription not found in Ordinals Plus index'
        };
      }
      
      // Fetch detailed information from ord server
      try {
        // Get inscription details
        const inscriptionResponse = await fetch(`${ORD_SERVER_URL}/inscription/${id}`, {
          headers: { 'Accept': 'application/json' }
        });
        
        if (!inscriptionResponse.ok) {
          throw new Error(`Failed to fetch inscription details: ${inscriptionResponse.status}`);
        }
        
        const inscriptionData = await inscriptionResponse.json();
        
        // Try to get metadata
        let metadata = null;
        try {
          const metadataResponse = await fetch(`${ORD_SERVER_URL}/r/metadata/${id}`, {
            headers: { 'Accept': 'application/json' }
          });
          if (metadataResponse.ok) {
            metadata = await metadataResponse.text(); // Raw CBOR hex
          }
        } catch (metadataError) {
          // Metadata is optional
          console.log(`No metadata available for inscription ${id}`);
        }
        
        return {
          success: true,
          data: {
            inscriptionId: id,
            inscriptionNumber: resourceData.inscriptionNumber,
            resourceId: resourceData.resourceId,
            ordinalsType: resourceData.ordinalsType,
            contentType: resourceData.contentType,
            network: resourceData.network,
            indexedAt: resourceData.indexedAt,
            indexedBy: resourceData.indexedBy,
            ordServerData: inscriptionData,
            metadata,
            urls: {
              content: `${contentNodeUrl}/content/${id}`,
              inscription: `${contentNodeUrl}/inscription/${id}`,
              metadata: `${contentNodeUrl}/r/metadata/${id}`
            }
          }
        };
        
      } catch (fetchError) {
        console.error(`Error fetching ord server data for ${id}:`, fetchError);
        return {
          success: false,
          error: `Failed to fetch inscription details from ord server: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`
        };
      }
      
    } catch (error) {
      console.error('Error fetching inscription details:', error);
      return {
        success: false,
        error: `Failed to fetch inscription details: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }, {
    params: t.Object({
      id: t.String()
    }),
    detail: {
      summary: 'Get Inscription Details',
      description: 'Get detailed information for a specific Ordinals Plus inscription',
      tags: ['Indexer']
    }
  }); 
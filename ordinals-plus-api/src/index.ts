import { Elysia, t } from 'elysia';
import { cors } from '@elysiajs/cors';
import { exploreDidsOrd } from './controllers/exploreController';
import { createLinkedResource } from './controllers/linkedResourcesController';
import { 
  getAllResources, 
  getResourceById, 
  getResourcesByDid 
} from './controllers/resourcesController';
import { getOrdNodeStatus } from './services/ordNodeProxyService';
import { getOrdiscanStatus } from './services/ordiscanProxyService';

const port = process.env.PORT || 3000;

// Create API server
const app = new Elysia()
  .use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }))
  .get('/', () => {
    return { 
      message: 'Ordinals Plus Explorer API',
      status: 'running',
      endpoints: [
        '/api/explore', 
        '/api/explore/:page',
        '/api/resources',
        '/api/resources/:id',
        '/api/resources/did/:didId',
        '/api/ord/status',
        '/api/ordiscan/status',
        '/status'
      ],
      version: '1.0.0'
    }
  })
  // Add a status endpoint for health checks
  .get('/status', () => {
    return { 
      status: 'ok',
      timestamp: new Date().toISOString(),
      message: 'API is running correctly'
    }
  })
  // Add Ord node status endpoint
  .get('/api/ord/status', async () => {
    console.log('Received request to GET /api/ord/status');
    
    try {
      const status = await getOrdNodeStatus();
      return status;
    } catch (error) {
      console.error('Error checking Ord node status:', error);
      return { 
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  })
  .get('/api/:server/status', async ({ params }) => {
    try {
      if (params.server === 'ord') {
        const status = await getOrdNodeStatus();
        return status;
      } else if (params.server === 'ordiscan') {
        const status = await getOrdiscanStatus();
        return status;
      } else {
        return {
          status: 'error',
          message: 'Invalid server parameter',
          error: 'Invalid server parameter. Must be "ord" or "ordiscan".'
        };
      }
    } catch (error) {
      console.error('Error checking Ord node status:', error);
      return { 
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  })
  // Legacy API endpoint (will be deprecated in favor of /resources)
  .get('/api/explore', async ({ query }) => {
    console.log('Received request to /api/explore');
    
    // Parse pagination parameters
    const page = Number(query?.page || 0);
    const itemsPerPage = Number(query?.size || 50);
    
    if (isNaN(page) || page < 0) {
      return {
        status: 'error',
        message: 'Invalid page parameter',
        data: {
          dids: [],
          linkedResources: [],
          error: 'Invalid page parameter. Must be a non-negative number.'
        }
      };
    }
    
    if (isNaN(itemsPerPage) || itemsPerPage < 1 || itemsPerPage > 300) {
      return {
        status: 'error',
        message: 'Invalid size parameter',
        data: {
          dids: [],
          linkedResources: [],
          error: 'Invalid size parameter. Must be a number between 1 and 300.'
        }
      };
    }
    
    if (!process.env.ORDISCAN_API_KEY) {
      console.warn('ORDISCAN_API_KEY is not set in environment variables');
      return {
        status: 'error',
        message: 'API key not configured',
        data: {
          dids: [],
          linkedResources: [],
          error: 'API key not configured. Please set the ORDISCAN_API_KEY environment variable.'
        }
      };
    }
    
    try {
      const result = await exploreDidsOrd(page, itemsPerPage);
      
      if (result.error) {
        console.error('Error in explore operation:', result.error);
        return {
          status: 'error',
          message: result.error,
          data: result
        };
      }
      
      console.log(`Successfully retrieved ${result.dids.length} DIDs and ${result.linkedResources.length} linked resources`);
      return {
        status: 'success',
        message: 'Exploration completed successfully',
        data: result
      };
    } catch (error) {
      console.error('Unexpected error in API:', error);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown server error',
        data: {
          dids: [],
          linkedResources: [],
          error: error instanceof Error ? error.message : 'Unknown server error'
        }
      };
    }
  })
  // New resources API endpoints
  .get('/api/resources', async ({ query }) => {
    console.log('Received request to GET /api/resources');
    
    // Parse pagination parameters
    const page = Number(query?.page || 0);
    const limit = Number(query?.limit || 50);
    
    // Validate pagination parameters
    if (isNaN(page) || page < 0) {
      return {
        status: 'error',
        message: 'Invalid page parameter',
        data: {
          error: 'Invalid page parameter. Must be a non-negative number.'
        }
      };
    }
    
    if (isNaN(limit) || limit < 1 || limit > 300) {
      return {
        status: 'error',
        message: 'Invalid limit parameter',
        data: {
          error: 'Invalid limit parameter. Must be a number between 1 and 300.'
        }
      };
    }
    
    try {
      // Get all resources using the resources controller
      const result = await getAllResources(page, limit);
      
      if (result.error) {
        return {
          status: 'error',
          message: result.error,
          data: result
        };
      }
      
      return {
        status: 'success',
        message: 'Resources retrieved successfully',
        data: result
      };
    } catch (error) {
      console.error('Error retrieving resources:', error);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
        data: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  })
  // IMPORTANT: More specific routes must come before generic routes with params
  // Get resources associated with a specific DID
  .get('/api/resources/did/:didId', async ({ params }) => {
    console.log(`Received request to GET /api/resources/did/${params.didId}`);
    
    try {
      // Get resources by DID
      const result = await getResourcesByDid(params.didId);
      
      if (result.error) {
        return {
          status: 'error',
          message: result.error,
          data: result
        };
      }
      
      return {
        status: 'success',
        message: 'DID resources retrieved successfully',
        data: result
      };
    } catch (error) {
      console.error(`Error retrieving resources for DID ${params.didId}:`, error);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
        data: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  })
  // Get direct content from a resource
  .get('/api/resources/:id/content', async ({ params }) => {
    console.log(`Received request to GET /api/resources/${params.id}/content`);
    
    try {
      // Get the resource by ID
      const result = await getResourceById(params.id);
      
      if (result.error || !result.linkedResources || result.linkedResources.length === 0) {
        return new Response('Resource not found', { status: 404 });
      }
      
      // Get the first resource
      const resource = result.linkedResources[0];
      
      // Ensure resource exists and has necessary properties
      if (!resource) {
        return new Response('Resource content not found', { status: 404 });
      }
      
      // Handle content based on its type
      if (resource.contentType && (
          resource.contentType.startsWith('image/') || 
          resource.contentType.startsWith('video/') ||
          resource.contentType.startsWith('audio/'))) {
        // Ensure we have an inscription ID
        if (!resource.inscriptionId) {
          return new Response('Resource inscription ID not found', { status: 404 });
        }
        
        // For binary content, fetch from the original source
        const contentUrl = `https://ordiscan.com/content/${resource.inscriptionId}`;
        
        try {
          const response = await fetch(contentUrl);
          
          if (!response.ok) {
            return new Response('Failed to fetch content', { status: response.status });
          }
          
          // Stream the content with the appropriate content type
          const contentBuffer = await response.arrayBuffer();
          return new Response(contentBuffer, {
            headers: {
              'Content-Type': resource.contentType,
              'Cache-Control': 'public, max-age=86400' // Cache for 24 hours
            }
          });
        } catch (error) {
          return new Response('Failed to fetch content', { status: 500 });
        }
      } else if (resource.content && typeof resource.content === 'object') {
        // For JSON content, return it directly
        return new Response(JSON.stringify(resource.content), {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
          }
        });
      } else {
        // For other content, return as text
        return new Response(String(resource.content || ''), {
          headers: {
            'Content-Type': resource.contentType || 'text/plain',
            'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
          }
        });
      }
    } catch (error) {
      console.error(`Error retrieving content for resource ${params.id}:`, error);
      return new Response('Error retrieving content', { status: 500 });
    }
  })
  // Get a specific resource by ID (could be a DID or inscription ID)
  .get('/api/resources/:id', async ({ params }) => {
    console.log(`Received request to GET /api/resources/${params.id}`);
    
    try {
      // Get the resource by ID
      const result = await getResourceById(params.id);
      
      if (result.error) {
        return {
          status: 'error',
          message: result.error,
          data: result
        };
      }
      
      return {
        status: 'success',
        message: 'Resource retrieved successfully',
        data: result
      };
    } catch (error) {
      console.error(`Error retrieving resource by ID ${params.id}:`, error);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
        data: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  })
  // Legacy endpoint to create a linked resource (will be updated to use the ordinalsplus package)
  .post('/api/resources', async ({ body }) => {
    console.log('Received request to create a linked resource');
    
    try {
      if (!body || typeof body !== 'object') {
        return {
          status: 'error',
          message: 'Invalid request body',
          data: {
            error: 'Request body must be a valid JSON object'
          }
        };
      }
      
      const resourceData = body as Record<string, unknown>;
      const didReference = typeof resourceData.didReference === 'string' 
        ? resourceData.didReference as string 
        : undefined;
      
      const resource = await createLinkedResource(resourceData, didReference);
      
      return {
        status: 'success',
        message: 'Resource created successfully',
        data: resource
      };
    } catch (error) {
      console.error('Error creating linked resource:', error);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        data: {
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        }
      };
    }
  })
  // Add network configuration endpoint
  .get('/api/networks', () => {
    const networks = [
      {
        id: 'mainnet',
        name: 'Bitcoin Mainnet',
        enabled: true, // Enable mainnet by default since we have ORDISCAN_API_KEY
        description: 'The main Bitcoin network'
      },
      {
        id: 'ordRegTestNode',
        name: 'Ord RegTest Node',
        enabled: !!process.env.ORD_NODE_URL, // Enable if ORD_NODE_URL is set
        description: 'Local Ord node for development'
      }
    ].filter(network => network.enabled);

    return {
      networks,
      defaultNetwork: networks[0]?.id || 'mainnet'
    };
  })
  // Add health endpoint
  .get('/api/health', async () => {
    try {
      // Check Ord node status
      const ordStatus = await getOrdNodeStatus();
      
      // Check Ordiscan status
      const ordiscanStatus = await getOrdiscanStatus();
      
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          ordNode: ordStatus.status === 'available',
          ordiscan: ordiscanStatus.status === 'available'
        },
        version: '1.0.0'
      };
    } catch (error) {
      console.error('Error checking health:', error);
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        services: {
          ordNode: false,
          ordiscan: false
        },
        version: '1.0.0'
      };
    }
  })
  .listen(port);

console.log(`⊕ Ordinals Plus Explorer API is running at http://localhost:${port}`);

export type App = typeof app; 

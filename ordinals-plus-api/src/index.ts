import { Elysia, t } from 'elysia';
import { cors } from '@elysiajs/cors';
import { 
  getAllResources, 
  getResourceById, 
  getResourcesByDid 
} from './controllers/resourcesController';
import { getOrdNodeStatus } from './services/ordNodeProxyService';
import { getOrdiscanStatus } from './services/ordiscanProxyService';
import { initializeProvider } from './services/providerService';
import type { LinkedResource } from './types';

const port = process.env.PORT || 3000;

// Initialize the provider
try {
    initializeProvider();
} catch (error) {
    console.error('Failed to initialize provider:', error);
    process.exit(1);
}

// Create API server
const app = new Elysia()
  .use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  }))
  .get('/', () => {
    return new Response('Ordinals Plus API', {
      headers: {
        'Content-Type': 'text/plain'
      }
    });
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
  // Add Ordiscan status endpoint
  .get('/api/ordiscan/status', async () => {
    console.log('Received request to GET /api/ordiscan/status');
    
    try {
      const status = await getOrdiscanStatus();
      return status;
    } catch (error) {
      console.error('Error checking Ordiscan status:', error);
      return { 
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  })
  // New resources API endpoints
  .get('/api/resources', async ({ query }) => {
    console.log('Received request to GET /api/resources');
    
    // Parse pagination parameters
    const page = Number(query?.page || 1);
    const limit = Number(query?.limit || 20);
    const contentType = query?.contentType || null;
    
    try {
      // Get all resources using the resources controller
      const result = await getAllResources(page, limit, contentType);
      
      if (result.error) {
        return {
          status: 'error',
          message: result.error,
          data: result
        };
      }

      return {
        status: 'success',
        data: result
      };
    } catch (error) {
      console.error('Error in /api/resources:', error);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
        data: null
      };
    }
  })
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
      }
      
      // For JSON content, return it directly
      if (resource.contentType === 'application/json') {
        return new Response(JSON.stringify(resource.content), {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
          }
        });
      }
      
      // For other content, return as text
      return new Response(String(resource.content || ''), {
        headers: {
          'Content-Type': resource.contentType || 'text/plain',
          'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
        }
      });
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
  // Add health endpoint
  .get('/health', async () => {
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

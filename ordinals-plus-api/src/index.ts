import { Elysia, t } from 'elysia';
import { cors } from '@elysiajs/cors';
import { exploreDidsBtco } from './controllers/exploreController';
import { createLinkedResource, getResourceByDid } from './controllers/linkedResourcesController';

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
      message: 'BTCO DID Explorer API',
      status: 'running',
      endpoints: [
        '/api/explore', 
        '/api/explore/:page',
        '/api/resources',
        '/api/resources/:didId'
      ],
      version: '1.0.0'
    }
  })
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
      const result = await exploreDidsBtco(page, itemsPerPage);
      
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
  // Add new endpoint to create a linked resource
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
  // Add new endpoint to get a resource by DID
  .get('/api/resources/:didId', async ({ params }) => {
    console.log(`Received request to get resource for DID: ${params.didId}`);
    
    try {
      const resource = await getResourceByDid(params.didId);
      
      if (!resource) {
        return {
          status: 'error',
          message: `Resource not found for DID: ${params.didId}`,
          data: {
            error: `Resource not found for DID: ${params.didId}`
          }
        };
      }
      
      return {
        status: 'success',
        message: 'Resource retrieved successfully',
        data: resource
      };
    } catch (error) {
      console.error(`Error retrieving resource for DID ${params.didId}:`, error);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        data: {
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        }
      };
    }
  })
  .listen(port);

console.log(`🦊 BTCO DID Explorer API is running at http://localhost:${port}`);

export type App = typeof app; 
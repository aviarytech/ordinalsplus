import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { exploreDidsOrd } from './src/controllers/exploreController';

const app = new Elysia()
  .use(cors({
    origin: ['http://localhost:5173'],  // Frontend dev server URL
    methods: ['GET', 'POST', 'OPTIONS']
  }))
  .get('/', () => 'Ordinals Plus API is running!')
  .get('/api/health', () => ({ status: 'healthy', timestamp: new Date().toISOString() }))
  .get('/api/explore', async () => {
    return await exploreDidsOrd();
  })
  .get('/api/config', () => {
    // Check if Ordiscan API key is set in environment
    const hasOrdiscanApiKey = !!process.env.ORDISCAN_API_KEY;
    
    return {
      providers: {
        ordiscan: {
          available: hasOrdiscanApiKey,
          baseUrl: 'https://ordiscan.com'
        },
        ordNode: {
          available: true, // Ord node is always available as an option
          baseUrl: 'http://localhost:9001'
        }
      }
    };
  })
  .get('/api/ordiscan/address/:address', async ({ params, query }) => {
    const { address } = params;
    const { page = '0', limit = '50' } = query;
    
    const apiKey = process.env.ORDISCAN_API_KEY;
    
    if (!apiKey) {
      return { 
        error: 'Ordiscan API key not configured on server', 
        status: 500 
      };
    }
    
    try {
      // Proxy request to Ordiscan API
      const response = await fetch(
        `https://ordiscan.com/api/address/${address}?page=${page}&limit=${limit}`,
        {
          headers: {
            'Accept': 'application/json',
            'X-API-Key': apiKey
          }
        }
      );
      
      if (!response.ok) {
        return { 
          error: `Ordiscan API error: ${response.status} ${response.statusText}`, 
          status: response.status 
        };
      }
      
      // Forward the response from Ordiscan
      return await response.json();
    } catch (error) {
      console.error('Error proxying to Ordiscan:', error);
      return { 
        error: error instanceof Error ? error.message : 'Unknown error', 
        status: 500 
      };
    }
  })
  .get('/api/ordiscan/inscription/:id', async ({ params }) => {
    const { id } = params;
    const apiKey = process.env.ORDISCAN_API_KEY;
    
    if (!apiKey) {
      return { 
        error: 'Ordiscan API key not configured on server', 
        status: 500 
      };
    }
    
    try {
      // Proxy request to Ordiscan API
      const response = await fetch(
        `https://ordiscan.com/api/inscription/${id}`,
        {
          headers: {
            'Accept': 'application/json',
            'X-API-Key': apiKey
          }
        }
      );
      
      if (!response.ok) {
        return { 
          error: `Ordiscan API error: ${response.status} ${response.statusText}`, 
          status: response.status 
        };
      }
      
      // Forward the response from Ordiscan
      return await response.json();
    } catch (error) {
      console.error('Error proxying to Ordiscan:', error);
      return { 
        error: error instanceof Error ? error.message : 'Unknown error', 
        status: 500 
      };
    }
  })
  .listen(3000);

console.log(`🚀 Ordinals Plus API is running at ${app.server?.hostname}:${app.server?.port}`);

export type App = typeof app;
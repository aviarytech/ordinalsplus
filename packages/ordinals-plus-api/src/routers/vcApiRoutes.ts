import { Elysia } from 'elysia';
import { getVCApiProviders, getDefaultVCApiProvider } from '../config/vcApiConfig';
import { getWorkflowConfiguration, formatWorkflowConfiguration, participateInExchange, createExchange } from '../services/vcApiService';
import { logger } from '../utils/logger';

/**
 * VC API Routes
 * 
 * Provides endpoints for accessing VC API provider configurations
 */
export const vcApiRoutes = new Elysia({ prefix: '/api/vc-api' })
  /**
   * GET /api/vc-api/providers
   * 
   * Returns a list of all configured VC API providers
   * Note: Auth tokens are redacted for security
   */
  .get('/providers', () => {
    const providers = getVCApiProviders();
    
    // Redact auth tokens for security
    return providers.map(provider => ({
      id: provider.id,
      name: provider.name,
      url: provider.url,
      isDefault: provider.isDefault,
      // Indicate that auth token exists but don't expose it
      hasAuthToken: !!provider.authToken
    }));
  })
  /**
   * GET /api/vc-api/providers/default
   * 
   * Returns the default VC API provider
   * Note: Auth token is redacted for security
   */
  .get('/providers/default', () => {
    const provider = getDefaultVCApiProvider();
    
    // Redact auth token for security
    return {
      id: provider.id,
      name: provider.name,
      url: provider.url,
      isDefault: true,
      // Indicate that auth token exists but don't expose it
      hasAuthToken: !!provider.authToken
    };
  })
  /**
   * GET /api/vc-api/providers/:id/workflow-configuration
   * 
   * Returns the workflow configuration for a specific VC API provider
   * This proxies the request to the actual VC API provider and formats the response
   */
  .get('/providers/:id/workflow-configuration', async ({ params }) => {
    try {
      const rawConfig = await getWorkflowConfiguration(params.id);
      return formatWorkflowConfiguration(rawConfig);
    } catch (error) {
      console.error(`Error fetching workflow configuration for provider ${params.id}:`, error);
      return new Response(JSON.stringify({
        error: 'Failed to fetch workflow configuration',
        message: error instanceof Error ? error.message : String(error)
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
  })
  /**
   * POST /api/vc-api/providers/:id/exchanges/:exchangeId/participate
   * 
   * Participates in an exchange with a specific VC API provider
   * This proxies the request to the actual VC API provider and returns the response
   */
  .post('/providers/:id/exchanges/:exchangeId/participate', async ({ params, body }) => {
    try {
      // Validate the request body
      if (!body || typeof body !== 'object') {
        return new Response(JSON.stringify({
          error: 'Invalid request body',
          message: 'Request body must be a JSON object'
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json'
          }
        });
      }
      
      // Type the request body
      interface ExchangeRequestBody {
        variables?: Record<string, string>;
      }
      
      // Extract variables from the request body
      const typedBody = body as ExchangeRequestBody;
      const variables = typedBody.variables || {};
      
      // Validate variables
      if (typeof variables !== 'object') {
        return new Response(JSON.stringify({
          error: 'Invalid variables',
          message: 'Variables must be a JSON object'
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json'
          }
        });
      }

      
      // Participate in the exchange
      logger.info(`Participating in exchange for provider ${params.id}, exchange ${params.exchangeId} with variables:`, variables);
      const result = await participateInExchange(params.id, params.exchangeId, variables);
      logger.info(`Exchange participation result:`, result);
      
      return result;
    } catch (error) {
      console.error(`Error participating in exchange for provider ${params.id}, exchange ${params.exchangeId}:`, error);
      return new Response(JSON.stringify({
        error: 'Failed to participate in exchange',
        message: error instanceof Error ? error.message : String(error)
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
  })
  /**
   * POST /api/vc-api/providers/:id/exchanges
   * 
   * Creates a new exchange with a specific VC API provider
   * This proxies the request to the actual VC API provider and returns the response
   */
  .post('/providers/:id/exchanges', async ({ params, body }) => {
    try {
      // Validate the request body
      if (!body || typeof body !== 'object') {
        return new Response(JSON.stringify({
          error: 'Invalid request body',
          message: 'Request body must be a JSON object'
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json'
          }
        });
      }
      
      // Create the exchange
      const result = await createExchange(params.id, body);
      
      return result;
    } catch (error) {
      console.error(`Error creating exchange for provider ${params.id}:`, error);
      return new Response(JSON.stringify({
        error: 'Failed to create exchange',
        message: error instanceof Error ? error.message : String(error)
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
  });

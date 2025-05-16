import { Elysia } from 'elysia';
import { getVCApiProviders, getDefaultVCApiProvider } from '../config/vcApiConfig';

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
  });

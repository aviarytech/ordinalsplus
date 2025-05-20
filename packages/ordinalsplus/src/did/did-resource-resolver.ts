import { DidResolutionOptions, DidResolutionResult, ParsedDidUrl } from './did-resolver';
import { ResourceResolver } from '../resources/resource-resolver';
import { ERROR_CODES } from '../utils/constants';
import { parseBtcoDid } from '../utils/validators';
import { AuditSeverity, logSecurityEvent } from '../utils/audit-logger';
import { BitcoinNetwork } from '../types';

/**
 * Resolves a DID URL to a linked resource
 * 
 * @param parsed - The parsed DID URL
 * @param options - Resolution options
 * @param network - The Bitcoin network to use
 * @returns The DID resolution result for the resource
 */
export async function resolveResource(
  parsed: ParsedDidUrl, 
  options: DidResolutionOptions = {},
  network: BitcoinNetwork = 'mainnet'
): Promise<DidResolutionResult> {
  try {
    // Extract satoshi number from DID
    const satNumber = parseBtcoDid(parsed.did)?.satNumber;
    if (!satNumber) {
      return createErrorResult(
        ERROR_CODES.INVALID_DID, 
        'Could not parse satoshi number from DID'
      );
    }

    // Ensure we have a valid resource index
    if (parsed.resourceIndex === undefined) {
      return createErrorResult(
        ERROR_CODES.INVALID_RESOURCE_ID,
        'Invalid resource index in DID URL'
      );
    }

    // Create a resource ID for the ResourceResolver
    const resourceId = `${parsed.did}/${parsed.resourceIndex}`;

    // Create a ResourceResolver with the same network and provider options
    const resourceResolver = new ResourceResolver({
      apiKey: options.apiKey,
      apiEndpoint: options.apiEndpoint,
      timeout: options.timeout,
      network: network,
      // Pass through caching options
      cacheEnabled: options.noCache ? false : true,
      cacheTtl: options.cacheTtl
    });

    try {
      // Determine if we need to return resource info or content
      const resourcePathMode = parsed.resourcePath && parsed.resourcePath.length > 2 ? 
        parsed.resourcePath[2] : 'content';

      // Handle different resource resolution modes based on path
      let resource;
      let contentType;

      if (resourcePathMode === 'info') {
        // Return resource metadata/info
        const resourceInfo = await resourceResolver.resolveInfo(resourceId, { noCache: options.noCache });
        resource = resourceInfo;
        contentType = 'application/json';
      } else if (resourcePathMode === 'meta') {
        // Return resource metadata if available
        const resourceInfo = await resourceResolver.resolveInfo(resourceId, { noCache: options.noCache });
        resource = resourceInfo;
        contentType = 'application/json';
      } else {
        // Default: Return the actual resource content
        resource = await resourceResolver.resolve(resourceId, { noCache: options.noCache });
        contentType = resource.contentType || 'application/octet-stream';
      }

      // Handle content type negotiation via query parameters if present
      if (parsed.query) {
        const params = new URLSearchParams(parsed.query.substring(1));
        const requestedType = params.get('format') || params.get('content-type');
        if (requestedType) {
          contentType = requestedType;
        }
      }

      // Create a successful resolution result with resource metadata
      return {
        didResolutionMetadata: {
          contentType,
          created: new Date().toISOString(),
          // Add resource metadata in the resolution metadata
          resourceInfo: {
            id: resourceId,
            type: resource.type || 'Unknown',
            contentType: contentType
          }
        },
        didDocument: null, // Resource resolution doesn't return a DID document
        didDocumentMetadata: {}
      };
    } catch (error) {
      // Log resource resolution error if auditing is enabled
      if (options.enableAudit) {
        await logSecurityEvent(
          'resource_resolution_error',
          AuditSeverity.ERROR,
          parsed.did,
          options.actor,
          { 
            resourceId,
            error: error instanceof Error ? error.message : String(error) 
          }
        );
      }

      console.error(`[DidResolver] Error resolving resource ${resourceId}:`, error);
      return createErrorResult(
        ERROR_CODES.RESOURCE_NOT_FOUND,
        error instanceof Error ? error.message : 'Unknown error during resource resolution'
      );
    }
  } catch (error) {
    console.error('[DidResolver] Error in resolveResource:', error);
    return createErrorResult(
      ERROR_CODES.RESOLUTION_FAILED,
      error instanceof Error ? error.message : 'Unknown error during resource resolution'
    );
  }
}

/**
 * Creates an error result for DID resolution
 * 
 * @param code - The error code
 * @param message - The error message
 * @returns A DID resolution result with the error
 */
function createErrorResult(code: string, message: string): DidResolutionResult {
  return {
    didResolutionMetadata: {
      error: code,
      contentType: 'application/did+json'
    },
    didDocument: null,
    didDocumentMetadata: {}
  };
}

import { ApiClient } from '../utils/api-client';
import { isValidResourceId, parseResourceId } from '../utils/validators';
import { ERROR_CODES, INFO_SUFFIX, META_SUFFIX, HERITAGE_SUFFIX, CONTROLLER_SUFFIX } from '../utils/constants';
import {
  ApiOptions,
  ResourceInfo,
  ResourceContent,
  ResourceMetadata,
  ResourceCollectionPage,
  ResourceResolutionOptions
} from '../types';

/**
 * Class for resolving and working with DID Linked Resources
 */
export class ResourceResolver {
  private apiClient: ApiClient;

  /**
   * Creates a new ResourceResolver instance
   * @param options - API client options
   */
  constructor(options: ApiOptions = {}) {
    this.apiClient = new ApiClient(options);
  }

  /**
   * Resolves a resource by its identifier
   * @param resourceId - The resource identifier
   * @param options - Resolution options
   * @returns The resource content
   */
  async resolve(resourceId: string, options: ResourceResolutionOptions = {}): Promise<ResourceContent> {
    this.validateResourceId(resourceId);
    
    try {
      const path = `1.0/resource/${resourceId}`;
      const fetchOptions: RequestInit = this.buildFetchOptions(options);
      
      const content = await this.apiClient.get<any>(path, fetchOptions);
      
      // Get the content type from the response headers
      let contentType = 'application/octet-stream';
      if (typeof content === 'object') {
        contentType = 'application/json';
      } else if (typeof content === 'string') {
        // Try to detect common text formats
        if (content.startsWith('<!DOCTYPE html>') || content.startsWith('<html>')) {
          contentType = 'text/html';
        } else if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
          contentType = 'application/json';
        } else {
          contentType = 'text/plain';
        }
      }
      
      return {
        content,
        contentType
      };
    } catch (error: any) {
      if (error.error === ERROR_CODES.RESOURCE_NOT_FOUND) {
        throw {
          error: ERROR_CODES.RESOURCE_NOT_FOUND,
          message: `Resource not found: ${resourceId}`
        };
      }
      
      throw error;
    }
  }

  /**
   * Resolves resource information
   * @param resourceId - The resource identifier
   * @param options - Resolution options
   * @returns The resource information
   */
  async resolveInfo(resourceId: string, options: ResourceResolutionOptions = {}): Promise<ResourceInfo> {
    this.validateResourceId(resourceId);
    
    const infoPath = `${resourceId}/${INFO_SUFFIX}`;
    
    try {
      const path = `1.0/resource/${infoPath}`;
      const fetchOptions: RequestInit = this.buildFetchOptions(options);
      
      return await this.apiClient.get<ResourceInfo>(path, fetchOptions);
    } catch (error: any) {
      if (error.error === ERROR_CODES.RESOURCE_NOT_FOUND) {
        throw {
          error: ERROR_CODES.RESOURCE_NOT_FOUND,
          message: `Resource information not found: ${resourceId}`
        };
      }
      
      throw error;
    }
  }

  /**
   * Resolves resource metadata
   * @param resourceId - The resource identifier
   * @param options - Resolution options
   * @returns The resource metadata
   */
  async resolveMeta(resourceId: string, options: ResourceResolutionOptions = {}): Promise<ResourceMetadata> {
    this.validateResourceId(resourceId);
    
    const metaPath = `${resourceId}/${META_SUFFIX}`;
    
    try {
      const path = `1.0/resource/${metaPath}`;
      const fetchOptions: RequestInit = this.buildFetchOptions(options);
      
      return await this.apiClient.get<ResourceMetadata>(path, fetchOptions);
    } catch (error: any) {
      if (error.error === ERROR_CODES.RESOURCE_NOT_FOUND) {
        throw {
          error: ERROR_CODES.METADATA_INVALID,
          message: `Resource metadata not found: ${resourceId}`
        };
      }
      
      throw error;
    }
  }

  /**
   * Resolves a collection of resources
   * @param collectionId - The collection identifier
   * @param limit - Maximum number of resources to return
   * @param cursor - Pagination cursor
   * @param options - Resolution options
   * @returns The collection page
   */
  async resolveCollection(
    collectionId: string,
    limit: number = 10,
    cursor?: string,
    options: ResourceResolutionOptions = {}
  ): Promise<ResourceCollectionPage> {
    // Validate the collection ID format
    const parsed = parseResourceId(collectionId);
    if (!parsed) {
      throw {
        error: ERROR_CODES.INVALID_IDENTIFIER,
        message: `Invalid collection identifier: ${collectionId}`
      };
    }
    
    try {
      let path = `1.0/collection/${collectionId}?limit=${limit}`;
      if (cursor) {
        path += `&cursor=${encodeURIComponent(cursor)}`;
      }
      
      const fetchOptions: RequestInit = this.buildFetchOptions(options);
      
      return await this.apiClient.get<ResourceCollectionPage>(path, fetchOptions);
    } catch (error: any) {
      if (error.error === ERROR_CODES.RESOURCE_NOT_FOUND) {
        throw {
          error: ERROR_CODES.COLLECTION_EMPTY,
          message: `Collection empty or not found: ${collectionId}`
        };
      }
      
      throw error;
    }
  }

  /**
   * Resolves a heritage collection (parent/child relationships)
   * @param resourceId - The resource identifier
   * @param limit - Maximum number of resources to return
   * @param cursor - Pagination cursor
   * @param options - Resolution options
   * @returns The heritage collection page
   */
  async resolveHeritageCollection(
    resourceId: string,
    limit: number = 10,
    cursor?: string,
    options: ResourceResolutionOptions = {}
  ): Promise<ResourceCollectionPage> {
    this.validateResourceId(resourceId);
    
    return this.resolveCollection(
      `${resourceId}/${HERITAGE_SUFFIX}`,
      limit,
      cursor,
      options
    );
  }

  /**
   * Resolves a controller collection (resources controlled by the same wallet)
   * @param resourceId - The resource identifier
   * @param limit - Maximum number of resources to return
   * @param cursor - Pagination cursor
   * @param options - Resolution options
   * @returns The controller collection page
   */
  async resolveControllerCollection(
    resourceId: string,
    limit: number = 10,
    cursor?: string,
    options: ResourceResolutionOptions = {}
  ): Promise<ResourceCollectionPage> {
    this.validateResourceId(resourceId);
    
    return this.resolveCollection(
      `${resourceId}/${CONTROLLER_SUFFIX}`,
      limit,
      cursor,
      options
    );
  }

  /**
   * Validates a resource identifier
   * @param resourceId - The resource identifier to validate
   * @throws If the resource identifier is invalid
   */
  private validateResourceId(resourceId: string): void {
    if (!isValidResourceId(resourceId)) {
      throw {
        error: ERROR_CODES.INVALID_RESOURCE_ID,
        message: `Invalid resource identifier: ${resourceId}`
      };
    }
  }

  /**
   * Builds fetch options based on resource resolution options
   * @param options - Resource resolution options
   * @returns Fetch options
   */
  private buildFetchOptions(options: ResourceResolutionOptions): RequestInit {
    const headers: Record<string, string> = {};
    
    if (options.accept) {
      headers['Accept'] = options.accept;
    }
    
    if (options.cacheControl) {
      headers['Cache-Control'] = options.cacheControl;
    }
    
    if (options.ifNoneMatch) {
      headers['If-None-Match'] = options.ifNoneMatch;
    }
    
    if (options.ifModifiedSince) {
      headers['If-Modified-Since'] = options.ifModifiedSince;
    }
    
    return {
      headers
    };
  }
} 
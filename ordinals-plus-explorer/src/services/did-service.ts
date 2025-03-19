import { BtcoDid, ResourceResolver, isValidBtcoDid, isValidResourceId } from '../../../ordinalsplus/src';
import { types } from '../../../ordinalsplus/src';

// Re-export types from the library
export type DidDocument = types.DidDocument;
export type ResourceInfo = types.ResourceInfo;
export type ResourceContent = types.ResourceContent;
export type ResourceMetadata = types.ResourceMetadata;
export type ResourceCollectionPage = types.ResourceCollectionPage;

/**
 * Service for interacting with BTCO DIDs and resources
 * Uses the OrdinalsPlus library under the hood
 */
export class DidService {
  private apiEndpoint: string;
  
  /**
   * Create a new DID service instance
   * @param apiEndpoint - The API endpoint to use
   */
  constructor(apiEndpoint: string = 'https://api.ordinalsplus.com') {
    this.apiEndpoint = apiEndpoint;
  }
  
  /**
   * Validate if a string is a valid BTCO DID
   * @param didString - The DID string to validate
   * @returns True if valid, false otherwise
   */
  isValidDid(didString: string): boolean {
    return isValidBtcoDid(didString);
  }
  
  /**
   * Validate if a string is a valid resource ID
   * @param resourceId - The resource ID to validate
   * @returns True if valid, false otherwise
   */
  isValidResourceId(resourceId: string): boolean {
    return isValidResourceId(resourceId);
  }
  
  /**
   * Resolve a DID to get its DID document
   * @param didString - The DID to resolve
   * @returns The DID document
   */
  async resolveDid(didString: string): Promise<DidDocument> {
    try {
      const did = new BtcoDid(didString, {
        endpoint: this.apiEndpoint
      });
      
      const result = await did.resolve();
      if (!result.didDocument) {
        throw new Error('No DID document found');
      }
      return result.didDocument;
    } catch (error) {
      console.error('Failed to resolve DID:', error);
      throw error;
    }
  }
  
  /**
   * Get information about a resource
   * @param resourceId - The resource ID
   * @returns Resource information
   */
  async getResourceInfo(resourceId: string): Promise<ResourceInfo> {
    try {
      const resolver = new ResourceResolver({
        endpoint: this.apiEndpoint
      });
      
      return await resolver.resolveInfo(resourceId);
    } catch (error) {
      console.error('Failed to get resource info:', error);
      throw error;
    }
  }
  
  /**
   * Get resource content
   * @param resourceId - The resource ID
   * @returns Resource content with content type
   */
  async getResourceContent(resourceId: string): Promise<ResourceContent> {
    try {
      const resolver = new ResourceResolver({
        endpoint: this.apiEndpoint
      });
      
      return await resolver.resolve(resourceId);
    } catch (error) {
      console.error('Failed to get resource content:', error);
      throw error;
    }
  }
  
  /**
   * Get resource metadata
   * @param resourceId - The resource ID
   * @returns Resource metadata
   */
  async getResourceMetadata(resourceId: string): Promise<ResourceMetadata> {
    try {
      const resolver = new ResourceResolver({
        endpoint: this.apiEndpoint
      });
      
      return await resolver.resolveMeta(resourceId);
    } catch (error) {
      console.error('Failed to get resource metadata:', error);
      throw error;
    }
  }
  
  /**
   * Get a collection of resources
   * @param collectionId - The collection identifier
   * @param limit - Maximum number of resources to return
   * @param cursor - Pagination cursor
   * @returns Collection page
   */
  async getCollection(
    collectionId: string,
    limit: number = 10,
    cursor?: string
  ): Promise<ResourceCollectionPage> {
    try {
      const resolver = new ResourceResolver({
        endpoint: this.apiEndpoint
      });
      
      return await resolver.resolveCollection(collectionId, limit, cursor);
    } catch (error) {
      console.error('Failed to get collection:', error);
      throw error;
    }
  }
  
  /**
   * Get heritage collection (parent/child relationships)
   * @param resourceId - The resource ID
   * @param limit - Maximum number of resources to return
   * @param cursor - Pagination cursor
   * @returns Collection page
   */
  async getHeritageCollection(
    resourceId: string,
    limit: number = 10,
    cursor?: string
  ): Promise<ResourceCollectionPage> {
    try {
      const resolver = new ResourceResolver({
        endpoint: this.apiEndpoint
      });
      
      return await resolver.resolveHeritageCollection(resourceId, limit, cursor);
    } catch (error) {
      console.error('Failed to get heritage collection:', error);
      throw error;
    }
  }
  
  /**
   * Get controller collection (resources controlled by the same wallet)
   * @param resourceId - The resource ID
   * @param limit - Maximum number of resources to return
   * @param cursor - Pagination cursor
   * @returns Collection page
   */
  async getControllerCollection(
    resourceId: string,
    limit: number = 10,
    cursor?: string
  ): Promise<ResourceCollectionPage> {
    try {
      const resolver = new ResourceResolver({
        endpoint: this.apiEndpoint
      });
      
      return await resolver.resolveControllerCollection(resourceId, limit, cursor);
    } catch (error) {
      console.error('Failed to get controller collection:', error);
      throw error;
    }
  }
} 
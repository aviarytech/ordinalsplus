import { Inscription, InscriptionResponse, ApiOptions } from '../../types';

/**
 * Interface for ordinals providers
 * This defines the standard methods that any ordinals data provider must implement
 */
export interface IOrdinalsProvider {
  /**
   * Initialize the provider with options
   */
  init(options?: ApiOptions): void;
  
  /**
   * Get the status of the provider
   */
  getStatus(): Promise<{ status: 'available' | 'unavailable', message: string }>;
  
  /**
   * Fetch inscriptions with pagination
   */
  fetchInscriptions(offset?: number, limit?: number): Promise<InscriptionResponse>;
  
  /**
   * Fetch a specific inscription by ID
   */
  fetchInscriptionById(inscriptionId: string): Promise<Inscription | null>;
  
  /**
   * Fetch the content of an inscription
   */
  fetchInscriptionContent(inscriptionId: string, contentType: string): Promise<any>;
  
  /**
   * Search inscriptions by content
   */
  searchInscriptionsByContent(searchQuery: string, offset?: number, limit?: number): Promise<InscriptionResponse>;
}

/**
 * Base class for ordinals providers
 * Implements common functionality and provides a template for specific providers
 */
export abstract class BaseOrdinalsProvider implements IOrdinalsProvider {
  protected options: ApiOptions = {
    endpoint: '',
    timeout: 30000,
  };
  
  /**
   * Initialize the provider with options
   */
  init(options?: ApiOptions): void {
    this.options = { ...this.options, ...options };
  }
  
  /**
   * Get the status of the provider
   */
  abstract getStatus(): Promise<{ status: 'available' | 'unavailable', message: string }>;
  
  /**
   * Fetch inscriptions with pagination
   */
  abstract fetchInscriptions(offset?: number, limit?: number): Promise<InscriptionResponse>;
  
  /**
   * Fetch a specific inscription by ID
   */
  abstract fetchInscriptionById(inscriptionId: string): Promise<Inscription | null>;
  
  /**
   * Fetch the content of an inscription
   */
  abstract fetchInscriptionContent(inscriptionId: string, contentType: string): Promise<any>;
  
  /**
   * Search inscriptions by content
   */
  abstract searchInscriptionsByContent(searchQuery: string, offset?: number, limit?: number): Promise<InscriptionResponse>;
  
  /**
   * Utility method to handle API errors
   */
  protected handleError(error: unknown, operationName: string): never {
    console.error(`Error in ${operationName}:`, error);
    throw error instanceof Error ? error : new Error(`Unknown error in ${operationName}`);
  }
} 
/**
 * @module key-management/key-storage
 * @description Provides interfaces and implementations for key storage
 */

import { v4 as uuidv4 } from 'uuid';
import { KeyPair } from './key-pair-generator';

/**
 * Interface for key storage implementations
 */
export interface KeyStorage {
  /**
   * Store a key pair
   * 
   * @param keyPair - The key pair to store
   * @param alias - Optional alias for the key
   * @returns The ID of the stored key
   */
  storeKey(keyPair: KeyPair, alias?: string): Promise<string>;

  /**
   * Retrieve a key pair by ID
   * 
   * @param id - The ID of the key to retrieve
   * @returns The key pair, or null if not found
   */
  getKey(id: string): Promise<KeyPair | null>;

  /**
   * Retrieve a key pair by alias
   * 
   * @param alias - The alias of the key to retrieve
   * @returns The key pair, or null if not found
   */
  getKeyByAlias(alias: string): Promise<KeyPair | null>;

  /**
   * List all stored keys
   * 
   * @returns An array of stored key pairs
   */
  listKeys(): Promise<Array<KeyPair>>;

  /**
   * Delete a key pair by ID
   * 
   * @param id - The ID of the key to delete
   * @returns True if the key was deleted, false if not found
   */
  deleteKey(id: string): Promise<boolean>;

  /**
   * Delete a key pair by alias
   * 
   * @param alias - The alias of the key to delete
   * @returns True if the key was deleted, false if not found
   */
  deleteKeyByAlias(alias: string): Promise<boolean>;

  /**
   * Clear all stored keys
   * 
   * @returns The number of keys deleted
   */
  clear(): Promise<number>;
}

/**
 * Metadata for stored keys with aliases
 */
interface KeyMetadata {
  id: string;
  alias?: string;
  createdAt: Date;
}

/**
 * In-memory implementation of the KeyStorage interface
 */
export class InMemoryKeyStorage implements KeyStorage {
  private keys: Map<string, KeyPair> = new Map();
  private aliases: Map<string, string> = new Map(); // alias -> key ID

  /**
   * Store a key pair
   * 
   * @param keyPair - The key pair to store
   * @param alias - Optional alias for the key
   * @returns The ID of the stored key
   */
  async storeKey(keyPair: KeyPair, alias?: string): Promise<string> {
    // Use existing ID or generate a new one if not provided
    const id = keyPair.id || uuidv4();
    const keyWithId: KeyPair = {
      ...keyPair,
      id,
      createdAt: keyPair.createdAt || new Date()
    };

    // Store the key
    this.keys.set(id, keyWithId);

    // Store alias if provided
    if (alias) {
      this.aliases.set(alias, id);
    }

    return id;
  }

  /**
   * Retrieve a key pair by ID
   * 
   * @param id - The ID of the key to retrieve
   * @returns The key pair, or null if not found
   */
  async getKey(id: string): Promise<KeyPair | null> {
    return this.keys.get(id) || null;
  }

  /**
   * Retrieve a key pair by alias
   * 
   * @param alias - The alias of the key to retrieve
   * @returns The key pair, or null if not found
   */
  async getKeyByAlias(alias: string): Promise<KeyPair | null> {
    const id = this.aliases.get(alias);
    if (!id) return null;
    return this.getKey(id);
  }

  /**
   * List all stored keys
   * 
   * @returns An array of stored key pairs
   */
  async listKeys(): Promise<Array<KeyPair>> {
    return Array.from(this.keys.values());
  }

  /**
   * Delete a key pair by ID
   * 
   * @param id - The ID of the key to delete
   * @returns True if the key was deleted, false if not found
   */
  async deleteKey(id: string): Promise<boolean> {
    // Delete any aliases pointing to this key
    for (const [alias, keyId] of this.aliases.entries()) {
      if (keyId === id) {
        this.aliases.delete(alias);
      }
    }

    // Delete the key itself
    return this.keys.delete(id);
  }

  /**
   * Delete a key pair by alias
   * 
   * @param alias - The alias of the key to delete
   * @returns True if the key was deleted, false if not found
   */
  async deleteKeyByAlias(alias: string): Promise<boolean> {
    const id = this.aliases.get(alias);
    if (!id) return false;

    // Delete the alias
    this.aliases.delete(alias);

    // Delete the key
    return this.keys.delete(id);
  }

  /**
   * Clear all stored keys
   * 
   * @returns The number of keys deleted
   */
  async clear(): Promise<number> {
    const count = this.keys.size;
    this.keys.clear();
    this.aliases.clear();
    return count;
  }
} 
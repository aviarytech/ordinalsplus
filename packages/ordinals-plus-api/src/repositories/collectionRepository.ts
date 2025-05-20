/**
 * Collection Repository
 * 
 * This module provides repository interfaces and implementations for storing
 * and managing curated collections with efficient indexing and retrieval.
 */
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { 
  Collection, 
  CollectionItem, 
  CollectionMetadata,
  CollectionQueryParams,
  CollectionPaginationResult,
  CreateCollectionParams,
  UpdateCollectionParams,
  UpdateCollectionItemParams,
  CollectionCategory
} from '../types/collection';
import { CollectionVisibility } from '../types/collection';

/**
 * Index structure for collection storage
 * Each index maps a key to an array of collection IDs
 */
interface CollectionIndex {
  byId: Map<string, string>; // Map of collection ID to internal storage key
  byCurator: Map<string, Set<string>>; // Map of curator DID to collection IDs
  byItem: Map<string, Set<string>>; // Map of item DID to collection IDs
  byCategory: Map<string, Set<string>>; // Map of category to collection IDs
  byTag: Map<string, Set<string>>; // Map of tag to collection IDs
  byInscription: Map<string, Set<string>>; // Map of inscription ID to collection IDs
}

/**
 * Repository interface for collection storage
 */
export interface CollectionRepository {
  /**
   * Create a new collection
   * 
   * @param params - Parameters for creating the collection
   * @returns The created collection
   */
  createCollection(params: CreateCollectionParams): Promise<Collection>;

  /**
   * Get a collection by its ID
   * 
   * @param id - The collection ID
   * @returns The collection if found, null otherwise
   */
  getCollectionById(id: string): Promise<Collection | null>;

  /**
   * Find collections by query parameters
   * 
   * @param params - Query parameters
   * @returns Paginated collections matching the query
   */
  findCollections(params: CollectionQueryParams): Promise<CollectionPaginationResult>;

  /**
   * Find collections by curator DID
   * 
   * @param curatorDid - The curator DID to search for
   * @param page - Page number (1-based)
   * @param limit - Items per page
   * @returns Paginated collections for the curator
   */
  findCollectionsByCurator(curatorDid: string, page?: number, limit?: number): Promise<CollectionPaginationResult>;

  /**
   * Find collections containing a specific item
   * 
   * @param itemDid - The item DID to search for
   * @param page - Page number (1-based)
   * @param limit - Items per page
   * @returns Paginated collections containing the item
   */
  findCollectionsByItem(itemDid: string, page?: number, limit?: number): Promise<CollectionPaginationResult>;

  /**
   * Update a collection
   * 
   * @param id - The collection ID to update
   * @param params - Update parameters
   * @returns The updated collection if successful, null otherwise
   */
  updateCollection(id: string, params: UpdateCollectionParams): Promise<Collection | null>;

  /**
   * Add an item to a collection
   * 
   * @param collectionId - The collection ID
   * @param item - The item to add
   * @returns The updated collection if successful, null otherwise
   */
  addItemToCollection(collectionId: string, item: Omit<CollectionItem, 'addedAt'>): Promise<Collection | null>;

  /**
   * Update an item in a collection
   * 
   * @param collectionId - The collection ID
   * @param itemDid - The DID of the item to update
   * @param params - Update parameters
   * @returns The updated collection if successful, null otherwise
   */
  updateCollectionItem(collectionId: string, itemDid: string, params: UpdateCollectionItemParams): Promise<Collection | null>;

  /**
   * Remove an item from a collection
   * 
   * @param collectionId - The collection ID
   * @param itemDid - The DID of the item to remove
   * @returns The updated collection if successful, null otherwise
   */
  removeItemFromCollection(collectionId: string, itemDid: string): Promise<Collection | null>;

  /**
   * Delete a collection
   * 
   * @param id - The collection ID to delete
   * @returns Whether the deletion was successful
   */
  deleteCollection(id: string): Promise<boolean>;

  /**
   * Set the credential for a collection
   * 
   * @param collectionId - The collection ID
   * @param credentialId - The credential ID
   * @returns The updated collection if successful, null otherwise
   */
  setCollectionCredential(collectionId: string, credentialId: string): Promise<Collection | null>;

  /**
   * Get statistics about the collection store
   * 
   * @returns Statistics about the store
   */
  getStats(): Promise<CollectionStoreStats>;
}

/**
 * Statistics about the collection store
 */
export interface CollectionStoreStats {
  /** Total number of collections */
  totalCollections: number;
  /** Number of unique curators */
  uniqueCurators: number;
  /** Number of unique items across all collections */
  uniqueItems: number;
  /** Number of collections by category */
  collectionsByCategory: Record<string, number>;
  /** Whether encryption is enabled */
  encryptionEnabled: boolean;
}

/**
 * Configuration for the in-memory collection repository
 */
export interface InMemoryCollectionRepositoryConfig {
  /** Whether to enable encryption */
  enableEncryption?: boolean;
  /** Encryption key (required if encryption is enabled) */
  encryptionKey?: string;
  /** Path for persistence */
  persistencePath?: string;
  /** Auto-save interval in milliseconds */
  autoSaveIntervalMs?: number;
}

/**
 * In-memory implementation of CollectionRepository
 * 
 * This repository stores collections in memory with optional encryption.
 * It can also persist to disk and load from disk for semi-durability.
 */
export class InMemoryCollectionRepository implements CollectionRepository {
  private collections: Map<string, string> = new Map();
  private metadata: Map<string, CollectionMetadata> = new Map();
  private index: CollectionIndex = {
    byId: new Map(),
    byCurator: new Map(),
    byItem: new Map(),
    byCategory: new Map(),
    byTag: new Map(),
    byInscription: new Map()
  };
  private config: InMemoryCollectionRepositoryConfig;
  private autoSaveTimer?: NodeJS.Timer;

  /**
   * Create a new in-memory collection repository
   * 
   * @param config - Configuration options
   */
  constructor(config: InMemoryCollectionRepositoryConfig = {}) {
    this.config = {
      enableEncryption: config.enableEncryption || false,
      encryptionKey: config.encryptionKey,
      persistencePath: config.persistencePath,
      autoSaveIntervalMs: config.autoSaveIntervalMs || 0
    };

    // Validate encryption configuration
    if (this.config.enableEncryption && (!this.config.encryptionKey || this.config.encryptionKey.length !== 32)) {
      throw new Error('When encryption is enabled, a 32-byte encryption key must be provided');
    }

    // Set up auto-saving if configured
    if (this.config.persistencePath && this.config.autoSaveIntervalMs && this.config.autoSaveIntervalMs > 0) {
      this.autoSaveTimer = setInterval(() => {
        this.createBackup(this.config.persistencePath as string)
          .catch(err => console.error('Error auto-saving collection repository:', err));
      }, this.config.autoSaveIntervalMs);
    }
  }

  /**
   * Create a new collection
   * 
   * @param params - Parameters for creating the collection
   * @returns The created collection
   */
  async createCollection(params: CreateCollectionParams): Promise<Collection> {
    const now = new Date().toISOString();
    
    // Create collection metadata
    const metadata: CollectionMetadata = {
      name: params.name,
      description: params.description,
      image: params.image,
      category: params.category,
      tags: params.tags || [],
      visibility: params.visibility || CollectionVisibility.PUBLIC,
      createdAt: now,
      updatedAt: now
    };

    // Create collection items
    const items: CollectionItem[] = (params.items || []).map((item, index) => ({
      ...item,
      did: item.did, // Ensure did is explicitly included
      order: item.order !== undefined ? item.order : index,
      addedAt: now
    }));

    // Generate a unique ID for the collection
    const id = uuidv4();

    // Create the collection object
    const collection: Collection = {
      id,
      curatorDid: params.curatorDid,
      metadata,
      items,
      accessList: []
    };

    // Store the collection
    const storageKey = this.generateStorageKey();
    const collectionJson = JSON.stringify(collection);
    const storedValue = this.config.enableEncryption && this.config.encryptionKey
      ? this.encryptData(collectionJson, this.config.encryptionKey)
      : collectionJson;

    this.collections.set(storageKey, storedValue);
    this.metadata.set(id, metadata);
    this.indexCollection(id, collection, storageKey);

    return collection;
  }

  /**
   * Get a collection by its ID
   * 
   * @param id - The collection ID
   * @returns The collection if found, null otherwise
   */
  async getCollectionById(id: string): Promise<Collection | null> {
    const storageKey = this.index.byId.get(id);
    if (!storageKey) {
      return null;
    }

    const storedValue = this.collections.get(storageKey);
    if (!storedValue) {
      return null;
    }

    try {
      const collectionJson = this.config.enableEncryption && this.config.encryptionKey
        ? this.decryptData(storedValue, this.config.encryptionKey)
        : storedValue;

      return JSON.parse(collectionJson) as Collection;
    } catch (error) {
      console.error('Error parsing collection:', error);
      return null;
    }
  }

  /**
   * Find collections by query parameters
   * 
   * @param params - Query parameters
   * @returns Paginated collections matching the query
   */
  async findCollections(params: CollectionQueryParams): Promise<CollectionPaginationResult> {
    // Default pagination values
    const page = params.page || 1;
    const limit = params.limit || 10;
    const sortBy = params.sortBy || 'createdAt';
    const sortDirection = params.sortDirection || 'desc';

    // Start with all collection IDs
    let collectionIds = Array.from(this.index.byId.keys());

    // Apply filters
    if (params.curatorDid) {
      const curatorCollections = this.index.byCurator.get(params.curatorDid);
      if (!curatorCollections) {
        return { collections: [], total: 0, page, limit };
      }
      collectionIds = collectionIds.filter(id => curatorCollections.has(id));
    }

    if (params.itemDid) {
      const itemCollections = this.index.byItem.get(params.itemDid);
      if (!itemCollections) {
        return { collections: [], total: 0, page, limit };
      }
      collectionIds = collectionIds.filter(id => itemCollections.has(id));
    }

    if (params.category) {
      const categoryCollections = this.index.byCategory.get(params.category);
      if (!categoryCollections) {
        return { collections: [], total: 0, page, limit };
      }
      collectionIds = collectionIds.filter(id => categoryCollections.has(id));
    }

    if (params.tags && params.tags.length > 0) {
      // Collection must have all specified tags
      for (const tag of params.tags) {
        const tagCollections = this.index.byTag.get(tag);
        if (!tagCollections) {
          return { collections: [], total: 0, page, limit };
        }
        collectionIds = collectionIds.filter(id => tagCollections.has(id));
      }
    }

    if (params.visibility) {
      // Filter by visibility (requires loading the collections)
      const filteredIds: string[] = [];
      for (const id of collectionIds) {
        const collection = await this.getCollectionById(id);
        if (collection && collection.metadata.visibility === params.visibility) {
          filteredIds.push(id);
        }
      }
      collectionIds = filteredIds;
    }

    if (params.search) {
      // Search in name and description (requires loading the collections)
      const searchTerm = params.search.toLowerCase();
      const filteredIds: string[] = [];
      for (const id of collectionIds) {
        const collection = await this.getCollectionById(id);
        if (collection && (
          collection.metadata.name.toLowerCase().includes(searchTerm) ||
          collection.metadata.description.toLowerCase().includes(searchTerm)
        )) {
          filteredIds.push(id);
        }
      }
      collectionIds = filteredIds;
    }

    // Get the total count before pagination
    const total = collectionIds.length;

    // Apply pagination
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedIds = collectionIds.slice(start, end);

    // Load the collections
    const collections: Collection[] = [];
    for (const id of paginatedIds) {
      const collection = await this.getCollectionById(id);
      if (collection) {
        collections.push(collection);
      }
    }

    // Sort the collections
    collections.sort((a, b) => {
      let valueA: any;
      let valueB: any;

      if (sortBy === 'name') {
        valueA = a.metadata.name;
        valueB = b.metadata.name;
      } else if (sortBy === 'updatedAt') {
        valueA = a.metadata.updatedAt;
        valueB = b.metadata.updatedAt;
      } else { // default to createdAt
        valueA = a.metadata.createdAt;
        valueB = b.metadata.createdAt;
      }

      // Apply sort direction
      return sortDirection === 'asc' 
        ? (valueA > valueB ? 1 : -1)
        : (valueA < valueB ? 1 : -1);
    });

    return { collections, total, page, limit };
  }

  /**
   * Find collections by curator DID
   * 
   * @param curatorDid - The curator DID to search for
   * @param page - Page number (1-based)
   * @param limit - Items per page
   * @returns Paginated collections for the curator
   */
  async findCollectionsByCurator(curatorDid: string, page = 1, limit = 10): Promise<CollectionPaginationResult> {
    return this.findCollections({ curatorDid, page, limit });
  }

  /**
   * Find collections containing a specific item
   * 
   * @param itemDid - The item DID to search for
   * @param page - Page number (1-based)
   * @param limit - Items per page
   * @returns Paginated collections containing the item
   */
  async findCollectionsByItem(itemDid: string, page = 1, limit = 10): Promise<CollectionPaginationResult> {
    return this.findCollections({ itemDid, page, limit });
  }

  /**
   * Update a collection
   * 
   * @param id - The collection ID to update
   * @param params - Update parameters
   * @returns The updated collection if successful, null otherwise
   */
  async updateCollection(id: string, params: UpdateCollectionParams): Promise<Collection | null> {
    const collection = await this.getCollectionById(id);
    if (!collection) {
      return null;
    }

    // Update the collection metadata
    const updatedMetadata: CollectionMetadata = {
      ...collection.metadata,
      ...params,
      updatedAt: new Date().toISOString()
    };

    // Update the collection object
    const updatedCollection: Collection = {
      ...collection,
      metadata: updatedMetadata,
      accessList: params.accessList !== undefined ? params.accessList : collection.accessList
    };

    // Store the updated collection
    const storageKey = this.index.byId.get(id);
    if (!storageKey) {
      return null;
    }

    // Remove old indexes
    this.removeCollectionFromIndexes(id, collection);

    // Store the updated collection
    const collectionJson = JSON.stringify(updatedCollection);
    const storedValue = this.config.enableEncryption && this.config.encryptionKey
      ? this.encryptData(collectionJson, this.config.encryptionKey)
      : collectionJson;

    this.collections.set(storageKey, storedValue);
    this.metadata.set(id, updatedMetadata);
    this.indexCollection(id, updatedCollection, storageKey);

    return updatedCollection;
  }

  /**
   * Add an item to a collection
   * 
   * @param collectionId - The collection ID
   * @param item - The item to add
   * @returns The updated collection if successful, null otherwise
   */
  async addItemToCollection(collectionId: string, item: Omit<CollectionItem, 'addedAt'>): Promise<Collection | null> {
    const collection = await this.getCollectionById(collectionId);
    if (!collection) {
      return null;
    }

    // Check if the item already exists in the collection
    const existingItemIndex = collection.items.findIndex(i => i.did === item.did);
    if (existingItemIndex !== -1) {
      return collection; // Item already exists, return unchanged collection
    }

    // Create the new item with addedAt timestamp
    const newItem: CollectionItem = {
      ...item,
      did: item.did, // Ensure did is explicitly included
      addedAt: new Date().toISOString()
    };

    // Add the item to the collection
    const updatedItems = [...collection.items, newItem];
    
    // Update the collection metadata
    const updatedMetadata: CollectionMetadata = {
      ...collection.metadata,
      updatedAt: new Date().toISOString()
    };

    // Update the collection object
    const updatedCollection: Collection = {
      ...collection,
      metadata: updatedMetadata,
      items: updatedItems
    };

    // Store the updated collection
    const storageKey = this.index.byId.get(collectionId);
    if (!storageKey) {
      return null;
    }

    // Remove old indexes
    this.removeCollectionFromIndexes(collectionId, collection);

    // Store the updated collection
    const collectionJson = JSON.stringify(updatedCollection);
    const storedValue = this.config.enableEncryption && this.config.encryptionKey
      ? this.encryptData(collectionJson, this.config.encryptionKey)
      : collectionJson;

    this.collections.set(storageKey, storedValue);
    this.metadata.set(collectionId, updatedMetadata);
    this.indexCollection(collectionId, updatedCollection, storageKey);

    return updatedCollection;
  }

  /**
   * Update an item in a collection
   * 
   * @param collectionId - The collection ID
   * @param itemDid - The DID of the item to update
   * @param params - Update parameters
   * @returns The updated collection if successful, null otherwise
   */
  async updateCollectionItem(collectionId: string, itemDid: string, params: UpdateCollectionItemParams): Promise<Collection | null> {
    const collection = await this.getCollectionById(collectionId);
    if (!collection) {
      return null;
    }

    // Find the item in the collection
    const itemIndex = collection.items.findIndex(item => item.did === itemDid);
    if (itemIndex === -1) {
      return null; // Item not found in collection
    }

    // Update the item
    const updatedItems = [...collection.items];
    updatedItems[itemIndex] = {
      ...updatedItems[itemIndex],
      ...(params as Partial<CollectionItem>)
    };

    // Update the collection metadata
    const updatedMetadata: CollectionMetadata = {
      ...collection.metadata,
      updatedAt: new Date().toISOString()
    };

    // Update the collection object
    const updatedCollection: Collection = {
      ...collection,
      metadata: updatedMetadata,
      items: updatedItems
    };

    // Store the updated collection
    const storageKey = this.index.byId.get(collectionId);
    if (!storageKey) {
      return null;
    }

    // Remove old indexes
    this.removeCollectionFromIndexes(collectionId, collection);

    // Store the updated collection
    const collectionJson = JSON.stringify(updatedCollection);
    const storedValue = this.config.enableEncryption && this.config.encryptionKey
      ? this.encryptData(collectionJson, this.config.encryptionKey)
      : collectionJson;

    this.collections.set(storageKey, storedValue);
    this.metadata.set(collectionId, updatedMetadata);
    this.indexCollection(collectionId, updatedCollection, storageKey);

    return updatedCollection;
  }

  /**
   * Remove an item from a collection
   * 
   * @param collectionId - The collection ID
   * @param itemDid - The DID of the item to remove
   * @returns The updated collection if successful, null otherwise
   */
  async removeItemFromCollection(collectionId: string, itemDid: string): Promise<Collection | null> {
    const collection = await this.getCollectionById(collectionId);
    if (!collection) {
      return null;
    }

    // Check if the item exists in the collection
    const itemIndex = collection.items.findIndex(item => item.did === itemDid);
    if (itemIndex === -1) {
      return collection; // Item not found, return unchanged collection
    }

    // Remove the item from the collection
    const updatedItems = collection.items.filter(item => item.did !== itemDid);

    // Update the collection metadata
    const updatedMetadata: CollectionMetadata = {
      ...collection.metadata,
      updatedAt: new Date().toISOString()
    };

    // Update the collection object
    const updatedCollection: Collection = {
      ...collection,
      metadata: updatedMetadata,
      items: updatedItems
    };

    // Store the updated collection
    const storageKey = this.index.byId.get(collectionId);
    if (!storageKey) {
      return null;
    }

    // Remove old indexes
    this.removeCollectionFromIndexes(collectionId, collection);

    // Store the updated collection
    const collectionJson = JSON.stringify(updatedCollection);
    const storedValue = this.config.enableEncryption && this.config.encryptionKey
      ? this.encryptData(collectionJson, this.config.encryptionKey)
      : collectionJson;

    this.collections.set(storageKey, storedValue);
    this.metadata.set(collectionId, updatedMetadata);
    this.indexCollection(collectionId, updatedCollection, storageKey);

    return updatedCollection;
  }

  /**
   * Delete a collection
   * 
   * @param id - The collection ID to delete
   * @returns Whether the deletion was successful
   */
  async deleteCollection(id: string): Promise<boolean> {
    const storageKey = this.index.byId.get(id);
    if (!storageKey) {
      return false;
    }

    // Get the collection for index removal
    const collection = await this.getCollectionById(id);
    if (!collection) {
      return false;
    }

    // Remove from indexes
    this.removeCollectionFromIndexes(id, collection);

    // Remove from storage
    this.collections.delete(storageKey);
    this.metadata.delete(id);

    return true;
  }

  /**
   * Set the credential for a collection
   * 
   * @param collectionId - The collection ID
   * @param credentialId - The credential ID
   * @returns The updated collection if successful, null otherwise
   */
  async setCollectionCredential(collectionId: string, credentialId: string): Promise<Collection | null> {
    const collection = await this.getCollectionById(collectionId);
    if (!collection) {
      return null;
    }

    // Update the collection metadata
    const updatedMetadata: CollectionMetadata = {
      ...collection.metadata,
      updatedAt: new Date().toISOString()
    };

    // Update the collection object
    const updatedCollection: Collection = {
      ...collection,
      metadata: updatedMetadata,
      credential: {
        ...collection.credential,
        id: credentialId
      } as any // Type assertion as we don't have the full credential here
    };

    // Store the updated collection
    const storageKey = this.index.byId.get(collectionId);
    if (!storageKey) {
      return null;
    }

    // Remove old indexes
    this.removeCollectionFromIndexes(collectionId, collection);

    // Store the updated collection
    const collectionJson = JSON.stringify(updatedCollection);
    const storedValue = this.config.enableEncryption && this.config.encryptionKey
      ? this.encryptData(collectionJson, this.config.encryptionKey)
      : collectionJson;

    this.collections.set(storageKey, storedValue);
    this.metadata.set(collectionId, updatedMetadata);
    this.indexCollection(collectionId, updatedCollection, storageKey);

    return updatedCollection;
  }

  /**
   * Get statistics about the collection store
   * 
   * @returns Statistics about the store
   */
  async getStats(): Promise<CollectionStoreStats> {
    const totalCollections = this.collections.size;
    const uniqueCurators = new Set(Array.from(this.index.byCurator.keys())).size;
    const uniqueItems = new Set(Array.from(this.index.byItem.keys())).size;

    // Count collections by category
    const collectionsByCategory: Record<string, number> = {};
    for (const [category, collections] of this.index.byCategory.entries()) {
      collectionsByCategory[category] = collections.size;
    }

    return {
      totalCollections,
      uniqueCurators,
      uniqueItems,
      collectionsByCategory,
      encryptionEnabled: this.config.enableEncryption || false
    };
  }

  /**
   * Generate a unique storage key for a collection
   * 
   * @returns A unique storage key
   */
  private generateStorageKey(): string {
    return uuidv4();
  }

  /**
   * Encrypt data using AES-256-GCM
   * 
   * @param data - Data to encrypt
   * @param key - Encryption key
   * @returns Encrypted data
   */
  private encryptData(data: string, key: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(key), iv);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag().toString('hex');
    
    return iv.toString('hex') + ':' + authTag + ':' + encrypted;
  }

  /**
   * Decrypt data using AES-256-GCM
   * 
   * @param encryptedData - Data to decrypt
   * @param key - Encryption key
   * @returns Decrypted data
   */
  private decryptData(encryptedData: string, key: string): string {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encryptedText = parts[2];
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(key), iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Add a collection to the indexes
   * 
   * @param id - Collection ID
   * @param collection - The collection
   * @param storageKey - Storage key for the collection
   */
  private indexCollection(id: string, collection: Collection, storageKey: string): void {
    // Index by ID
    this.index.byId.set(id, storageKey);
    
    // Index by curator
    const curatorSet = this.index.byCurator.get(collection.curatorDid) || new Set<string>();
    curatorSet.add(id);
    this.index.byCurator.set(collection.curatorDid, curatorSet);
    
    // Index by items
    for (const item of collection.items) {
      const itemSet = this.index.byItem.get(item.did) || new Set<string>();
      itemSet.add(id);
      this.index.byItem.set(item.did, itemSet);
    }
    
    // Index by category
    const categorySet = this.index.byCategory.get(collection.metadata.category) || new Set<string>();
    categorySet.add(id);
    this.index.byCategory.set(collection.metadata.category, categorySet);
    
    // Index by tags
    if (collection.metadata.tags) {
      for (const tag of collection.metadata.tags) {
        const tagSet = this.index.byTag.get(tag) || new Set<string>();
        tagSet.add(id);
        this.index.byTag.set(tag, tagSet);
      }
    }
    
    // Index by inscription ID if present
    if (collection.metadata.inscriptionId) {
      const inscriptionSet = this.index.byInscription.get(collection.metadata.inscriptionId) || new Set<string>();
      inscriptionSet.add(id);
      this.index.byInscription.set(collection.metadata.inscriptionId, inscriptionSet);
    }
  }

  /**
   * Remove a collection from indexes
   * 
   * @param id - Collection ID
   * @param collection - The collection
   */
  private removeCollectionFromIndexes(id: string, collection: Collection): void {
    // Remove from ID index
    this.index.byId.delete(id);
    
    // Remove from curator index
    const curatorSet = this.index.byCurator.get(collection.curatorDid);
    if (curatorSet) {
      curatorSet.delete(id);
      if (curatorSet.size === 0) {
        this.index.byCurator.delete(collection.curatorDid);
      }
    }
    
    // Remove from items index
    for (const item of collection.items) {
      const itemSet = this.index.byItem.get(item.did);
      if (itemSet) {
        itemSet.delete(id);
        if (itemSet.size === 0) {
          this.index.byItem.delete(item.did);
        }
      }
    }
    
    // Remove from category index
    const categorySet = this.index.byCategory.get(collection.metadata.category);
    if (categorySet) {
      categorySet.delete(id);
      if (categorySet.size === 0) {
        this.index.byCategory.delete(collection.metadata.category);
      }
    }
    
    // Remove from tags index
    if (collection.metadata.tags) {
      for (const tag of collection.metadata.tags) {
        const tagSet = this.index.byTag.get(tag);
        if (tagSet) {
          tagSet.delete(id);
          if (tagSet.size === 0) {
            this.index.byTag.delete(tag);
          }
        }
      }
    }
    
    // Remove from inscription index if present
    if (collection.metadata.inscriptionId) {
      const inscriptionSet = this.index.byInscription.get(collection.metadata.inscriptionId);
      if (inscriptionSet) {
        inscriptionSet.delete(id);
        if (inscriptionSet.size === 0) {
          this.index.byInscription.delete(collection.metadata.inscriptionId);
        }
      }
    }
  }

  /**
   * Create a backup of the collection store
   * 
   * @param backupPath - Path to store the backup
   * @returns Whether the backup was successful
   */
  async createBackup(backupPath: string): Promise<boolean> {
    try {
      // Ensure the directory exists
      const dir = path.dirname(backupPath);
      await fs.mkdir(dir, { recursive: true });
      
      // Create a backup object
      const backup = {
        collections: Object.fromEntries(this.collections.entries()),
        metadata: Object.fromEntries(this.metadata.entries()),
        timestamp: new Date().toISOString()
      };
      
      // Write to file
      await fs.writeFile(backupPath, JSON.stringify(backup, null, 2), 'utf8');
      
      return true;
    } catch (error) {
      console.error('Error creating backup:', error);
      return false;
    }
  }

  /**
   * Restore from a backup
   * 
   * @param backupPath - Path to the backup file
   * @returns Whether the restore was successful
   */
  async restoreFromBackup(backupPath: string): Promise<boolean> {
    try {
      // Read the backup file
      const backupData = await fs.readFile(backupPath, 'utf8');
      const backup = JSON.parse(backupData);
      
      // Clear existing data
      this.collections.clear();
      this.metadata.clear();
      this.index.byId.clear();
      this.index.byCurator.clear();
      this.index.byItem.clear();
      this.index.byCategory.clear();
      this.index.byTag.clear();
      this.index.byInscription.clear();
      
      // Restore collections and metadata
      for (const [key, value] of Object.entries(backup.collections)) {
        if (typeof value === 'string') {
          this.collections.set(key, value);
        }
      }
      
      for (const [key, value] of Object.entries(backup.metadata)) {
        this.metadata.set(key, value as CollectionMetadata);
      }
      
      // Rebuild indexes
      for (const id of this.metadata.keys()) {
        const collection = await this.getCollectionById(id);
        if (collection) {
          const storageKey = this.index.byId.get(id);
          if (storageKey) {
            this.indexCollection(id, collection, storageKey);
          }
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error restoring from backup:', error);
      return false;
    }
  }

  /**
   * Clean up any resources, such as auto-save timer
   */
  dispose(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }
  }
}

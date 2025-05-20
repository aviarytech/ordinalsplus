/**
 * @module key-management/key-storage
 * @description Provides interfaces and implementations for key storage
 */

import { v4 as uuidv4 } from 'uuid';
import { KeyPair } from './key-pair-generator';
import crypto from 'crypto';

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

/**
 * Options for the encrypted key storage
 */
export interface EncryptedStorageOptions {
  /**
   * Master password used for encryption and decryption
   * This should be a strong password or ideally a derived key from a password
   */
  masterPassword: string;
  
  /**
   * Optional backing storage - defaults to in-memory storage
   */
  backingStorage?: KeyStorage;
  
  /**
   * Encryption algorithm to use - defaults to 'aes-256-gcm'
   */
  algorithm?: string;
  
  /**
   * Key derivation iterations - defaults to 10000
   */
  iterations?: number;
}

/**
 * Encrypted storage implementation for key pairs
 * Uses AES-256-GCM encryption to securely store keys
 */
export class EncryptedKeyStorage implements KeyStorage {
  private storage: KeyStorage;
  private masterKey: Buffer;
  private algorithm: string;
  private iterations: number;
  
  /**
   * Create a new encrypted key storage
   * 
   * @param options - Configuration for encryption
   */
  constructor(options: EncryptedStorageOptions) {
    this.storage = options.backingStorage || new InMemoryKeyStorage();
    this.algorithm = options.algorithm || 'aes-256-gcm';
    this.iterations = options.iterations || 10000;
    
    // Derive a key from the master password
    // In a real implementation, this should use a more secure key derivation
    const salt = crypto.randomBytes(16);
    this.masterKey = crypto.pbkdf2Sync(
      options.masterPassword, 
      salt, 
      this.iterations, 
      32, 
      'sha256'
    );
  }
  
  /**
   * Encrypt a key pair for storage
   * 
   * @param keyPair - The key pair to encrypt
   * @returns The encrypted key pair data
   */
  private encryptKeyPair(keyPair: KeyPair): EncryptedKeyPair {
    // Convert the key pair to a JSON string
    const serialized = JSON.stringify({
      ...keyPair,
      privateKey: Buffer.from(keyPair.privateKey).toString('base64'),
      publicKey: Buffer.from(keyPair.publicKey).toString('base64')
    });
    
    // Create an initialization vector
    const iv = crypto.randomBytes(16);
    
    // Create a cipher with GCM mode
    const cipher = crypto.createCipheriv(
      this.algorithm, 
      this.masterKey, 
      iv
    ) as crypto.CipherGCM;
    
    // Encrypt the data
    let encrypted = cipher.update(serialized, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    // Get the authentication tag (specific to GCM mode)
    const authTag = cipher.getAuthTag();
    
    // Return the encrypted data with metadata
    return {
      id: keyPair.id,
      encryptedData: encrypted,
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      createdAt: keyPair.createdAt,
      metadata: {
        type: keyPair.type,
        ...(keyPair.metadata || {})
      }
    };
  }
  
  /**
   * Decrypt an encrypted key pair
   * 
   * @param encryptedKeyPair - The encrypted key pair data
   * @returns The decrypted key pair
   */
  private decryptKeyPair(encryptedKeyPair: EncryptedKeyPair): KeyPair {
    // Parse the IV and auth tag
    const iv = Buffer.from(encryptedKeyPair.iv, 'base64');
    const authTag = Buffer.from(encryptedKeyPair.authTag, 'base64');
    
    // Create a decipher with GCM mode
    const decipher = crypto.createDecipheriv(
      this.algorithm, 
      this.masterKey, 
      iv
    ) as crypto.DecipherGCM;
    
    // Set the authentication tag (specific to GCM mode)
    decipher.setAuthTag(authTag);
    
    // Decrypt the data
    let decrypted = decipher.update(encryptedKeyPair.encryptedData, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    // Parse the decrypted JSON
    const keyPairData = JSON.parse(decrypted);
    
    // Convert the base64 key data back to Uint8Array
    return {
      ...keyPairData,
      privateKey: new Uint8Array(Buffer.from(keyPairData.privateKey, 'base64')),
      publicKey: new Uint8Array(Buffer.from(keyPairData.publicKey, 'base64'))
    };
  }
  
  /**
   * Store a key pair
   * 
   * @param keyPair - The key pair to store
   * @param alias - Optional alias for the key
   * @returns The ID of the stored key
   */
  async storeKey(keyPair: KeyPair, alias?: string): Promise<string> {
    // Encrypt the key pair
    const encryptedKeyPair = this.encryptKeyPair(keyPair);
    
    // Store the encrypted data in the backing storage
    // Using the same ID from the original key pair
    await this.storage.storeKey(encryptedKeyPair as any, alias);
    
    return keyPair.id;
  }
  
  /**
   * Retrieve a key pair by ID
   * 
   * @param id - The ID of the key to retrieve
   * @returns The key pair, or null if not found
   */
  async getKey(id: string): Promise<KeyPair | null> {
    // Retrieve the encrypted key pair from storage
    const encryptedKeyPair = await this.storage.getKey(id) as unknown as EncryptedKeyPair;
    if (!encryptedKeyPair) return null;
    
    // Decrypt and return the key pair
    try {
      return this.decryptKeyPair(encryptedKeyPair);
    } catch (error) {
      console.error('Error decrypting key pair:', error);
      return null;
    }
  }
  
  /**
   * Retrieve a key pair by alias
   * 
   * @param alias - The alias of the key to retrieve
   * @returns The key pair, or null if not found
   */
  async getKeyByAlias(alias: string): Promise<KeyPair | null> {
    // Retrieve the encrypted key pair from storage by alias
    const encryptedKeyPair = await this.storage.getKeyByAlias(alias) as unknown as EncryptedKeyPair;
    if (!encryptedKeyPair) return null;
    
    // Decrypt and return the key pair
    try {
      return this.decryptKeyPair(encryptedKeyPair);
    } catch (error) {
      console.error('Error decrypting key pair:', error);
      return null;
    }
  }
  
  /**
   * List all stored keys
   * 
   * @returns An array of stored key pairs
   */
  async listKeys(): Promise<Array<KeyPair>> {
    // Retrieve all encrypted key pairs
    const encryptedKeyPairs = await this.storage.listKeys() as unknown as EncryptedKeyPair[];
    
    // Decrypt each key pair
    const keyPairs: KeyPair[] = [];
    for (const encryptedKeyPair of encryptedKeyPairs) {
      try {
        const keyPair = this.decryptKeyPair(encryptedKeyPair);
        keyPairs.push(keyPair);
      } catch (error) {
        console.error(`Error decrypting key pair ${encryptedKeyPair.id}:`, error);
      }
    }
    
    return keyPairs;
  }
  
  /**
   * Delete a key pair by ID
   * 
   * @param id - The ID of the key to delete
   * @returns True if the key was deleted, false if not found
   */
  async deleteKey(id: string): Promise<boolean> {
    return this.storage.deleteKey(id);
  }
  
  /**
   * Delete a key pair by alias
   * 
   * @param alias - The alias of the key to delete
   * @returns True if the key was deleted, false if not found
   */
  async deleteKeyByAlias(alias: string): Promise<boolean> {
    return this.storage.deleteKeyByAlias(alias);
  }
  
  /**
   * Clear all stored keys
   * 
   * @returns The number of keys deleted
   */
  async clear(): Promise<number> {
    return this.storage.clear();
  }
  
  /**
   * Change the master password
   * 
   * @param newPassword - The new master password
   * @returns True if the password was changed successfully
   */
  async changeMasterPassword(newPassword: string): Promise<boolean> {
    try {
      // Get all current keys
      const currentKeys = await this.listKeys();
      
      // Create a new storage with the new password
      const newStorage = new EncryptedKeyStorage({
        masterPassword: newPassword,
        backingStorage: this.storage,
        algorithm: this.algorithm,
        iterations: this.iterations
      });
      
      // Clear the storage
      await this.storage.clear();
      
      // Re-encrypt and store all keys with the new password
      for (const key of currentKeys) {
        await newStorage.storeKey(key);
      }
      
      // Update our master key
      this.masterKey = newStorage.masterKey;
      
      return true;
    } catch (error) {
      console.error('Error changing master password:', error);
      return false;
    }
  }
}

/**
 * Interface for an encrypted key pair
 */
interface EncryptedKeyPair {
  id: string;
  encryptedData: string;
  iv: string;
  authTag: string;
  createdAt: Date;
  metadata: {
    type: string;
    [key: string]: any;
  };
} 
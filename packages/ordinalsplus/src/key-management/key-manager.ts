/**
 * @module key-management/key-manager
 * @description Provides a high-level API for key management, combining generation and storage
 */

import { KeyPair, KeyPairGenerator, KeyPairGeneratorOptions, KeyType } from './key-pair-generator';
import { InMemoryKeyStorage, KeyStorage } from './key-storage';
import { bytesToHex } from '@noble/hashes/utils';

/**
 * Configuration options for KeyManager
 */
export interface KeyManagerOptions {
  storage?: KeyStorage;
  defaultKeyType?: KeyType;
  defaultNetwork?: string;
}

/**
 * Key rotation options
 */
export interface KeyRotationOptions {
  /** Whether to archive the old key instead of deleting it */
  archiveOldKey?: boolean;
  /** Custom metadata for the new key */
  metadata?: Record<string, any>;
  /** Specify key generation options for the new key */
  keyGenOptions?: Partial<KeyPairGeneratorOptions>;
}

/**
 * High-level API for key management, combining generation and storage
 */
export class KeyManager {
  private storage: KeyStorage;
  private defaultKeyType: KeyType;
  private defaultNetwork: string;
  
  // Singleton instance
  private static instance: KeyManager;

  /**
   * Get the singleton instance of KeyManager
   * 
   * @param options - Optional configuration options
   * @returns The singleton instance
   */
  public static getInstance(options?: KeyManagerOptions): KeyManager {
    if (!KeyManager.instance) {
      KeyManager.instance = new KeyManager(options);
    }
    return KeyManager.instance;
  }

  /**
   * Create a new KeyManager instance
   * 
   * @param options - Configuration options
   */
  constructor(options: KeyManagerOptions = {}) {
    this.storage = options.storage || new InMemoryKeyStorage();
    this.defaultKeyType = options.defaultKeyType || 'Ed25519';
    this.defaultNetwork = options.defaultNetwork || 'mainnet';
  }

  /**
   * Generate and store a new key pair
   * 
   * @param options - Key generation options
   * @param alias - Optional alias for the key
   * @returns The ID of the generated key
   */
  async createKey(options: Partial<KeyPairGeneratorOptions & { aliases?: string[] }> = {}, alias?: string): Promise<string> {
    const keyPairOptions: KeyPairGeneratorOptions = {
      type: options.type || this.defaultKeyType,
      network: options.network || this.defaultNetwork as any,
      entropy: options.entropy
    };

    const keyPair = await KeyPairGenerator.generate(keyPairOptions);
    
    // Store with main alias if provided
    const keyId = await this.storage.storeKey(keyPair, alias);
    
    // Store additional aliases if provided
    if (options.aliases && options.aliases.length > 0) {
      for (const additionalAlias of options.aliases) {
        if (additionalAlias !== alias) { // Skip the main alias if it's duplicated
          await this.storage.storeKey(keyPair, additionalAlias);
        }
      }
    }
    
    return keyId;
  }

  /**
   * Import an existing key pair
   * 
   * @param privateKey - The private key to import
   * @param type - The type of the key
   * @param alias - Optional alias for the key
   * @param network - Optional network for the key
   * @returns The ID of the imported key
   */
  async importKey(
    privateKey: Uint8Array,
    type: KeyType,
    alias?: string,
    network?: string
  ): Promise<string> {
    // Validate the private key
    if (!KeyPairGenerator.isValidPrivateKey(privateKey, type)) {
      throw new Error(`Invalid private key for type ${type}`);
    }

    // Generate public key from private key
    const publicKey = await this.derivePublicKey(privateKey, type);

    // Create key pair object
    const keyPair: KeyPair = {
      id: bytesToHex(publicKey).slice(0, 16),
      type,
      privateKey,
      publicKey,
      network: (network || this.defaultNetwork) as any,
      createdAt: new Date()
    };

    // Store the key pair
    return this.storage.storeKey(keyPair, alias);
  }

  /**
   * Rotate a key, replacing an existing key with a new one
   * 
   * @param idOrAlias - The ID or alias of the key to rotate
   * @param options - Key rotation options
   * @returns The ID of the newly generated key
   */
  async rotateKey(idOrAlias: string, options: KeyRotationOptions = {}): Promise<string> {
    // Get the original key
    let originalKey = await this.storage.getKey(idOrAlias);
    if (!originalKey) {
      originalKey = await this.storage.getKeyByAlias(idOrAlias);
    }
    
    if (!originalKey) {
      throw new Error(`Key not found: ${idOrAlias}`);
    }

    // Find the alias if it exists
    const allKeys = await this.storage.listKeys();
    let originalAlias: string | undefined;
    
    for (const [alias, keyId] of Object.entries(
      await this.getAliasesToKeyIdsMap(allKeys)
    )) {
      if (keyId === originalKey.id) {
        originalAlias = alias;
        break;
      }
    }

    // Create new key with the same type and network as the original
    const keyGenOptions = options.keyGenOptions || {};
    const newKeyOptions: KeyPairGeneratorOptions = {
      type: keyGenOptions.type || originalKey.type,
      network: keyGenOptions.network || originalKey.network,
      entropy: keyGenOptions.entropy
    };

    // Generate and store the new key
    const newKeyPair = await KeyPairGenerator.generate(newKeyOptions);
    
    // Add metadata from options if provided
    if (options.metadata) {
      newKeyPair.metadata = {
        ...newKeyPair.metadata,
        ...options.metadata,
        rotatedFrom: originalKey.id,
        rotatedAt: new Date().toISOString()
      };
    } else {
      newKeyPair.metadata = {
        ...newKeyPair.metadata,
        rotatedFrom: originalKey.id,
        rotatedAt: new Date().toISOString()
      };
    }
    
    const newKeyId = await this.storage.storeKey(newKeyPair, originalAlias);

    if (options.archiveOldKey) {
      // Archive the old key by adding metadata and changing alias
      originalKey.metadata = {
        ...originalKey.metadata,
        archived: true,
        archivedAt: new Date().toISOString(),
        replacedBy: newKeyId
      };
      
      // If there was an alias, we've already assigned it to the new key
      if (originalAlias) {
        const archivedAlias = `${originalAlias}-archived-${Date.now()}`;
        await this.storage.storeKey(originalKey, archivedAlias);
      } else {
        await this.storage.storeKey(originalKey);
      }
    } else {
      // Delete the old key
      await this.storage.deleteKey(originalKey.id);
    }

    return newKeyId;
  }

  /**
   * Mark a key as revoked
   * 
   * @param idOrAlias - The ID or alias of the key to revoke
   * @param reason - Optional reason for revocation
   * @returns True if the key was successfully revoked
   */
  async revokeKey(idOrAlias: string, reason?: string): Promise<boolean> {
    // Get the key
    let keyPair = await this.storage.getKey(idOrAlias);
    if (!keyPair) {
      keyPair = await this.storage.getKeyByAlias(idOrAlias);
    }
    
    if (!keyPair) {
      throw new Error(`Key not found: ${idOrAlias}`);
    }

    // Update the key with revocation metadata
    keyPair.metadata = {
      ...keyPair.metadata,
      revoked: true,
      revokedAt: new Date().toISOString(),
      revocationReason: reason || 'No reason provided'
    };

    // Store the updated key
    await this.storage.storeKey(keyPair);
    return true;
  }

  /**
   * Check if a key is revoked
   * 
   * @param idOrAlias - The ID or alias of the key to check
   * @returns True if the key is revoked, false otherwise
   */
  async isKeyRevoked(idOrAlias: string): Promise<boolean> {
    // Get the key
    let keyPair = await this.storage.getKey(idOrAlias);
    if (!keyPair) {
      keyPair = await this.storage.getKeyByAlias(idOrAlias);
    }
    
    if (!keyPair) {
      throw new Error(`Key not found: ${idOrAlias}`);
    }

    return Boolean(keyPair.metadata?.revoked);
  }

  /**
   * Get a key pair by ID
   * 
   * @param id - The ID of the key to retrieve
   * @returns The key pair, or null if not found
   */
  async getKey(id: string): Promise<KeyPair | null> {
    return this.storage.getKey(id);
  }

  /**
   * Get a key pair by alias
   * 
   * @param alias - The alias of the key to retrieve
   * @returns The key pair, or null if not found
   */
  async getKeyByAlias(alias: string): Promise<KeyPair | null> {
    return this.storage.getKeyByAlias(alias);
  }

  /**
   * List all stored keys
   * 
   * @returns An array of key pairs
   */
  async listKeys(): Promise<KeyPair[]> {
    return this.storage.listKeys();
  }

  /**
   * List all active (non-revoked) keys
   * 
   * @returns An array of active key pairs
   */
  async listActiveKeys(): Promise<KeyPair[]> {
    const allKeys = await this.storage.listKeys();
    return allKeys.filter(key => !key.metadata?.revoked);
  }

  /**
   * Delete a key by ID
   * 
   * @param id - The ID of the key to delete
   * @returns True if the key was deleted, false if not found
   */
  async deleteKey(id: string): Promise<boolean> {
    return this.storage.deleteKey(id);
  }

  /**
   * Delete a key by alias
   * 
   * @param alias - The alias of the key to delete
   * @returns True if the key was deleted, false if not found
   */
  async deleteKeyByAlias(alias: string): Promise<boolean> {
    return this.storage.deleteKeyByAlias(alias);
  }

  /**
   * Sign data with a key
   * 
   * @param id - The ID or alias of the key to use for signing
   * @param data - The data to sign
   * @returns The signature as a Uint8Array
   */
  async sign(id: string, data: Uint8Array): Promise<Uint8Array> {
    // Try to get key by ID first, then by alias if not found
    let keyPair = await this.storage.getKey(id);
    if (!keyPair) {
      keyPair = await this.storage.getKeyByAlias(id);
    }

    if (!keyPair) {
      throw new Error(`Key not found: ${id}`);
    }

    // Check if the key is revoked
    if (keyPair.metadata?.revoked) {
      throw new Error(`Cannot sign with revoked key: ${id}`);
    }

    return this.signWithKeyPair(keyPair, data);
  }

  /**
   * Verify a signature
   * 
   * @param id - The ID or alias of the key to use for verification
   * @param data - The data that was signed
   * @param signature - The signature to verify
   * @returns True if the signature is valid
   */
  async verify(id: string, data: Uint8Array, signature: Uint8Array): Promise<boolean> {
    // Try to get key by ID first, then by alias if not found
    let keyPair = await this.storage.getKey(id);
    if (!keyPair) {
      keyPair = await this.storage.getKeyByAlias(id);
    }

    if (!keyPair) {
      throw new Error(`Key not found: ${id}`);
    }

    return this.verifyWithKeyPair(keyPair, data, signature);
  }

  /**
   * Derive a Bitcoin address from a key
   * 
   * @param id - The ID or alias of the key
   * @returns The derived address, or null if address derivation is not supported for the key type
   */
  async deriveAddress(id: string): Promise<string | null> {
    // Try to get key by ID first, then by alias if not found
    let keyPair = await this.storage.getKey(id);
    if (!keyPair) {
      keyPair = await this.storage.getKeyByAlias(id);
    }

    if (!keyPair) {
      throw new Error(`Key not found: ${id}`);
    }

    return KeyPairGenerator.deriveAddress(keyPair);
  }

  /**
   * Convert a key to DID format
   * 
   * @param id - The ID or alias of the key
   * @returns The DID identifier
   */
  async toDid(id: string): Promise<string> {
    // Try to get key by ID first, then by alias if not found
    let keyPair = await this.storage.getKey(id);
    if (!keyPair) {
      keyPair = await this.storage.getKeyByAlias(id);
    }

    if (!keyPair) {
      throw new Error(`Key not found: ${id}`);
    }

    return KeyPairGenerator.toDid(keyPair);
  }

  /**
   * Helper method to map aliases to key IDs
   * 
   * @param keys - The key pairs to process
   * @returns A map of aliases to key IDs
   */
  private async getAliasesToKeyIdsMap(keys: KeyPair[]): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    const aliases = await Promise.all(
      keys.map(async key => {
        // This is a simplified way to get aliases, assuming the storage has a direct way to do this
        // In a real implementation, the storage would provide this information
        return { 
          keyId: key.id, 
          aliases: await this.getAliasesForKey(key.id) 
        };
      })
    );

    for (const item of aliases) {
      for (const alias of item.aliases) {
        result[alias] = item.keyId;
      }
    }

    return result;
  }

  /**
   * Helper method to get all aliases for a key ID
   * 
   * @param keyId - The key ID
   * @returns Array of aliases for the key
   */
  private async getAliasesForKey(keyId: string): Promise<string[]> {
    // This would typically be a direct query to the storage
    // We're simulating it here with a basic implementation
    // A real storage would implement this more efficiently
    const result: string[] = [];
    // For InMemoryKeyStorage, we need to iterate through aliases
    if (this.storage instanceof InMemoryKeyStorage) {
      const storage = this.storage as any;
      for (const [alias, id] of storage.aliases.entries()) {
        if (id === keyId) {
          result.push(alias);
        }
      }
    }
    return result;
  }

  /**
   * Helper method to derive public key from private key
   * 
   * @param privateKey - The private key
   * @param type - The key type
   * @returns The derived public key
   */
  private async derivePublicKey(privateKey: Uint8Array, type: KeyType): Promise<Uint8Array> {
    switch (type) {
      case 'Ed25519':
        return (await import('@noble/ed25519')).getPublicKey(privateKey);
      case 'secp256k1':
        return (await import('@noble/secp256k1')).getPublicKey(privateKey, false);
      case 'schnorr':
        return (await import('@noble/secp256k1')).getPublicKey(privateKey, true);
      default:
        throw new Error(`Unsupported key type: ${type}`);
    }
  }

  /**
   * Helper method to sign data with a key pair
   * 
   * @param keyPair - The key pair to use for signing
   * @param data - The data to sign
   * @returns The signature
   */
  private async signWithKeyPair(keyPair: KeyPair, data: Uint8Array): Promise<Uint8Array> {
    switch (keyPair.type) {
      case 'Ed25519': {
        const ed = await import('@noble/ed25519');
        return ed.sign(data, keyPair.privateKey);
      }
      case 'secp256k1': {
        const secp = await import('@noble/secp256k1');
        const signature = secp.sign(data, keyPair.privateKey);
        return new Uint8Array(Buffer.from(signature.toCompactRawBytes()));
      }
      case 'schnorr': {
        // Currently, schnorr signing is not directly supported in @noble/secp256k1
        // For schnorr, we'll use the same method as secp256k1 but note this is a simplification
        const secp = await import('@noble/secp256k1');
        const signature = secp.sign(data, keyPair.privateKey);
        return new Uint8Array(Buffer.from(signature.toCompactRawBytes()));
      }
      default:
        throw new Error(`Unsupported key type: ${keyPair.type}`);
    }
  }

  /**
   * Helper method to verify a signature with a key pair
   * 
   * @param keyPair - The key pair to use for verification
   * @param data - The data that was signed
   * @param signature - The signature to verify
   * @returns True if the signature is valid
   */
  private async verifyWithKeyPair(
    keyPair: KeyPair,
    data: Uint8Array,
    signature: Uint8Array
  ): Promise<boolean> {
    try {
      switch (keyPair.type) {
        case 'Ed25519': {
          const ed = await import('@noble/ed25519');
          return await ed.verify(signature, data, keyPair.publicKey);
        }
        case 'secp256k1': {
          const secp = await import('@noble/secp256k1');
          console.log('verifyWithKeyPair', signature, data, keyPair.publicKey);
          return secp.verify(signature, data, keyPair.publicKey);
        }
        case 'schnorr': {
          // Currently, schnorr verification is not directly supported in @noble/secp256k1
          // For schnorr, we'll use the same method as secp256k1 but note this is a simplification
          const secp = await import('@noble/secp256k1');
          return secp.verify(signature, data, keyPair.publicKey);
        }
        default:
          return false;
      }
    } catch (error) {
      console.error('Signature verification error:', error);
      return false;
    }
  }
} 
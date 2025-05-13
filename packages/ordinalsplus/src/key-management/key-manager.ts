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
 * High-level API for key management, combining generation and storage
 */
export class KeyManager {
  private storage: KeyStorage;
  private defaultKeyType: KeyType;
  private defaultNetwork: string;

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
  async createKey(options: Partial<KeyPairGeneratorOptions> = {}, alias?: string): Promise<string> {
    const keyPairOptions: KeyPairGeneratorOptions = {
      type: options.type || this.defaultKeyType,
      network: options.network || this.defaultNetwork as any,
      entropy: options.entropy
    };

    const keyPair = await KeyPairGenerator.generate(keyPairOptions);
    return this.storage.storeKey(keyPair, alias);
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
        return new Uint8Array(signature);
      }
      case 'schnorr': {
        // Currently, schnorr signing is not directly supported in @noble/secp256k1
        // For schnorr, we'll use the same method as secp256k1 but note this is a simplification
        const secp = await import('@noble/secp256k1');
        const signature = secp.sign(data, keyPair.privateKey);
        return new Uint8Array(signature);
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
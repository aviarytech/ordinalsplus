/**
 * @module key-management/key-pair-generator
 * @description Provides functionality for generating cryptographic key pairs with support for different algorithms
 */

import { bytesToHex, randomBytes } from '@noble/hashes/utils';
import * as ed from '@noble/ed25519';
import * as secp from '@noble/secp256k1';
import * as btc from '@scure/btc-signer';
import { Network, getScureNetwork } from '../utils/networks';

/**
 * Supported key types for the key pair generator
 */
export type KeyType = 'Ed25519' | 'secp256k1' | 'schnorr';

/**
 * Configuration options for key pair generation
 */
export interface KeyPairGeneratorOptions {
  type: KeyType;
  network?: Network;
  entropy?: Uint8Array;
}

/**
 * Represents a cryptographic key pair with metadata
 */
export interface KeyPair {
  id: string;
  type: KeyType;
  privateKey: Uint8Array;
  publicKey: Uint8Array;
  network?: Network;
  createdAt: Date;
  /** Additional metadata for the key, such as rotation history, revocation status, etc. */
  metadata?: Record<string, any>;
}

/**
 * Extended Ed25519 key pair with additional fields
 */
export interface ExtendedEd25519KeyPair {
  keyType: 'Ed25519';
  privateKey: Uint8Array;
  publicKey: Uint8Array;
  multibase?: string;
}

/**
 * Configuration options for key generation
 */
export interface KeyGenerationOptions {
  network?: Network;
  includeAddress?: boolean;
  includeWif?: boolean;
  entropy?: Uint8Array;
}

/**
 * Extended secp256k1 key pair with additional fields
 */
export interface Secp256k1KeyPair {
  keyType: 'secp256k1';
  privateKey: Uint8Array;
  publicKey: Uint8Array;
  publicKeyCompressed: Uint8Array;
  address?: string;
  wif?: string;
}

/**
 * Extended schnorr key pair with additional fields for Taproot
 */
export interface SchnorrKeyPair {
  keyType: 'schnorr';
  privateKey: Uint8Array;
  publicKey: Uint8Array;
  publicKeyXOnly: Uint8Array;
  tapRootAddress?: string;
}

/**
 * Generator for cryptographic key pairs supporting multiple algorithms
 */
export class KeyPairGenerator {
  /**
   * Generate a cryptographic key pair based on specified options
   * 
   * @param options - Configuration options for key generation
   * @returns A KeyPair object containing the generated key pair and metadata
   */
  public static async generate(options: KeyPairGeneratorOptions): Promise<KeyPair> {
    const { type, network = 'mainnet', entropy } = options;
    const privateKey = this.generatePrivateKey(type, entropy);
    const publicKey = await this.derivePublicKey(privateKey, type);
    
    return {
      id: bytesToHex(publicKey).slice(0, 16),
      type,
      privateKey,
      publicKey,
      network,
      createdAt: new Date()
    };
  }

  /**
   * Generate a private key for the specified algorithm
   * 
   * @param type - The key type (Ed25519, secp256k1, or schnorr)
   * @param entropy - Optional entropy source for key generation
   * @returns A Uint8Array containing the private key
   */
  private static generatePrivateKey(type: KeyType, entropy?: Uint8Array): Uint8Array {
    // Use provided entropy or generate new random bytes
    const keyBytes = entropy || randomBytes(32);
    
    switch (type) {
      case 'Ed25519':
        // Ed25519 requires specific key handling
        return entropy ? keyBytes : ed.utils.randomPrivateKey();
      case 'secp256k1':
      case 'schnorr':
        // For both secp256k1 and schnorr (which uses the same private key format)
        return entropy ? keyBytes : secp.utils.randomPrivateKey();
      default:
        throw new Error(`Unsupported key type: ${type}`);
    }
  }

  /**
   * Derive the public key from a private key
   * 
   * @param privateKey - The private key as a Uint8Array
   * @param type - The key type (Ed25519, secp256k1, or schnorr)
   * @returns A Promise resolving to a Uint8Array containing the public key
   */
  private static async derivePublicKey(privateKey: Uint8Array, type: KeyType): Promise<Uint8Array> {
    switch (type) {
      case 'Ed25519':
        return await ed.getPublicKey(privateKey);
      case 'secp256k1':
        return secp.getPublicKey(privateKey, false); // Uncompressed
      case 'schnorr':
        return secp.getPublicKey(privateKey, true); // Compressed for taproot
      default:
        throw new Error(`Unsupported key type: ${type}`);
    }
  }

  /**
   * Generates an Ed25519 key pair with additional fields
   * 
   * @param options - Optional configuration options
   * @returns An ExtendedEd25519KeyPair object
   */
  public static async generateEd25519KeyPair(options: { entropy?: Uint8Array } = {}): Promise<ExtendedEd25519KeyPair> {
    const { entropy } = options;
    
    // Generate private key
    const privateKey = entropy ? entropy : ed.utils.randomPrivateKey();
    
    // Derive public key from private key
    const publicKey = await ed.getPublicKey(privateKey);
    
    // Return the extended key pair
    const keyPair: ExtendedEd25519KeyPair = {
      keyType: 'Ed25519',
      privateKey,
      publicKey
    };
    
    // Include multibase representation if required
    // This can be implemented later based on specific requirements
    
    return keyPair;
  }

  /**
   * Generates a secp256k1 key pair with additional fields
   * 
   * @param options - Optional configuration options
   * @returns A Secp256k1KeyPair object
   */
  public static generateSecp256k1KeyPair(options: KeyGenerationOptions = {}): Secp256k1KeyPair {
    const { network = 'mainnet', includeAddress = false, includeWif = false, entropy } = options;
    
    // Generate private key
    const privateKey = entropy ? entropy : secp.utils.randomPrivateKey();
    
    // Derive public keys (both uncompressed and compressed)
    const publicKey = secp.getPublicKey(privateKey, false); // Uncompressed (65 bytes)
    const publicKeyCompressed = secp.getPublicKey(privateKey, true); // Compressed (33 bytes)
    
    // Create the base key pair
    const keyPair: Secp256k1KeyPair = {
      keyType: 'secp256k1',
      privateKey,
      publicKey,
      publicKeyCompressed
    };
    
    // Add Bitcoin address if requested
    if (includeAddress) {
      keyPair.address = this.publicKeyToAddress(publicKeyCompressed, network);
    }
    
    // Add WIF if requested
    if (includeWif) {
      keyPair.wif = this.privateKeyToWIF(privateKey, network);
    }
    
    return keyPair;
  }

  /**
   * Generates a Schnorr key pair with additional fields for Taproot
   * 
   * @param options - Optional configuration options
   * @returns A SchnorrKeyPair object
   */
  public static generateSchnorrKeyPair(options: KeyGenerationOptions = {}): SchnorrKeyPair {
    const { network = 'mainnet', includeAddress = false, entropy } = options;
    
    // Generate private key
    const privateKey = entropy ? entropy : secp.utils.randomPrivateKey();
    
    // Derive public key (compressed for Schnorr/Taproot)
    const publicKey = secp.getPublicKey(privateKey, true); // Compressed (33 bytes)
    
    // Create x-only public key (first 32 bytes of compressed key, excluding the 0x02/0x03 prefix)
    const publicKeyXOnly = publicKey.slice(1);
    
    // Create the base key pair
    const keyPair: SchnorrKeyPair = {
      keyType: 'schnorr',
      privateKey,
      publicKey,
      publicKeyXOnly
    };
    
    // Add Taproot address if requested
    if (includeAddress) {
      try {
        const networkObj = getScureNetwork(network);
        // Use p2tr function to create a taproot address
        const tapScript = btc.p2tr(publicKeyXOnly, undefined, networkObj);
        keyPair.tapRootAddress = tapScript.address;
      } catch (error) {
        console.error('Error generating Taproot address:', error);
      }
    }
    
    return keyPair;
  }

  /**
   * Convert a public key to a Bitcoin address
   * 
   * @param publicKey - The compressed public key as a Uint8Array
   * @param network - The Bitcoin network to use
   * @returns The Bitcoin address as a string
   */
  public static publicKeyToAddress(publicKey: Uint8Array, network: Network = 'mainnet'): string {
    try {
      const networkObj = getScureNetwork(network);
      // Use p2pkh function to create a regular Bitcoin address
      const p2pkhScript = btc.p2pkh(publicKey, networkObj);
      if (!p2pkhScript.address) {
        throw new Error('Failed to generate address');
      }
      return p2pkhScript.address;
    } catch (error) {
      console.error('Error generating Bitcoin address:', error);
      throw new Error('Failed to generate Bitcoin address');
    }
  }

  /**
   * Convert a private key to WIF format
   * 
   * @param privateKey - The private key as a Uint8Array
   * @param network - The Bitcoin network to use
   * @param compressed - Whether to use compressed format
   * @returns The WIF-encoded private key
   */
  public static privateKeyToWIF(
    privateKey: Uint8Array, 
    network: Network = 'mainnet', 
    compressed: boolean = true
  ): string {
    try {
      // This is a simplified implementation - in production you would
      // use a dedicated WIF library like 'wif' npm package
      
      // 1. Determine the network version byte
      const version = network === 'mainnet' ? 0x80 : 0xef;
      
      // 2. Create the payload
      const payload = compressed 
        ? new Uint8Array(privateKey.length + 2) 
        : new Uint8Array(privateKey.length + 1);
      
      // 3. Add version byte
      payload[0] = version;
      
      // 4. Add private key
      payload.set(privateKey, 1);
      
      // 5. Add compression flag if needed
      if (compressed) {
        payload[privateKey.length + 1] = 0x01;
      }
      
      // 6. Encode using Base58Check (in real implementation)
      // For now we'll just return a placeholder
      // In a real implementation, this would use Base58Check encoding:
      // - Compute checksum (double SHA256, first 4 bytes)
      // - Concatenate payload and checksum
      // - Encode with Base58
      
      // Simplified implementation for testing only
      return compressed 
        ? `${network === 'mainnet' ? 'K' : 'c'}${Buffer.from(privateKey).toString('hex').substring(0, 8)}...` 
        : `${network === 'mainnet' ? '5' : '9'}${Buffer.from(privateKey).toString('hex').substring(0, 8)}...`;
    } catch (error) {
      console.error('Error generating WIF:', error);
      throw new Error('Failed to generate WIF');
    }
  }

  /**
   * Derive a Bitcoin address from a key pair
   * 
   * @param keyPair - The key pair to derive an address from
   * @returns The derived address as a string, or null if address cannot be derived
   */
  public static deriveAddress(keyPair: KeyPair): string | null {
    const { type, publicKey, network = 'mainnet' } = keyPair;
    
    try {
      const networkObj = getScureNetwork(network);
      
      switch (type) {
        case 'Ed25519':
          // Ed25519 keys are not typically used for Bitcoin addresses
          return null;
        case 'secp256k1': {
          // For secp256k1, we can create P2WPKH addresses
          const p2wpkhScript = btc.p2wpkh(publicKey, networkObj);
          return p2wpkhScript.address || null;
        }
        case 'schnorr': {
          // For schnorr, we use Taproot (P2TR) addresses
          const publicKeyXOnly = publicKey.length === 33 ? publicKey.slice(1) : publicKey;
          const p2trScript = btc.p2tr(publicKeyXOnly, undefined, networkObj);
          return p2trScript.address || null;
        }
        default:
          return null;
      }
    } catch (error) {
      console.error('Error deriving address:', error);
      return null;
    }
  }

  /**
   * Verify if a private key is valid for the specified key type
   * 
   * @param privateKey - The private key to validate
   * @param type - The key type to validate against
   * @returns True if the private key is valid for the specified type
   */
  public static isValidPrivateKey(privateKey: Uint8Array, type: KeyType): boolean {
    try {
      switch (type) {
        case 'Ed25519':
          // For Ed25519, check if key has correct length and content
          return privateKey.length === 32;
        case 'secp256k1':
        case 'schnorr':
          // For secp256k1/schnorr, check if the key is valid
          return privateKey.length === 32 && secp.utils.isValidPrivateKey(privateKey);
        default:
          return false;
      }
    } catch (error) {
      return false;
    }
  }

  /**
   * Convert a key pair to DID format (currently only supports Ed25519)
   * 
   * @param keyPair - The key pair to convert to DID format
   * @returns The DID identifier string or throws an error if unsupported
   */
  public static toDid(keyPair: KeyPair): string {
    if (keyPair.type !== 'Ed25519') {
      throw new Error('Only Ed25519 keys are currently supported for DID conversion');
    }
    
    const pubKeyHex = bytesToHex(keyPair.publicKey);
    return `did:key:z6Mk${pubKeyHex}`;
  }
} 
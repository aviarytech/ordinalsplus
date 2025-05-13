/**
 * @module key-management/key-pair-generator
 * @description Provides functionality for generating cryptographic key pairs with support for different algorithms
 */

import { bytesToHex } from '@noble/hashes/utils';
import { randomBytes } from 'crypto';
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
   * Derive a Bitcoin address from a key pair
   * 
   * @param keyPair - The key pair to derive an address from
   * @returns The derived address as a string, or null if address cannot be derived
   */
  public static deriveAddress(keyPair: KeyPair): string | null {
    const { type, publicKey, network = 'mainnet' } = keyPair;
    const btcNetwork = getScureNetwork(network);
    
    try {
      switch (type) {
        case 'Ed25519':
          // Ed25519 keys are not typically used for Bitcoin addresses
          return null;
        case 'secp256k1': {
          // For secp256k1, we can create P2WPKH addresses
          const p2wpkhObj = btc.p2wpkh(publicKey);
          if (typeof p2wpkhObj.address === 'function') {
            return p2wpkhObj.address(btcNetwork);
          }
          return null;
        }
        case 'schnorr': {
          // For schnorr, we use Taproot (P2TR) addresses
          const p2trObj = btc.p2tr(publicKey);
          if (typeof p2trObj.address === 'function') {
            return p2trObj.address(btcNetwork);
          }
          return null;
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
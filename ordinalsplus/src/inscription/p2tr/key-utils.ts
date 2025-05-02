/**
 * Key Utilities for P2TR (Pay-to-Taproot) Address Generation for Ordinals
 * 
 * This module provides functions for generating and managing keys for 
 * P2TR addresses used in the ordinals inscription process.
 */

import * as btc from '@scure/btc-signer';
import { schnorr } from '@noble/curves/secp256k1';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { base58 } from '@scure/base';
import { NETWORKS, getScureNetwork } from '../../utils/networks';
import { BitcoinNetwork } from '../../types';

/**
 * Type for a P2TR key pair used in the inscription process
 */
export interface P2TRKeyPair {
  /** The private key as a bytes array */
  privateKey: Uint8Array;
  /** The public key (x-only, 32 bytes) as a bytes array */
  publicKey: Uint8Array;
  /** The public key in hexadecimal format */
  publicKeyHex: string;
}

/**
 * Type for a P2TR address with its corresponding script
 */
export interface P2TRAddressInfo {
  /** The P2TR address */
  address: string;
  /** The output script for the P2TR address */
  script: Uint8Array;
  /** The internal key used in the P2TR address */
  internalKey: Uint8Array;
}

/**
 * Generates a random P2TR key pair
 * 
 * @returns A new random P2TR key pair
 */
export function generateP2TRKeyPair(): P2TRKeyPair {
  const privateKey = schnorr.utils.randomPrivateKey();
  const publicKey = schnorr.getPublicKey(privateKey);
  
  // Convert to x-only key format (remove the first byte which is a prefix)
  const xOnlyPubKey = publicKey.length === 33 ? publicKey.slice(1) : publicKey;
  
  if (xOnlyPubKey.length !== 32) {
    throw new Error(`Invalid x-only public key length: ${xOnlyPubKey.length}`);
  }
  
  return {
    privateKey,
    publicKey: xOnlyPubKey,
    publicKeyHex: bytesToHex(xOnlyPubKey)
  };
}

/**
 * Creates a P2TR key pair from an existing private key
 * 
 * @param privateKey - The private key to use, either as bytes or hex string
 * @returns A P2TR key pair
 */
export function p2trKeyPairFromPrivateKey(privateKey: Uint8Array | string): P2TRKeyPair {
  const privKeyBytes = typeof privateKey === 'string' 
    ? hexToBytes(privateKey) 
    : privateKey;
    
  if (privKeyBytes.length !== 32) {
    throw new Error(`Invalid private key length: ${privKeyBytes.length}`);
  }
  
  const publicKey = schnorr.getPublicKey(privKeyBytes);
  // Convert to x-only key format
  const xOnlyPubKey = publicKey.length === 33 ? publicKey.slice(1) : publicKey;
  
  return {
    privateKey: privKeyBytes,
    publicKey: xOnlyPubKey,
    publicKeyHex: bytesToHex(xOnlyPubKey)
  };
}

/**
 * Creates a P2TR key pair from an existing public key
 * 
 * @param publicKey - The public key to use, either as bytes or hex string
 * @returns A partial P2TR key pair (without private key)
 */
export function p2trKeyPairFromPublicKey(publicKey: Uint8Array | string): Omit<P2TRKeyPair, 'privateKey'> {
  const pubKeyBytes = typeof publicKey === 'string' 
    ? hexToBytes(publicKey) 
    : publicKey;
    
  // Convert to x-only key format if needed
  const xOnlyPubKey = pubKeyBytes.length === 33 ? pubKeyBytes.slice(1) : pubKeyBytes;
  
  if (xOnlyPubKey.length !== 32) {
    throw new Error(`Invalid x-only public key length: ${xOnlyPubKey.length}`);
  }
  
  return {
    publicKey: xOnlyPubKey,
    publicKeyHex: bytesToHex(xOnlyPubKey)
  };
}

/**
 * Converts a WIF (Wallet Import Format) private key to raw bytes
 * 
 * @param wif - The WIF string to convert
 * @returns The private key as bytes
 */
export function wifToPrivateKeyBytes(wif: string): Uint8Array {
  try {
    // Decode base58 WIF string
    const decoded = base58.decode(wif);
    
    // Remove network byte (first) and checksum (last 4 bytes)
    // If the length is 34, it's a compressed key (with 0x01 suffix)
    // If the length is 33, it's an uncompressed key
    const privKeyBytes = decoded.length === 34 
      ? decoded.slice(1, 33) // Compressed key, skip network byte and compression flag
      : decoded.slice(1, 33); // Uncompressed key, skip network byte
      
    return privKeyBytes;
  } catch (e) {
    throw new Error(`Invalid WIF format: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/**
 * Converts a private key to a P2TR address
 * 
 * @param privateKey - The private key to use, either as bytes, hex string, or WIF
 * @param network - The Bitcoin network to use
 * @returns The P2TR address information
 */
export function privateKeyToP2TRAddress(
  privateKey: Uint8Array | string,
  network: BitcoinNetwork = 'mainnet'
): P2TRAddressInfo {
  let privKeyBytes: Uint8Array;
  
  // Handle different input formats
  if (typeof privateKey === 'string') {
    if (privateKey.match(/^[5KL][1-9A-HJ-NP-Za-km-z]{50,51}$/)) {
      // Looks like a WIF format
      privKeyBytes = wifToPrivateKeyBytes(privateKey);
    } else {
      // Assume hex format
      privKeyBytes = hexToBytes(privateKey);
    }
  } else {
    privKeyBytes = privateKey;
  }
  
  // Generate public key
  const keyPair = p2trKeyPairFromPrivateKey(privKeyBytes);
  
  // Get network
  const btcNetwork = getScureNetwork(network);
  
  // Generate P2TR address
  const p2tr = btc.p2tr(keyPair.publicKey, undefined, btcNetwork);
  
  if (!p2tr.address || !p2tr.script) {
    throw new Error('Failed to create P2TR address from private key');
  }
  
  return {
    address: p2tr.address,
    script: p2tr.script,
    internalKey: keyPair.publicKey
  };
}

/**
 * Derives a P2TR address from a public key
 * 
 * @param publicKey - The public key to use, either as bytes or hex string
 * @param network - The Bitcoin network to use
 * @returns The P2TR address information
 */
export function publicKeyToP2TRAddress(
  publicKey: Uint8Array | string,
  network: BitcoinNetwork = 'mainnet'
): P2TRAddressInfo {
  // Convert public key to the right format
  const keyPair = p2trKeyPairFromPublicKey(publicKey);
  
  // Get network
  const btcNetwork = getScureNetwork(network);
  
  // Generate P2TR address
  const p2tr = btc.p2tr(keyPair.publicKey, undefined, btcNetwork);
  
  if (!p2tr.address || !p2tr.script) {
    throw new Error('Failed to create P2TR address from public key');
  }
  
  return {
    address: p2tr.address,
    script: p2tr.script,
    internalKey: keyPair.publicKey
  };
} 
/**
 * Key Compatibility Module
 * 
 * Provides backward compatibility with existing codebase by re-exporting key generation
 * functions with the same API as the original functions.
 */

import { 
  KeyPairGenerator,
  Secp256k1KeyPair, 
  SchnorrKeyPair,
  KeyGenerationOptions
} from './key-pair-generator';
import { BitcoinNetwork } from '../types';
import { Ed25519KeyPair } from '../utils/keyUtils';

/**
 * Generates an Ed25519 key pair, compatible with the existing implementation
 * 
 * @returns The generated Ed25519 key pair
 */
export async function generateEd25519KeyPair(): Promise<Ed25519KeyPair> {
  const extendedKeyPair = await KeyPairGenerator.generateEd25519KeyPair();
  // Convert the extended format to the original format
  return {
    publicKey: extendedKeyPair.publicKey,
    secretKey: extendedKeyPair.privateKey
  };
}

/**
 * Generates a secp256k1 key pair
 * 
 * @param options - Generation options
 * @returns The generated secp256k1 key pair
 */
export function generateSecp256k1KeyPair(options?: {
  network?: BitcoinNetwork;
  includeAddress?: boolean;
  includeWif?: boolean;
}): Secp256k1KeyPair {
  const genOptions: KeyGenerationOptions = {
    network: options?.network,
    includeAddress: options?.includeAddress,
    includeWif: options?.includeWif
  };
  
  return KeyPairGenerator.generateSecp256k1KeyPair(genOptions);
}

/**
 * Generates a Schnorr key pair for Taproot addresses
 * 
 * @param options - Generation options
 * @returns The generated Schnorr key pair
 */
export function generateSchnorrKeyPair(options?: {
  network?: BitcoinNetwork;
  includeAddress?: boolean;
}): SchnorrKeyPair {
  const genOptions: KeyGenerationOptions = {
    network: options?.network,
    includeAddress: options?.includeAddress
  };
  
  return KeyPairGenerator.generateSchnorrKeyPair(genOptions);
} 
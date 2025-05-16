/**
 * @module key-management
 * @description Key management system for BTCO DIDs
 */

// Export the main components
export * from './key-pair-generator';
export * from './key-storage';
export * from './key-manager';

// Export a default KeyManager instance for convenience
import { KeyManager } from './key-manager';
export const defaultKeyManager = new KeyManager();

/**
 * Key Management Module
 * 
 * This module provides a comprehensive key management system for BTCO DIDs,
 * including key generation, storage, signing, and verification.
 */

// Re-export from key-pair-generator for backward compatibility
export { 
  generateEd25519KeyPair,
  generateSecp256k1KeyPair,
  generateSchnorrKeyPair,
} from './key-compatibility';
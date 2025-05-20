/**
 * @module utils/networks
 * @description Provides network definitions and utilities for Bitcoin-related operations
 */

import * as btc from '@scure/btc-signer';

/**
 * Supported Bitcoin networks
 */
export type Network = 'mainnet' | 'testnet' | 'regtest' | 'signet';

/**
 * Network parameters for different Bitcoin networks
 */
export const NETWORKS: Record<Network, typeof btc.NETWORK> = {
  mainnet: btc.NETWORK,
  testnet: btc.TEST_NETWORK,
  regtest: {
    ...btc.TEST_NETWORK,
    bech32: 'bcrt',
  },
  signet: {
    ...btc.TEST_NETWORK,
    bech32: 'tb',
  },
};

/**
 * Get the scure-btc-signer network object for a given network name
 * 
 * @param network - The network name
 * @returns The scure-btc-signer Network object
 */
export function getScureNetwork(network: Network): typeof btc.NETWORK {
  return NETWORKS[network] || btc.NETWORK;
} 
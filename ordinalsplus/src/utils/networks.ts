import * as btc from '@scure/btc-signer';
import { BitcoinNetwork } from '../types';

/**
 * Unified network definitions for the entire library
 * Using scure-btc-signer's network objects as the base
 */
export const NETWORKS = {
  bitcoin: btc.NETWORK,
  testnet: btc.TEST_NETWORK,
  signet: {
    ...btc.TEST_NETWORK,
    bech32: 'tb',
  },
  regtest: {
    ...btc.TEST_NETWORK,
    bech32: 'bcrt',
  },
};

/**
 * Helper function to get scure-btc-signer network object from network type string
 * 
 * @param networkType The Bitcoin network type ('mainnet', 'testnet', 'signet')
 * @returns The corresponding scure-btc-signer network object
 * @throws Error if the network type is unsupported
 */
export function getScureNetwork(networkType: BitcoinNetwork): typeof btc.NETWORK {
    switch (networkType) {
        case 'mainnet':
            return NETWORKS.bitcoin;
        case 'signet':
            return NETWORKS.signet;
        case 'testnet':
            return NETWORKS.testnet;
        default:
            throw new Error(`Unsupported network type: ${networkType}`);
    }
} 
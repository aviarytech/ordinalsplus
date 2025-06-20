import type { TransactionStatusResponse, NetworkType } from '../types';
import fetchClient from '../utils/fetchUtils';

// Environment controlled network selection
const DEFAULT_NETWORK: NetworkType =
  (process.env.BITCOIN_NETWORK as NetworkType) || 'mainnet';

const MEMPOOL_MAINNET_API_URL =
  process.env.MEMPOOL_MAINNET_API_URL || 'https://mempool.space/api';
const MEMPOOL_TESTNET_API_URL =
  process.env.MEMPOOL_TESTNET_API_URL || 'https://mempool.space/testnet/api';
const MEMPOOL_SIGNET_API_URL =
  process.env.MEMPOOL_SIGNET_API_URL || 'https://mempool.space/signet/api';

const getMempoolApiUrl = (network: NetworkType): string => {
  switch (network) {
    case 'testnet':
      return MEMPOOL_TESTNET_API_URL;
    case 'signet':
      return MEMPOOL_SIGNET_API_URL;
    case 'mainnet':
    default:
      return MEMPOOL_MAINNET_API_URL;
  }
};

export async function getTransactionStatus(
  txid: string,
  network: NetworkType = DEFAULT_NETWORK
): Promise<TransactionStatusResponse> {
  const statusUrl = `${getMempoolApiUrl(network)}/tx/${txid}/status`;
  try {
    const response = await fetchClient.get(statusUrl);

    if (response.status === 404) {
      return { status: 'not_found' };
    }

    const data = response.data as {
      confirmed: boolean;
      block_height?: number;
    };

    if (data.confirmed) {
      return { status: 'confirmed', blockHeight: data.block_height };
    }

    return { status: 'pending' };
  } catch (error) {
    console.error(
      `[blockchainService] Failed to fetch transaction status from ${statusUrl}:`,
      error
    );
    throw new Error('Failed to fetch transaction status');
  }
}

export async function broadcastTransaction(
  signedTxHex: string,
  network: NetworkType = DEFAULT_NETWORK
): Promise<string> {
  const broadcastUrl = `${getMempoolApiUrl(network)}/tx`;

  try {
    const response = await fetchClient.post<string>(broadcastUrl, signedTxHex, {
      headers: { 'Content-Type': 'text/plain' },
      responseType: 'text'
    });

    if (response.status >= 400 || typeof response.data !== 'string') {
      throw new Error(
        `Broadcast failed with status ${response.status}: ${response.data}`
      );
    }

    return response.data.trim();
  } catch (error) {
    console.error('[blockchainService] Transaction broadcast failed:', error);
    throw new Error('Failed to broadcast transaction');
  }
}

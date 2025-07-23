import { describe, it, expect, beforeEach, afterEach, spyOn } from 'bun:test';
import { getTransactionStatus, broadcastTransaction } from '../blockchainService';

let fetchSpy: any;

beforeEach(() => {
  // default network for tests
  process.env.BITCOIN_NETWORK = 'testnet';
  fetchSpy = spyOn(globalThis, 'fetch');
});

afterEach(() => {
  fetchSpy.mockRestore();
});

describe('getTransactionStatus', () => {
  it('returns confirmed status when API confirms', async () => {
    const txid = 'abc';
    fetchSpy.mockResolvedValue(new Response(JSON.stringify({ confirmed: true, block_height: 100 }), { status: 200 }));

    const result = await getTransactionStatus(txid);
    expect(result).toEqual({ status: 'confirmed', blockHeight: 100 });
    expect(fetchSpy).toHaveBeenCalled();
  });

  it('returns pending status when API not confirmed', async () => {
    const txid = 'def';
    fetchSpy.mockResolvedValue(new Response(JSON.stringify({ confirmed: false }), { status: 200 }));

    const result = await getTransactionStatus(txid);
    expect(result).toEqual({ status: 'pending' });
  });

  it('returns not_found when API responds 404', async () => {
    const txid = 'ghi';
    fetchSpy.mockResolvedValue(new Response('', { status: 404 }));

    const result = await getTransactionStatus(txid);
    expect(result).toEqual({ status: 'not_found' });
  });

  it('throws on network error', async () => {
    const txid = 'err';
    fetchSpy.mockRejectedValue(new Error('network fail'));
    await expect(getTransactionStatus(txid)).rejects.toThrow('Failed to fetch transaction status');
  });
});

describe('broadcastTransaction', () => {
  it('returns txid when broadcast succeeds', async () => {
    const txHex = 'deadbeef';
    fetchSpy.mockResolvedValue(new Response('txid123', { status: 200 }));
    const txid = await broadcastTransaction(txHex);
    expect(txid).toBe('txid123');
    expect(fetchSpy).toHaveBeenCalled();
  });

  it('throws when broadcast fails', async () => {
    const txHex = 'deadbeef';
    fetchSpy.mockResolvedValue(new Response('error', { status: 500 }));
    await expect(broadcastTransaction(txHex)).rejects.toThrow('Failed to broadcast transaction');
  });
});

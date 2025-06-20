import { describe, it, expect, beforeEach, vi } from 'bun:test';
import CollectionInscriptionController from '../collectionInscriptionController';

const service = {
  startInscription: vi.fn(),
  getInscription: vi.fn(),
  getInscriptionsForCollection: vi.fn(),
  cancelInscription: vi.fn(),
  verifyCollectionInscription: vi.fn()
};

let controller: CollectionInscriptionController;

beforeEach(() => {
  vi.clearAllMocks();
  controller = new CollectionInscriptionController(service as any);
});

describe('CollectionInscriptionController', () => {
  it('starts inscription process', async () => {
    service.startInscription.mockResolvedValueOnce({ id: '1', status: 'pending', collectionId: 'c1', requesterDid: 'did:1' });
    const res = await controller.startInscription({} as any);
    expect(res.status).toBe('success');
    expect(res.data?.inscriptionId).toBe('1');
  });

  it('returns not found when getting unknown inscription', async () => {
    service.getInscription.mockResolvedValueOnce(null);
    const res = await controller.getInscriptionStatus('missing');
    expect(res.status).toBe('error');
  });
});

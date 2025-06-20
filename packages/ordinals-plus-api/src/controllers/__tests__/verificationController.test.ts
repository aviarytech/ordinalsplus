import { describe, it, expect, beforeEach, vi } from 'bun:test';
import VerificationController from '../verificationController';
import { VerificationStatus } from '../../types/verification';

const mockService = {
  verifyInscription: vi.fn(),
  verifyCredential: vi.fn(),
  getIssuerInfo: vi.fn()
};

let controller: VerificationController;

beforeEach(() => {
  vi.clearAllMocks();
  controller = new VerificationController(mockService as any);
});

describe('VerificationController', () => {
  it('returns error when inscription id is missing', async () => {
    const result = await controller.verifyInscription('');
    expect(result).toEqual({ status: 'error', message: 'Missing inscription ID' });
  });

  it('formats verification response from service', async () => {
    const serviceResult = {
      status: VerificationStatus.VALID,
      credential: { id: 'cred1', expirationDate: new Date(Date.now()+1000).toISOString() },
      inscriptionId: 'abc'
    };
    mockService.verifyInscription.mockResolvedValueOnce(serviceResult);
    const res = await controller.verifyInscription('abc');
    expect(res.status).toBe(VerificationStatus.VALID);
    expect(res.details.inscriptionId).toBe('abc');
    expect(res.details.checks.length).toBeGreaterThan(0);
  });

  it('handles credential verification errors', async () => {
    const result = await controller.verifyCredential({ credential: undefined });
    expect(result).toEqual({ status: 'error', message: 'Missing credential in request body' });
  });

  it('gets issuer info', async () => {
    mockService.getIssuerInfo.mockResolvedValueOnce({ did: 'did:example:123' });
    const res = await controller.getIssuerInfo('did:example:123');
    expect(res).toEqual({ status: 'success', issuer: { did: 'did:example:123' } });
  });
});

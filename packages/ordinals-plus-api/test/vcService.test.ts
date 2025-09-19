import { describe, it, expect, beforeAll, mock, spyOn } from 'bun:test';
import { VCService } from '../src/services/vcService';
import { DIDService } from '../src/services/didService';
import canonicalize from 'canonicalize';
import { sign, getPublicKey } from '@noble/ed25519';
import { base58btc } from 'multiformats/bases/base58';
import { ProofType, type VerifiableCredential } from '../src/types/verifiableCredential';

class MockDIDService extends DIDService {
  private publicKeyMultibase: string;
  
  constructor(publicKeyMultibase: string) {
    super();
    this.publicKeyMultibase = publicKeyMultibase;
  }
  
  async resolve(did: string, _opts?: any): Promise<{ didDocument?: any; error?: string }> {
    return {
      didDocument: {
        id: did,
        verificationMethod: [
          {
            id: `${did}#key-1`,
            type: 'Ed25519VerificationKey2020',
            controller: did,
            publicKeyMultibase: this.publicKeyMultibase
          }
        ],
        assertionMethod: [`${did}#key-1`]
      }
    };
  }
}

// Helper to build a minimal VC with Ed25519 signature
async function buildSignedCredential(privateKey: Uint8Array, issuerDid: string): Promise<VerifiableCredential> {
  const now = '2024-01-01T00:00:00Z';

  // Proof object without proofValue (as required for canonicalization)
  const proofBase: any = {
    type: ProofType.DATA_INTEGRITY,
    created: now,
    proofPurpose: 'assertionMethod',
    verificationMethod: `${issuerDid}#key-1`
  };

  const credential: any = {
    '@context': ['https://www.w3.org/ns/credentials/v2'],
    type: ['VerifiableCredential'],
    issuer: { id: issuerDid },
    issuanceDate: now,
    credentialSubject: { id: 'did:example:subject' },
    proof: { ...proofBase } // no proofValue yet
  };

  // Canonicalize without proofValue
  const canonicalized = canonicalize(credential);
  if (!canonicalized) throw new Error('Canonicalization failed');

  const signature = await sign(Buffer.from(canonicalized), privateKey);
  const proofValue = Buffer.from(signature).toString('base64');

  // Attach proofValue
  credential.proof.proofValue = proofValue;

  return credential as VerifiableCredential;
}

// Generates deterministic keypair for tests
function createTestKeypair() {
  const privateKeyHex = '1'.repeat(64); // simple deterministic hex
  const privateKey = Buffer.from(privateKeyHex, 'hex');
  return privateKey;
}

describe('VCService', () => {
  let vcService: VCService;
  let validCredential: VerifiableCredential;
  let issuerDid: string;
  let mockClient: any;

  beforeAll(async () => {
    // Create test keypair
    const privateKey = createTestKeypair();
    const publicKey = await getPublicKey(privateKey);
    const publicKeyMultibase = 'z' + base58btc.encode(publicKey);
    
    // Set up test DID and credential
    issuerDid = 'did:example:issuer';
    const didService = new MockDIDService(publicKeyMultibase);
    
    // Mock client for testing caching
    mockClient = {
      get: mock(() => Promise.resolve({ data: { test: 'data' } }))
    };
    
    // Create VCService
    vcService = new VCService(didService, {
      acesApiUrl: '',
      acesApiKey: '',
      platformDid: 'did:example:platform',
      enableLogging: false
    });
    
    // Create valid credential for tests
    validCredential = await buildSignedCredential(privateKey, issuerDid);
  });

  describe('verifyCredential', () => {
    it('verifies a valid Ed25519 signed credential', async () => {
      const result = await vcService.verifyCredential(validCredential);
      expect(result).toBe(true);
    });

    it('fails verification for tampered credential', async () => {
      const tampered = JSON.parse(JSON.stringify(validCredential));
      (tampered.credentialSubject as any).id = 'did:example:someoneelse';
      const result = await vcService.verifyCredential(tampered);
      expect(result).toBe(false);
    });
  });
  
  describe('fetchCachedJsonResource', () => {
    it('should cache results from fetchCachedJsonResource', async () => {
      // Create a mock client for testing caching
      const mockClient = {
        get: mock(() => Promise.resolve({ status: 200, data: { test: 'data' } }))
      };
      
      // Replace the client in vcService with our mock
      (vcService as any).client = mockClient;
      
      // Access the private fetchCachedJsonResource method using any type assertion
      const fetchCachedJsonResource = (vcService as any).fetchCachedJsonResource.bind(vcService);
      
      // First call should make a network request
      const result1 = await fetchCachedJsonResource('https://example.com/resource');
      expect(mockClient.get).toHaveBeenCalledTimes(1);
      
      // Second call to the same URL should use the cache
      const result2 = await fetchCachedJsonResource('https://example.com/resource');
      expect(mockClient.get).toHaveBeenCalledTimes(1); // Still just one call
      
      // Results should be the same
      expect(result1).toEqual(result2);
    });
  });
});
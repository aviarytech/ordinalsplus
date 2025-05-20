import type { OrdinalsPlusMetadataInput } from '../metadataEncoder';
import { encodeOrdinalsPlusMetadata, getEncodedMetadataSize } from '../metadataEncoder';
import { decodeFirst } from 'cbor'; // Using decodeFirst for potentially async nature, adjust if sync

describe('Metadata CBOR Encoding Utilities', () => {
  const mockDidDoc = {
    '@context': ['https://www.w3.org/ns/did/v1'],
    id: 'did:example:123456789abcdefghi',
    verificationMethod: [
      {
        id: 'did:example:123456789abcdefghi#keys-1',
        type: 'Ed25519VerificationKey2018',
        controller: 'did:example:123456789abcdefghi',
        publicKeyBase58: 'H3C2AVvLMv6gmMNam3uVAjZpfkcJCwDwnZn6z3wXmqPV',
      },
    ],
    authentication: ['did:example:123456789abcdefghi#keys-1'],
  };

  const mockVcJson = {
    '@context': [
      'https://www.w3.org/2018/credentials/v1',
      'https://www.w3.org/2018/credentials/examples/v1',
    ],
    id: 'urn:uuid:3978344f-8596-4c3a-a978-8fcaba3903c5',
    type: ['VerifiableCredential', 'UniversityDegreeCredential'],
    issuer: 'https://example.edu/issuers/14',
    issuanceDate: '2010-01-01T19:23:24Z',
    credentialSubject: {
      id: 'did:example:ebfeb1f712ebc6f1c276e12ec21',
      degree: {
        type: 'BachelorDegree',
        name: 'Baccalauréat en musiques numériques',
      },
    },
    proof: {
      type: 'Ed25519Signature2018',
      created: '2023-10-27T12:00:00Z',
      verificationMethod: 'https://example.edu/issuers/14#key-1',
      proofPurpose: 'assertionMethod',
      jws: 'eyJhbGciOiJFZERTQSIsImI2NCI6ZmFsc2UsImNyaXQiOlsiYjY0Il19..exampleSignatureValue',
    },
  };

  const mockVcJwt =
    'eyJhbGciOiJFZERTQSIsImI2NCI6ZmFsc2UsImNyaXQiOlsiYjY0Il19..ZXlKcFpDSTZJalV5TWlVelFYUWlMQ0psYm1NaU9pSkJNVEk0UTBFM09VRkZJaXdpWVhWa0lqcGJJbUpsYkdGallTOHdNREF3TUN3eEtqQXlMemN4TUN3eE1EQXdNREF4TGpBeUxuZGxjakF5TURBeExqQXlNelF4TWpneE1qZ3hPREEwSWl3aWNHbGphM1Z1ZENJNkltSjVZVzJ0WVdkbElpd2ljR2xrSWpvaVkyOXZaMmxtWVhScGIyNXJkV0psYm1WelpYSlRaWEpwWVdSdmJuTWlMQ0p6YVdKMGFXMWxjM1JRWVhocGMyVXNJam9pVm1WeWMybHZiaUk2VzNzaWNIVmlJanBiSW1GMWRHZ3lJanBiSW1ScFpHTnNiM05wY0hWaVFXUnBiMjRpZlEuZXlKcFpDSTZJalV5TWlVelFYUWlMQ0psYm1NaU9pSkJNVEk0UTBFM09VRkZJaXdpWVhWa0lqcGJJbUpsYkdGallTOHdNREF3TUN3eEtqQXlMemN4TUN3eE1EQXdNREF4TGpBeUxuZGxjakF5TURBeExqQXlNelF4TWpneE1qZ3hPREEwSWl3aWNHbGphM1Z1ZENJNkltSjVZVzJ0WVdkbElpd2ljR2xrSWpvaVkyOXZaMmxtWVhScGIyNXJkV0psYm1WelpYSlRaWEpwWVdSdmJuTWlMQ0p6YVdKMGFXMWxjM1JRWVhocGMyVXNJam9pVm1WeWMybHZiaUk2VzNzaWNIVmlJanBiSW1GMWRHZ3lJanBiSW1ScFpHTnNiM05wY0hWaVFXUnBiMjRpZlEuVGVzdFNpZ25hdHVyZQ'; // A non-validated JWT structure for testing encoding

  const expectedPayload = (didDoc: object, vc: object | string) => ({
    didDocument: didDoc,
    verifiableCredential: vc,
  });

  describe('encodeOrdinalsPlusMetadata', () => {
    it('should correctly encode a DID document and a JSON VC', async () => {
      const metadata: OrdinalsPlusMetadataInput = { didDocument: mockDidDoc, verifiableCredential: mockVcJson };
      const encoded = encodeOrdinalsPlusMetadata(metadata);
      expect(encoded).toBeInstanceOf(Buffer);

      const decoded = await decodeFirst(encoded); // decodeFirst is often async
      expect(decoded).toEqual(expectedPayload(mockDidDoc, mockVcJson));
    });

    it('should correctly encode a DID document and a JWT VC', async () => {
      const metadata: OrdinalsPlusMetadataInput = { didDocument: mockDidDoc, verifiableCredential: mockVcJwt };
      const encoded = encodeOrdinalsPlusMetadata(metadata);
      expect(encoded).toBeInstanceOf(Buffer);

      const decoded = await decodeFirst(encoded);
      expect(decoded).toEqual(expectedPayload(mockDidDoc, mockVcJwt));
    });

    it('should throw an error for invalid metadata input (not an object)', () => {
      expect(() => encodeOrdinalsPlusMetadata(null as any)).toThrow('Invalid metadata input: must be an object.');
      expect(() => encodeOrdinalsPlusMetadata('string' as any)).toThrow('Invalid metadata input: must be an object.');
    });

    it('should throw an error for invalid didDocument', () => {
      expect(() => encodeOrdinalsPlusMetadata({ didDocument: null, verifiableCredential: mockVcJson } as any)).toThrow('Invalid didDocument: must be an object.');
      expect(() => encodeOrdinalsPlusMetadata({ didDocument: 'string', verifiableCredential: mockVcJson } as any)).toThrow('Invalid didDocument: must be an object.');
    });

    it('should throw an error for invalid verifiableCredential (not object or string)', () => {
      expect(() => encodeOrdinalsPlusMetadata({ didDocument: mockDidDoc, verifiableCredential: null } as any)).toThrow('Invalid verifiableCredential: cannot be null if an object.');
      expect(() => encodeOrdinalsPlusMetadata({ didDocument: mockDidDoc, verifiableCredential: 123 } as any)).toThrow('Invalid verifiableCredential: must be an object or a string.');
    });

    it('should throw an error for empty string verifiableCredential', () => {
      expect(() => encodeOrdinalsPlusMetadata({ didDocument: mockDidDoc, verifiableCredential: ' ' } as any)).toThrow('Invalid verifiableCredential: cannot be an empty string.');
    });

    it('should encode and decode with complex nested objects correctly', async () => {
      const complexDidDoc = { ...mockDidDoc, service: [{ id: '#service-1', type: 'TestService', serviceEndpoint: 'https://example.com/service' }] };
      const complexVc = { ...mockVcJson, termsOfUse: [{ type: 'restriction', policy: 'https://example.com/tos'}] };
      const metadata: OrdinalsPlusMetadataInput = { didDocument: complexDidDoc, verifiableCredential: complexVc };
      
      const encoded = encodeOrdinalsPlusMetadata(metadata);
      const decoded = await decodeFirst(encoded);
      expect(decoded).toEqual(expectedPayload(complexDidDoc, complexVc));
    });
  });

  describe('getEncodedMetadataSize', () => {
    it('should return the correct buffer length for valid inputs', () => {
      const metadata: OrdinalsPlusMetadataInput = { didDocument: mockDidDoc, verifiableCredential: mockVcJson };
      const directEncoding = encodeOrdinalsPlusMetadata(metadata);
      expect(getEncodedMetadataSize(metadata)).toEqual(directEncoding.length);
    });

    it('should throw for invalid inputs just like encodeOrdinalsPlusMetadata', () => {
      expect(() => getEncodedMetadataSize(null as any)).toThrow('Invalid metadata input: must be an object.');
      expect(() => getEncodedMetadataSize({ didDocument: null, verifiableCredential: mockVcJson } as any)).toThrow('Invalid didDocument: must be an object.');
    });
  });
}); 
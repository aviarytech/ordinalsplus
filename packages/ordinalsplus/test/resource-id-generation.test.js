import { describe, expect, it } from 'bun:test';
import { createDidFromInscriptionData } from '../src/did/did-utils';
describe('Resource ID Generation', () => {
    describe('createDidFromInscriptionData', () => {
        it('should create a valid DID from inscription with sat', () => {
            const inscription = {
                id: '123',
                sat: 1234567890,
                content_url: 'https://ordinalsplus.com/resource/1',
                content_type: 'application/json',
                number: 0,
            };
            const did = createDidFromInscriptionData(inscription, 'mainnet');
            expect(did).toBe('did:btco:1234567890');
        });
        it('should throw error for invalid inscription without sat info', () => {
            const inscription = {
                id: '123',
                number: 0
            };
            expect(() => createDidFromInscriptionData(inscription, 'mainnet'))
                .toThrow('Sat number is required');
        });
        it('should throw error for empty inscription', () => {
            expect(() => createDidFromInscriptionData({}, 'mainnet'))
                .toThrow('Sat number is required');
        });
    });
    it('should generate a valid DID from inscription data', () => {
        const inscription = {
            id: '123',
            content_url: 'https://ordinalsplus.com/resource/1',
            sat: 1234567890,
            content_type: 'application/json',
            number: 0,
        };
        const result = createDidFromInscriptionData(inscription, 'mainnet');
        expect(result).toBe('did:btco:1234567890');
    });
});

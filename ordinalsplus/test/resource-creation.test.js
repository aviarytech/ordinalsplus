import { describe, it, expect, beforeEach, spyOn } from 'bun:test';
import { createResourceTransaction, validateResourceCreationParams } from '../src/transactions/resource-creation';
import * as psbtModule from '../src/transactions/psbt-creation';
// Mock response for createInscriptionPsbts
const mockInscriptionResult = {
    commitPsbtBase64: 'mockCommitPsbt',
    unsignedRevealPsbtBase64: 'mockRevealPsbt',
    revealSignerWif: 'mockWif',
    commitTxOutputValue: 10000,
    revealFee: 1000,
    commitFee: 2000,
    totalFee: 3000
};
describe('Resource Creation Functions', () => {
    // Valid test parameters
    const validParams = {
        content: 'Test content',
        contentType: 'text/plain',
        resourceType: 'notes',
        publicKey: Buffer.from('02a1633cafcc01ebfb6d78e39f687a1f0995c62fc95f51ead10a02ee0be551b5dc', 'hex'),
        changeAddress: 'tb1q9h0yjdupyfpxfjg24rpx755xrplvzd9hz2nj9k',
        recipientAddress: 'tb1q9h0yjdupyfpxfjg24rpx755xrplvzd9hz2nj9k',
        utxos: [
            {
                txid: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
                vout: 0,
                value: 100000,
                scriptPubKey: '0014d85c2b71d0060b09c9886aeb815e50991dda124d'
            }
        ],
        feeRate: 10,
        network: 'signet',
        metadata: { test: 'value' }
    };
    beforeEach(() => {
        // Setup spies for the functions we use
        spyOn(psbtModule, 'createInscriptionPsbts').mockImplementation(async () => mockInscriptionResult);
    });
    describe('validateResourceCreationParams', () => {
        it('should validate correct parameters without throwing', () => {
            expect(() => validateResourceCreationParams(validParams)).not.toThrow();
        });
        it('should throw an error if content is missing', () => {
            const params = { ...validParams, content: undefined };
            expect(() => validateResourceCreationParams(params)).toThrow('Resource content is required');
        });
        it('should throw an error if content type is missing', () => {
            const params = { ...validParams, contentType: undefined };
            expect(() => validateResourceCreationParams(params)).toThrow('Content type is required');
        });
        it('should throw an error if resource type is missing', () => {
            const params = { ...validParams, resourceType: undefined };
            expect(() => validateResourceCreationParams(params)).toThrow('Resource type is required');
        });
        it('should throw an error if public key is invalid', () => {
            const params = { ...validParams, publicKey: 'invalid' };
            expect(() => validateResourceCreationParams(params)).toThrow('Valid public key is required');
        });
        it('should throw an error if the network is unsupported', () => {
            const params = { ...validParams, network: 'unsupported' };
            expect(() => validateResourceCreationParams(params)).toThrow('Unsupported network');
        });
    });
    describe('createResourceTransaction', () => {
        it('should create a resource transaction successfully', async () => {
            // Pass testMode=true to use the fixed fee value instead of trying to calculate
            const result = await createResourceTransaction(validParams, true);
            // Check if PSBT function was called with expected parameters
            expect(psbtModule.createInscriptionPsbts).toHaveBeenCalledWith(expect.objectContaining({
                contentType: validParams.contentType,
                content: validParams.content,
                feeRate: validParams.feeRate,
                recipientAddress: validParams.recipientAddress,
                changeAddress: validParams.changeAddress,
                network: validParams.network
            }));
            // Check result structure
            expect(result).toEqual({
                commitPsbtBase64: mockInscriptionResult.commitPsbtBase64,
                revealPsbtBase64: mockInscriptionResult.unsignedRevealPsbtBase64,
                estimatedFees: 4000 // This is the fixed value from testMode
            });
        });
        it('should handle errors from createInscriptionPsbts', async () => {
            // Override the mock to throw an error
            spyOn(psbtModule, 'createInscriptionPsbts').mockImplementation(async () => {
                throw new Error('Test error');
            });
            // Expect the function to throw with enhanced error message
            await expect(createResourceTransaction(validParams, true)).rejects.toThrow('Failed to create resource transaction: Test error');
        });
    });
});

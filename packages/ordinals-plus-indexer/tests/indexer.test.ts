import { describe, it, expect } from 'bun:test';
import { OrdinalsAnalyzer } from '../src/index';

describe('OrdinalsAnalyzer', () => {
  const analyzer = new OrdinalsAnalyzer();

  it('should detect DID documents from metadata', () => {
    const inscription = { id: 'test-id', number: 123 };
    const metadata = {
      id: 'did:btco:sig:123',
      verificationMethod: ['test-method']
    };

    const result = analyzer.detectOrdinalsResource(inscription, metadata);
    
    expect(result).toBeTruthy();
    expect(result?.ordinalsType).toBe('did-document');
    expect(result?.resourceId).toBe('did:btco:sig:123/0');
  });

  it('should detect Verifiable Credentials from metadata', () => {
    const inscription = { id: 'test-id', number: 456 };
    const metadata = {
      type: ['VerifiableCredential'],
      credentialSubject: { id: 'did:example:123' }
    };

    const result = analyzer.detectOrdinalsResource(inscription, metadata);
    
    expect(result).toBeTruthy();
    expect(result?.ordinalsType).toBe('verifiable-credential');
    expect(result?.resourceId).toBe('vc:btco:sig:456');
  });

  it('should return null for non-Ordinals Plus inscriptions', () => {
    const inscription = { id: 'test-id', number: 789 };
    const metadata = { random: 'data' };

    const result = analyzer.detectOrdinalsResource(inscription, metadata);
    
    expect(result).toBeNull();
  });

  it('should handle invalid inscription data', () => {
    const result = analyzer.detectOrdinalsResource(null, {});
    expect(result).toBeNull();
  });
});

// Note: OrdinalsStorage tests would require a Redis instance
// In a real environment, you'd use a test Redis container

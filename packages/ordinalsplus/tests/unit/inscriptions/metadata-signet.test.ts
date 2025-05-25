import { describe, test, expect } from 'bun:test';
import { utf8 } from '@scure/base';
import { createInscription } from '../../../src/inscription';

// Basic metadata object used for tests
const metadata = {
  name: 'Test Inscription',
  description: 'A test inscription with metadata',
  version: '1.0.0'
};

describe('Signet Metadata Inscription', () => {
  test('metadata should be written and retrievable', () => {
    const result = createInscription({
      content: 'Hello, world!',
      contentType: 'text/plain',
      metadata,
      network: 'signet'
    });

    expect(result).toBeDefined();
    expect(result.inscription.tags.unknown).toBeDefined();

    // Convert unknown tags back to strings
    const extracted: Record<string, string> = {};
    result.inscription.tags.unknown?.forEach(([k, v]) => {
      const key = utf8.encode(k);
      const value = utf8.encode(v);
      extracted[key] = value;
    });

    expect(extracted).toEqual(metadata);
    // Ensure commit address is a valid signet P2TR address
    expect(result.commitAddress.address.startsWith('tb1p')).toBe(true);
  });
});

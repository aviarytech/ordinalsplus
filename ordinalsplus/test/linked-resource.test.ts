import { describe, expect, it } from 'bun:test';
import { createLinkedResourceFromInscription } from '../src/did/did-utils.js';
import { Inscription } from '../src/types/index.js';

describe('createLinkedResourceFromInscription', () => {
  it('should create a linked resource from an inscription with sat', () => {
    const inscription: Inscription = {
      id: '123',
      inscriptionId: '123',
      content: { name: 'test' },
      sat: '1000',
      content_type: 'application/json'
    };

    const result = createLinkedResourceFromInscription(inscription, 'test-type');

    expect(result).toEqual({
      id: 'did:btco:123',
      type: 'test-type',
      inscriptionId: '123',
      contentType: 'application/json',
      content: { name: 'test' },
      sat: '1000'
    });
  });

  it('should create a linked resource from an inscription with sat_ordinal', () => {
    const inscription: Inscription = {
      id: '123',
      inscriptionId: '123',
      content: { name: 'test' },
      sat_ordinal: '1000',
      content_type: 'application/json'
    };

    const result = createLinkedResourceFromInscription(inscription, 'test-type');

    expect(result).toEqual({
      id: 'did:btco:123',
      type: 'test-type',
      inscriptionId: '123',
      contentType: 'application/json',
      content: { name: 'test' },
      sat: '1000'
    });
  });

  it('should handle string content', () => {
    const inscription: Inscription = {
      id: '123',
      inscriptionId: '123',
      content: '{"name": "test"}',
      sat: '1000',
      content_type: 'application/json'
    };

    const result = createLinkedResourceFromInscription(inscription, 'test-type');

    expect(result).toEqual({
      id: 'did:btco:123',
      type: 'test-type',
      inscriptionId: '123',
      contentType: 'application/json',
      content: { name: 'test' },
      sat: '1000'
    });
  });

  it('should handle missing content', () => {
    const inscription: Inscription = {
      id: '123',
      inscriptionId: '123',
      content: null,
      sat: '1000',
      content_type: 'application/json'
    };

    const result = createLinkedResourceFromInscription(inscription, 'test-type');

    expect(result).toEqual({
      id: 'did:btco:123',
      type: 'test-type',
      inscriptionId: '123',
      contentType: 'application/json',
      content: { value: null },
      sat: '1000'
    });
  });
}); 
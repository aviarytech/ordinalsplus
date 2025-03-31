import { describe, expect, it } from 'bun:test';
import { createLinkedResourceFromInscription } from '../src/did/did-utils';
import { Inscription } from '../src/types';

describe('createLinkedResourceFromInscription', () => {
  it('should create a linked resource from an inscription with sat and index', () => {
    const inscription: Inscription = {
      id: '123i0',
      sat: 1000,
      content: { name: 'test' },
      content_type: 'application/json'
    };

    const result = createLinkedResourceFromInscription(inscription, 'test-type');
    expect(result).toEqual({
      content: { value: { name: 'test' } },
      contentType: 'application/json',
      didReference: 'did:btco:1000',
      id: 'did:btco:1000/0',
      inscriptionId: '123i0',
      sat: 1000,
      type: 'test-type'
    });
  });

  it('should handle object content', () => {
    const inscription: Inscription = {
      id: '123i0',
      sat: 1000,
      content: { name: 'test' },
      content_type: 'application/json'
    };

    const result = createLinkedResourceFromInscription(inscription, 'test-type');
    expect(result).toEqual({
      content: { value: { name: 'test' } },
      contentType: 'application/json',
      didReference: 'did:btco:1000',
      id: 'did:btco:1000/0',
      inscriptionId: '123i0',
      sat: 1000,
      type: 'test-type'
    });
  });

  it('should handle non-object content', () => {
    const inscription: Inscription = {
      id: '123i0',
      sat: 1000,
      content: 'test string',
      content_type: 'text/plain'
    };

    const result = createLinkedResourceFromInscription(inscription, 'test-type');
    expect(result).toEqual({
      content: { value: 'test string' },
      contentType: 'text/plain',
      didReference: 'did:btco:1000',
      id: 'did:btco:1000/0',
      inscriptionId: '123i0',
      sat: 1000,
      type: 'test-type'
    });
  });

  it('should handle missing content', () => {
    const inscription: Inscription = {
      id: '123i0',
      sat: 1000,
      content_type: 'application/json'
    };

    const result = createLinkedResourceFromInscription(inscription, 'test-type');
    expect(result).toEqual({
      content: { value: null },
      contentType: 'application/json',
      didReference: 'did:btco:1000',
      id: 'did:btco:1000/0',
      inscriptionId: '123i0',
      sat: 1000,
      type: 'test-type'
    });
  });

  it('should throw error when no index in inscription ID', () => {
    const inscription: Inscription = {
      id: '123',
      content: { name: 'test' },
      sat: 1000,
      content_type: 'application/json'
    };

    expect(() => createLinkedResourceFromInscription(inscription, 'test-type'))
      .toThrow('No valid index found in inscription');
  });

  it('should throw error when no sat number', () => {
    const inscription: Inscription = {
      id: '123i0',
      content: { name: 'test' },
      content_type: 'application/json'
    };

    expect(() => createLinkedResourceFromInscription(inscription, 'test-type'))
      .toThrow('Sat number is required');
  });

  it('should throw error when no inscription ID', () => {
    const inscription: Partial<Inscription> = {
      sat: 1000,
      content: { name: 'test' },
      content_type: 'application/json'
    };

    expect(() => createLinkedResourceFromInscription(inscription as Inscription, 'test-type'))
      .toThrow('Inscription ID is required');
  });
}); 
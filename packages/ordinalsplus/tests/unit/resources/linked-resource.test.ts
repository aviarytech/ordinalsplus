import { describe, expect, it } from 'bun:test';
import { createLinkedResourceFromInscription } from '../src/resources/linked-resource';
import { Inscription } from '../src/types';

describe('createLinkedResourceFromInscription', () => {
  it('should create linked resource from inscription', () => {
    const inscription: Inscription = {
      id: '123i0',
      sat: 123456,
      content_type: 'application/json',
      content_url: 'https://ordinalsplus.com/resource/1',
    };

    const result = createLinkedResourceFromInscription(inscription, 'application/json', 'mainnet');
    expect(result).toEqual({
      id: 'did:btco:123456/0',
      type: 'application/json',
      contentType: 'application/json',
      content_url: 'https://ordinalsplus.com/resource/1',
      inscriptionId: '123i0',
      didReference: 'did:btco:123456',
      sat: 123456
    });
  });

  it('should handle missing inscription ID', () => {
    const inscription: Inscription = {
      id: '',
      sat: 123456,
      content_type: 'application/json',
      content_url: 'https://ordinalsplus.com/resource/1',
    };

    expect(() => createLinkedResourceFromInscription(inscription, 'application/json', 'mainnet')).toThrow('Invalid inscription');
  });

  it('should handle missing content URL', () => {
    const inscription: Inscription = {
      id: '123i0',
      sat: 123456,
      content_type: 'application/json',
      content_url: '',
    };

    const result = createLinkedResourceFromInscription(inscription, 'application/json', 'mainnet');
    expect(result.content_url).toBe('');
  });

  it('should create a linked resource from an inscription with sat and index', () => {
    const inscription: Inscription = {
      id: '123i0',
      sat: 1000,
      content_type: 'application/json',
      content_url: 'https://ordinalsplus.com/resource/1',
    };

    const result = createLinkedResourceFromInscription(inscription, 'test-type', 'mainnet');
    expect(result).toEqual({
      content_url: 'https://ordinalsplus.com/resource/1',
      contentType: 'application/json',
      didReference: 'did:btco:1000',
      id: 'did:btco:1000/0',
      inscriptionId: '123i0',
      sat: 1000,
      type: 'test-type'
    });
  });

  it('should handle different content types', () => {
    const inscription: Inscription = {
      id: '123i0',
      sat: 1000,
      content_type: 'text/plain',
      content_url: 'https://ordinalsplus.com/resource/1',
    };

    const result = createLinkedResourceFromInscription(inscription, 'test-type', 'mainnet');
    expect(result).toEqual({
      content_url: 'https://ordinalsplus.com/resource/1',
      contentType: 'text/plain',
      didReference: 'did:btco:1000',
      id: 'did:btco:1000/0',
      inscriptionId: '123i0',
      sat: 1000,
      type: 'test-type'
    });
  });

  it('should handle missing content URL', () => {
    const inscription: Inscription = {
      id: '123i0',
      sat: 1000,
      content_type: 'application/json',
      content_url: '',
    };

    const result = createLinkedResourceFromInscription(inscription, 'test-type', 'mainnet');
    expect(result).toEqual({
      content_url: '',
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
      sat: 1000,
      content_type: 'application/json',
      content_url: 'https://ordinalsplus.com/resource/1',
    };

    expect(() => createLinkedResourceFromInscription(inscription, 'test-type', 'mainnet'))
      .toThrow('No valid index found in inscription');
  });

  it('should throw error when no sat number', () => {
    const inscription: any = {
      id: '123i0',
      content_type: 'application/json',
      content_url: 'https://ordinalsplus.com/resource/1',
      timestamp: new Date().toISOString()
    };

    expect(() => createLinkedResourceFromInscription(inscription, 'test-type', 'mainnet'))
      .toThrow('Sat number is required');
  });

  it('should throw error when no inscription ID', () => {
    const inscription: Partial<Inscription> = {
      sat: 1000,
      content_type: 'application/json',
      content_url: 'https://ordinalsplus.com/resource/1',
    };

    expect(() => createLinkedResourceFromInscription(inscription as Inscription, 'test-type', 'mainnet'))
      .toThrow('Invalid inscription');
  });
}); 
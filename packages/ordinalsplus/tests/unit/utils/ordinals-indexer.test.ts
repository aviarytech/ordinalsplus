import { describe, expect, test } from 'bun:test';
import { OrdinalsIndexer, MemoryIndexerDatabase } from '../src/indexer';

describe('OrdinalsIndexer', () => {
  test('should create an instance of OrdinalsIndexer', () => {
    const db = new MemoryIndexerDatabase();
    const indexer = new OrdinalsIndexer({
      indexerUrl: 'https://api.example.com/ordinals'
    }, db);
    
    expect(indexer).toBeInstanceOf(OrdinalsIndexer);
  });
}); 
import { describe, expect, it, beforeAll } from 'bun:test';
import { Inscription } from '../src/types';
import { extractSatNumber } from '../src/utils/validators.js';
import { createLinkedResourceFromInscription } from '../src';

// Fetch real inscription data from Ordiscan
const ORDISCAN_API_KEY = process.env.ORDISCAN_API_KEY;
const ORDISCAN_API_URL = 'https://ordiscan.com/api/v1';

if (!ORDISCAN_API_KEY) {
  throw new Error('ORDISCAN_API_KEY environment variable is required');
}

async function fetchRealInscriptions(): Promise<Inscription[]> {
  const response = await fetch(`${ORDISCAN_API_URL}/inscriptions?limit=5`, {
    headers: {
      'Authorization': `Bearer ${ORDISCAN_API_KEY}`
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch inscriptions: ${response.statusText}`);
  }
  
  const data = await response.json() as { inscriptions: Inscription[] };
  return data.inscriptions.map((inscription: any, index: number) => {
    if (!inscription.sat) {
      throw new Error(`Inscription ${inscription.id} is missing required sat number`);
    }
    return {
      id: inscription.id,
      number: inscription.number ?? index,
      sat: Number(inscription.sat),
      content_type: inscription.content_type || 'application/json',
      content_url: inscription.content_url || `https://ordinalsplus.com/resource/${index + 1}`
    };
  });
}

describe('Resource Extraction with Real Data', () => {
  let realInscriptions: Inscription[] = [];

  beforeAll(async () => {
    try {
      realInscriptions = await fetchRealInscriptions();
    } catch (error) {
      console.error('Failed to fetch real inscriptions:', error);
      // Fallback to mock data if API call fails
      realInscriptions = [
        {
          id: '152d8afc7939b66953d9633e4d59c3ed086413d34617619811e8295cdb9388fdi0',
          number: 0,
          sat: 1954913028215432,
          content_type: 'application/json',
          content_url: 'https://ordinalsplus.com/resource/1'
        },
        {
          id: '7d8afc7939b66953d9633e4d59c3ed086413d34617619811e8295cdb9388fdi1',
          number: 1,
          sat: 1954913028215433,
          content_type: 'text/plain',
          content_url: 'https://ordinalsplus.com/resource/2'
        },
        {
          id: '9e8afc7939b66953d9633e4d59c3ed086413d34617619811e8295cdb9388fdi2',
          number: 2,
          sat: 1954913028215434,
          content_type: 'image/png',
          content_url: 'https://ordinalsplus.com/resource/3'
        }
      ];
    }
  });

  describe('Resource ID Generation', () => {
    it('should generate correct resource IDs for real inscriptions', () => {
      for (const inscription of realInscriptions) {
        const resource = createLinkedResourceFromInscription(inscription, 'TestResource', 'testnet');
        expect(resource.id).toBe(`did:btco:${inscription.sat}/${inscription.number}`);
        expect(resource.didReference).toBe(`did:btco:${inscription.sat}`);
      }
    });
  });

  describe('Sat Number Extraction', () => {
    it('should correctly extract sat numbers from real inscriptions', () => {
      for (const inscription of realInscriptions) {
        const satNumber = extractSatNumber(inscription);
        expect(satNumber).toBe(inscription.sat);
      }
    });
  });

  describe('Resource Creation', () => {
    it('should create resources with correct content URLs', () => {
      for (const inscription of realInscriptions) {
        const resource = createLinkedResourceFromInscription(inscription, 'TestResource', 'testnet');
        if (inscription.content_url) {
          expect(resource.content_url).toBe(inscription.content_url);
        }
        if (inscription.content_type) {
          expect(resource.contentType).toBe(inscription.content_type);
        }
      }
    });
  });
}); 
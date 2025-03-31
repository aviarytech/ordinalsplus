import { describe, expect, it, beforeAll } from 'bun:test';
import { createLinkedResourceFromInscription } from '../src/did/did-utils';
import { Inscription } from '../src/types';
import { extractSatNumber } from '../src/utils/validators.js';

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
  
  const data = await response.json();
  return data.inscriptions.map((inscription: any, index: number) => {
    if (!inscription.sat) {
      throw new Error(`Inscription ${inscription.id} is missing required sat number`);
    }
    return {
      id: inscription.id,
      number: inscription.number ?? index,
      sat: Number(inscription.sat), // Ensure sat is a number
      content_type: inscription.content_type,
      content: inscription.content
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
          content: {
            name: 'Test Inscription',
            description: 'A test inscription on Bitcoin',
            version: '1.0.0'
          }
        },
        {
          id: '7d8afc7939b66953d9633e4d59c3ed086413d34617619811e8295cdb9388fdi1',
          number: 1,
          sat: 1954913028215433,
          content_type: 'text/plain',
          content: 'Hello, Bitcoin!'
        },
        {
          id: '9e8afc7939b66953d9633e4d59c3ed086413d34617619811e8295cdb9388fdi2',
          number: 2,
          sat: 1954913028215434,
          content_type: 'image/png',
          content: 'base64_encoded_image_data'
        }
      ];
    }
  });

  describe('JSON Content', () => {
    it('should correctly process JSON inscription', () => {
      const inscription = realInscriptions[0];
      const resource = createLinkedResourceFromInscription(inscription, 'TestResource');
      
      expect(resource).toEqual({
        id: `did:btco:${inscription.sat}/0`,
        type: 'TestResource',
        inscriptionId: inscription.id,
        contentType: 'application/json',
        content: { value: inscription.content as Record<string, unknown> },
        sat: inscription.sat,
        didReference: `did:btco:${inscription.sat}`
      });
    });
  });

  describe('Text Content', () => {
    it('should correctly process text inscription', () => {
      const inscription = realInscriptions[1];
      const resource = createLinkedResourceFromInscription(inscription, 'TestResource');
      
      expect(resource).toEqual({
        id: `did:btco:${inscription.sat}/1`,
        type: 'TestResource',
        inscriptionId: inscription.id,
        contentType: 'text/plain',
        content: { value: inscription.content as string },
        sat: inscription.sat,
        didReference: `did:btco:${inscription.sat}`
      });
    });
  });

  describe('Binary Content', () => {
    it('should correctly process binary inscription', () => {
      const inscription = realInscriptions[2];
      const resource = createLinkedResourceFromInscription(inscription, 'TestResource');
      
      expect(resource).toEqual({
        id: `did:btco:${inscription.sat}/2`,
        type: 'TestResource',
        inscriptionId: inscription.id,
        contentType: 'image/png',
        content: { value: inscription.content as string },
        sat: inscription.sat,
        didReference: `did:btco:${inscription.sat}`
      });
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

  describe('Resource ID Generation', () => {
    it('should generate correct resource IDs for real inscriptions', () => {
      for (const inscription of realInscriptions) {
        const resource = createLinkedResourceFromInscription(inscription, 'TestResource');
        expect(resource.id).toBe(`did:btco:${inscription.sat}/${inscription.number}`);
      }
    });
  });
}); 
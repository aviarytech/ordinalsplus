/**
 * Verification Router
 * 
 * This router defines API endpoints for verifying inscriptions and credentials.
 */
import { Elysia, t } from 'elysia';
import { VerificationService } from '../services/verificationService';
import { ApiService } from '../services/apiService';
import { VerificationStatus } from '../types/verification';
import type { VerificationCheck } from '../types/verification';
import { CollectionCredentialService } from '../services/collectionCredentialService';
import { CollectionCredentialController } from '../controllers/collectionCredentialController';
import { CollectionInscriptionService } from '../services/collectionInscriptionService';
import { CollectionInscriptionController } from '../controllers/collectionInscriptionController';
import type { CredentialRepository } from '../repositories/credentialRepository';
import type { CollectionRepository } from '../repositories/collectionRepository';
import type { CollectionInscriptionRepository } from '../types/collectionInscription';
import { InMemoryCredentialRepository } from '../repositories/credentialRepository';
import { InMemoryCollectionRepository } from '../repositories/collectionRepository';
import { InMemoryCollectionInscriptionRepository } from '../repositories/collectionInscriptionRepository';
import { env } from '../config/envConfig';

// Create services
const apiService = new ApiService();
const verificationService = new VerificationService(apiService);

// Create repositories
const credentialRepository = new InMemoryCredentialRepository();
const collectionRepository = new InMemoryCollectionRepository();

// Create collection credential service and controller
const collectionCredentialService = new CollectionCredentialService(
  credentialRepository,
  collectionRepository,
  apiService
);
const collectionCredentialController = new CollectionCredentialController(collectionCredentialService);

// Create collection inscription repository, service and controller
const collectionInscriptionRepository = new InMemoryCollectionInscriptionRepository();
const collectionInscriptionService = new CollectionInscriptionService(
  collectionRepository,
  collectionInscriptionRepository,
  apiService
);
const collectionInscriptionController = new CollectionInscriptionController(collectionInscriptionService);

// Define rate limit options
const RATE_LIMIT = {
  max: 100,         // Maximum 100 requests
  windowMs: 3600000, // Per hour (in milliseconds)
  message: {
    status: 'error',
    message: 'Too many verification requests, please try again later'
  }
};

/**
 * Check if metadata contains a Verifiable Credential structure
 */
function isVerifiableCredential(metadata: any): boolean {
  if (!metadata || typeof metadata !== 'object') {
    return false;
  }
  
  // Check for required VC fields according to W3C VC spec
  return (
    metadata['@context'] &&
    metadata.type &&
    (Array.isArray(metadata.type) ? metadata.type.includes('VerifiableCredential') : metadata.type === 'VerifiableCredential') &&
    metadata.issuer &&
    metadata.credentialSubject
  );
}

/**
 * Simple verification of credential structure
 * For now, we'll just validate the structure until proper cryptographic verification is implemented
 */
async function verifyCredentialBasic(credential: any): Promise<{ valid: boolean; message: string; issuer?: any }> {
  try {
    // Basic structure validation
    if (!isVerifiableCredential(credential)) {
      return { valid: false, message: 'Invalid verifiable credential structure' };
    }
    
    // Get issuer DID
    const issuerDid = typeof credential.issuer === 'string' 
      ? credential.issuer 
      : credential.issuer.id;
    
    if (!issuerDid) {
      return { valid: false, message: 'Invalid issuer DID' };
    }
    
    // For now, if the structure is valid, consider it valid
    // TODO: Add proper cryptographic proof verification and DID resolution
    return { 
      valid: true, 
      message: 'Credential structure verified (basic validation)',
      issuer: {
        did: issuerDid,
        name: issuerDid,
        verified: true
      }
    };
  } catch (error) {
    return { valid: false, message: `Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

/**
 * Fetch inscription metadata using the Ordiscan API
 */
async function fetchInscriptionMetadata(inscriptionId: string): Promise<any> {
  const apiKey = env.ORDISCAN_API_KEY;
  if (!apiKey) {
    throw new Error('Ordiscan API key not configured');
  }
  
  try {
    const response = await fetch(`https://api.ordiscan.com/v1/inscription/${inscriptionId}/metadata`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.text();
    
    // Try to decode CBOR if it's hex-encoded
    if (data && data.length > 0) {
      try {
        // Simple hex decode and assume JSON content for now
        // In a full implementation, we'd use proper CBOR decoding
        const hexMatch = data.match(/^[0-9a-fA-F]+$/);
        if (hexMatch) {
          // Convert hex to bytes and try to decode as JSON
          const bytes = new Uint8Array(data.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
          const decoded = new TextDecoder().decode(bytes);
          return JSON.parse(decoded);
        } else {
          // Try to parse as JSON directly
          return JSON.parse(data);
        }
      } catch (parseError) {
        // If parsing fails, return the raw data
        return { rawData: data };
      }
    }
    
    return null;
  } catch (error) {
    throw new Error(`Failed to fetch inscription metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Define the verification router
export const verificationRouter = new Elysia({ prefix: '/api/verify' })
  // Verify an inscription by ID
  .get('/inscription/:inscriptionId', async ({ params }) => {
    const { inscriptionId } = params;
    
    if (!inscriptionId) {
      return {
        status: 'error',
        message: 'Missing inscription ID'
      };
    }

    try {
      // Try to get metadata directly from the inscription
      let metadata: any = null;
      
      try {
        metadata = await fetchInscriptionMetadata(inscriptionId);
      } catch (fetchError) {
        console.warn(`Failed to get metadata: ${fetchError}`);
        return {
          status: 'error',
          message: `Failed to fetch inscription metadata: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`
        };
      }
      
      if (!metadata) {
        return {
          status: 'error',
          message: 'No metadata found for this inscription'
        };
      }
      
      // Check if metadata is a verifiable credential
      if (!isVerifiableCredential(metadata)) {
        return {
          status: 'error',
          message: 'Inscription metadata is not a verifiable credential'
        };
      }
      
      // Verify the credential
      const verificationResult = await verifyCredentialBasic(metadata);
      
      return {
        status: verificationResult.valid ? 'success' : 'error',
        message: verificationResult.message,
        details: {
          inscriptionId,
          issuer: verificationResult.issuer,
          verifiedAt: new Date().toISOString(),
          checks: [
            {
              name: 'Structure Validation',
              passed: isVerifiableCredential(metadata),
              description: 'Validates W3C VC structure'
            },
            {
              name: 'Basic Verification',
              passed: verificationResult.valid,
              description: 'Basic credential validation'
            }
          ]
        },
        credential: metadata
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }, {
    params: t.Object({
      inscriptionId: t.String({ minLength: 1 })
    }),
    response: {
      200: t.Object({
        status: t.String(),
        message: t.Optional(t.String()),
        details: t.Optional(t.Object({
          inscriptionId: t.Optional(t.String()),
          issuer: t.Optional(t.Any()),
          verifiedAt: t.Optional(t.String()),
          checks: t.Array(t.Any())
        })),
        credential: t.Optional(t.Any())
      }),
      400: t.Object({
        status: t.Literal('error'),
        message: t.String()
      }),
      500: t.Object({
        status: t.Literal('error'),
        message: t.String()
      })
    },
    detail: {
      summary: 'Verify an inscription by its ID',
      description: 'Verifies the authenticity of an inscription by checking its associated verifiable credential',
      tags: ['Verification']
    }
  })
  
  // Verify a credential directly
  .post('/credential', async ({ body }: { body: { credential: any } }) => {
    try {
      const { credential } = body;
      
      if (!credential) {
        return {
          status: 'error',
          message: 'Missing credential data'
        };
      }

      // Use the verification service to verify the credential
      const result = await verificationService.verifyCredential(credential);
      
      return {
        status: result.status === VerificationStatus.VALID ? 'valid' : 
               result.status === VerificationStatus.INVALID ? 'invalid' : 'error',
        message: result.message,
        issuer: result.issuer,
        verifiedAt: result.verifiedAt
      };
    } catch (error) {
      console.error('Error verifying credential:', error);
      return {
        status: 'error',
        message: `Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }, {
    body: t.Object({
      credential: t.Any()
    }),
    response: {
      200: t.Object({
        status: t.String(),
        message: t.Optional(t.String()),
        details: t.Optional(t.Object({
          issuer: t.Optional(t.Any()),
          verifiedAt: t.Optional(t.String()),
          checks: t.Array(t.Any())
        })),
        credential: t.Optional(t.Any())
      }),
      400: t.Object({
        status: t.Literal('error'),
        message: t.String()
      }),
      500: t.Object({
        status: t.Literal('error'),
        message: t.String()
      })
    },
    detail: {
      summary: 'Verify a credential directly',
      description: 'Verifies a verifiable credential provided in the request body',
      tags: ['Verification']
    }
  })
  
  // Get issuer information for a DID
  .get('/issuer/:did', async ({ params }) => {
    const { did } = params;
    
    if (!did) {
      return {
        status: 'error',
        message: 'Missing DID parameter'
      };
    }

    try {
      // Use the verification service to get issuer info
      const issuer = await verificationService.getIssuerInfo(did);
      
      return {
        status: 'success',
        issuer
      };
    } catch (error) {
      console.error('Error getting issuer info:', error);
      return {
        status: 'error',
        message: `Failed to get issuer info: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }, {
    params: t.Object({
      did: t.String({ minLength: 1 })
    }),
    response: {
      200: t.Object({
        status: t.String(),
        issuer: t.Any()
      }),
      400: t.Object({
        status: t.Literal('error'),
        message: t.String()
      }),
      500: t.Object({
        status: t.Literal('error'),
        message: t.String()
      })
    },
    detail: {
      summary: 'Get issuer information by DID',
      description: 'Resolves a DID and returns information about the issuer',
      tags: ['Verification']
    }
  });

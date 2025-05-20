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
      const result = await verificationService.verifyInscription(inscriptionId);
      
      // Format the response
      return formatVerificationResponse(result);
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
  .post('/credential', async ({ body }) => {
    const { credential } = body as { credential: any };
    
    if (!credential) {
      return {
        status: 'error',
        message: 'Missing credential in request body'
      };
    }

    try {
      const result = await verificationService.verifyCredential(credential);
      
      // Format the response
      return formatVerificationResponse(result);
    } catch (error) {
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
  
  // Get information about an issuer by DID
  .get('/issuer/:did', async ({ params }) => {
    const { did } = params;
    
    if (!did) {
      return {
        status: 'error',
        message: 'Missing DID parameter'
      };
    }

    try {
      const issuerInfo = await verificationService.getIssuerInfo(did);
      
      return {
        status: 'success',
        issuer: issuerInfo
      };
    } catch (error) {
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
      summary: 'Get information about an issuer',
      description: 'Retrieves information about an issuer by its DID',
      tags: ['Verification']
    }
  })
  
  // Collection credential endpoints
  
  // Issue a collection credential
  .post('/collection-credential/issue', async ({ body }) => {
    const { collectionId, issuerDid } = body as { collectionId: string; issuerDid: string };
    
    if (!collectionId || !issuerDid) {
      return {
        status: 'error',
        message: 'Missing required parameters: collectionId and issuerDid'
      };
    }

    return await collectionCredentialController.issueCollectionCredential({
      collectionId,
      issuerDid
    });
  }, {
    body: t.Object({
      collectionId: t.String({ minLength: 1 }),
      issuerDid: t.String({ minLength: 1 })
    }),
    response: {
      200: t.Object({
        status: t.String(),
        message: t.Optional(t.String()),
        data: t.Optional(t.Object({
          credentialId: t.String(),
          credential: t.Any()
        }))
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
      summary: 'Issue a credential for a collection',
      description: 'Issues a verifiable credential for a curated collection',
      tags: ['Collection Credentials']
    }
  })
  
  // Get a collection credential by ID
  .get('/collection-credential/:credentialId', async ({ params }) => {
    const { credentialId } = params;
    
    if (!credentialId) {
      return {
        status: 'error',
        message: 'Missing credential ID'
      };
    }

    return await collectionCredentialController.getCollectionCredential(credentialId);
  }, {
    params: t.Object({
      credentialId: t.String({ minLength: 1 })
    }),
    response: {
      200: t.Object({
        status: t.String(),
        data: t.Optional(t.Object({
          credential: t.Any()
        }))
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
      summary: 'Get a collection credential by ID',
      description: 'Retrieves a collection credential by its ID',
      tags: ['Collection Credentials']
    }
  })
  
  // Find collection credentials by curator
  .get('/collection-credentials/curator/:curatorDid', async ({ params }) => {
    const { curatorDid } = params;
    
    if (!curatorDid) {
      return {
        status: 'error',
        message: 'Missing curator DID'
      };
    }

    return await collectionCredentialController.findCollectionCredentialsByCurator(curatorDid);
  }, {
    params: t.Object({
      curatorDid: t.String({ minLength: 1 })
    }),
    response: {
      200: t.Object({
        status: t.String(),
        data: t.Optional(t.Object({
          credentials: t.Array(t.Any()),
          count: t.Number()
        }))
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
      summary: 'Find collection credentials by curator',
      description: 'Retrieves collection credentials issued by a specific curator',
      tags: ['Collection Credentials']
    }
  })
  
  // Revoke a collection credential
  .post('/collection-credential/revoke', async ({ body }) => {
    const { credentialId, issuerDid } = body as { credentialId: string; issuerDid: string };
    
    if (!credentialId || !issuerDid) {
      return {
        status: 'error',
        message: 'Missing required parameters: credentialId and issuerDid'
      };
    }

    return await collectionCredentialController.revokeCollectionCredential(credentialId, issuerDid);
  }, {
    body: t.Object({
      credentialId: t.String({ minLength: 1 }),
      issuerDid: t.String({ minLength: 1 })
    }),
    response: {
      200: t.Object({
        status: t.String(),
        message: t.String(),
        data: t.Optional(t.Object({
          revoked: t.Boolean()
        }))
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
      summary: 'Revoke a collection credential',
      description: 'Revokes a previously issued collection credential',
      tags: ['Collection Credentials']
    }
  })
  
  // Collection inscription endpoints
  
  // Start a collection inscription process
  .post('/collection-inscription/start', async ({ body }) => {
    const { collectionId, requesterDid, feeRate, useBatching, batchSize } = 
      body as { collectionId: string; requesterDid: string; feeRate?: number; useBatching?: boolean; batchSize?: number };
    
    if (!collectionId || !requesterDid) {
      return {
        status: 'error',
        message: 'Missing required parameters: collectionId and requesterDid'
      };
    }

    return await collectionInscriptionController.startInscription({
      collectionId,
      requesterDid,
      feeRate,
      useBatching,
      batchSize
    });
  }, {
    body: t.Object({
      collectionId: t.String({ minLength: 1 }),
      requesterDid: t.String({ minLength: 1 }),
      feeRate: t.Optional(t.Number()),
      useBatching: t.Optional(t.Boolean()),
      batchSize: t.Optional(t.Number())
    }),
    response: {
      200: t.Object({
        status: t.String(),
        message: t.String(),
        data: t.Optional(t.Object({
          inscriptionId: t.String(),
          status: t.String(),
          collectionId: t.String()
        }))
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
      summary: 'Start a collection inscription process',
      description: 'Initiates the process of inscribing a collection on-chain',
      tags: ['Collection Inscriptions']
    }
  })
  
  // Get the status of a collection inscription
  .get('/collection-inscription/:inscriptionId', async ({ params }) => {
    const { inscriptionId } = params;
    
    if (!inscriptionId) {
      return {
        status: 'error',
        message: 'Missing inscription ID'
      };
    }

    return await collectionInscriptionController.getInscriptionStatus(inscriptionId);
  }, {
    params: t.Object({
      inscriptionId: t.String({ minLength: 1 })
    }),
    response: {
      200: t.Object({
        status: t.String(),
        data: t.Optional(t.Object({
          inscription: t.Any()
        }))
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
      summary: 'Get collection inscription status',
      description: 'Retrieves the status of a collection inscription process',
      tags: ['Collection Inscriptions']
    }
  })
  
  // Get inscriptions for a collection
  .get('/collection-inscriptions/collection/:collectionId', async ({ params }) => {
    const { collectionId } = params;
    
    if (!collectionId) {
      return {
        status: 'error',
        message: 'Missing collection ID'
      };
    }

    return await collectionInscriptionController.getInscriptionsForCollection(collectionId);
  }, {
    params: t.Object({
      collectionId: t.String({ minLength: 1 })
    }),
    response: {
      200: t.Object({
        status: t.String(),
        data: t.Optional(t.Object({
          inscriptions: t.Array(t.Any()),
          count: t.Number()
        }))
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
      summary: 'Get inscriptions for a collection',
      description: 'Retrieves all inscription records for a specific collection',
      tags: ['Collection Inscriptions']
    }
  })
  
  // Cancel an in-progress inscription
  .post('/collection-inscription/cancel', async ({ body }) => {
    const { inscriptionId, requesterDid } = body as { inscriptionId: string; requesterDid: string };
    
    if (!inscriptionId || !requesterDid) {
      return {
        status: 'error',
        message: 'Missing required parameters: inscriptionId and requesterDid'
      };
    }

    return await collectionInscriptionController.cancelInscription(inscriptionId, requesterDid);
  }, {
    body: t.Object({
      inscriptionId: t.String({ minLength: 1 }),
      requesterDid: t.String({ minLength: 1 })
    }),
    response: {
      200: t.Object({
        status: t.String(),
        message: t.String(),
        data: t.Optional(t.Object({
          inscription: t.Any()
        }))
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
      summary: 'Cancel a collection inscription',
      description: 'Cancels an in-progress collection inscription process',
      tags: ['Collection Inscriptions']
    }
  })
  
  // Verify an on-chain collection inscription
  .get('/collection-inscription/verify/:inscriptionId/:collectionId', async ({ params }) => {
    const { inscriptionId, collectionId } = params;
    
    if (!inscriptionId || !collectionId) {
      return {
        status: 'error',
        message: 'Missing required parameters: inscriptionId and collectionId'
      };
    }

    return await collectionInscriptionController.verifyInscription(inscriptionId, collectionId);
  }, {
    params: t.Object({
      inscriptionId: t.String({ minLength: 1 }),
      collectionId: t.String({ minLength: 1 })
    }),
    response: {
      200: t.Object({
        status: t.String(),
        data: t.Optional(t.Object({
          isValid: t.Boolean(),
          inscriptionId: t.String(),
          collectionId: t.String(),
          verifiedAt: t.String()
        }))
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
      summary: 'Verify a collection inscription',
      description: 'Verifies that an on-chain inscription matches the expected collection data',
      tags: ['Collection Inscriptions']
    }
  });

/**
 * Format verification result for API response
 * 
 * @param result - Internal verification result
 * @returns Formatted API response
 */
function formatVerificationResponse(result: any) {
  // Extract verification checks from the result
  const checks: VerificationCheck[] = [];
  
  // Add signature check if credential exists
  if (result.credential && result.status) {
    checks.push({
      id: 'signature',
      name: 'Digital Signature',
      category: 'signature',
      passed: result.status === VerificationStatus.VALID,
      explanation: result.status === VerificationStatus.VALID
        ? 'The credential signature is valid and was created by the issuer.'
        : 'The credential signature is invalid or could not be verified.'
    });

    // Add expiration check if applicable
    if (result.credential.expirationDate) {
      const expirationDate = new Date(result.credential.expirationDate);
      const isExpired = expirationDate < new Date();
      
      checks.push({
        id: 'expiration',
        name: 'Expiration Date',
        category: 'expiration',
        passed: !isExpired,
        explanation: isExpired
          ? `The credential expired on ${expirationDate.toISOString()}.`
          : `The credential is valid until ${expirationDate.toISOString()}.`
      });
    }
  }

  // Format the response
  return {
    status: result.status,
    message: result.message || getDefaultMessageForStatus(result.status),
    details: {
      inscriptionId: result.inscriptionId,
      issuer: result.issuer,
      verifiedAt: result.verifiedAt || new Date().toISOString(),
      checks
    },
    credential: result.credential
  };
}

/**
 * Get default message for verification status
 * 
 * @param status - Verification status
 * @returns Default message
 */
function getDefaultMessageForStatus(status: string): string {
  switch (status) {
    case VerificationStatus.VALID:
      return 'The credential is valid and has been successfully verified.';
    case VerificationStatus.INVALID:
      return 'The credential is invalid or has been tampered with.';
    case VerificationStatus.NO_METADATA:
      return 'No verifiable metadata found for this inscription.';
    case VerificationStatus.ERROR:
      return 'An error occurred during verification.';
    default:
      return 'Unknown verification status.';
  }
}

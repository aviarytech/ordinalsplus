/**
 * Resource Inscription Router
 * 
 * API routes for resource inscription operations
 */
import { Elysia, t } from 'elysia';
import { 
  startResourceInscription, 
  getResourceInscription, 
  getResourceInscriptionsByDid 
} from '../controllers/resourceInscriptionController';

// Define types for request bodies and parameters
type ResourceInscriptionBody = {
  parentDid: string;
  requesterDid: string;
  label: string;
  resourceType: string;
  file: {
    buffer: Uint8Array;
    type: string;
  };
  feeRate?: number;
  metadata?: Record<string, any>;
};

type ResourceIdParam = {
  id: string;
};

type ResourceDidParam = {
  did: string;
};

// Create a new router
export const resourceInscriptionRouter = new Elysia({ prefix: '/api/resource-inscriptions' });

// POST endpoint to start a new resource inscription
resourceInscriptionRouter.post('/',
  async ({ body, set }) => {
    try {
      const typedBody = body as ResourceInscriptionBody;
      const { 
        parentDid, 
        requesterDid, 
        label, 
        resourceType, 
        feeRate,
        metadata,
        file 
      } = typedBody;
      
      // Validate required fields
      if (!parentDid || !requesterDid || !label || !resourceType || !file) {
        set.status = 400;
        return { 
          error: 'Missing required fields', 
          requiredFields: ['parentDid', 'requesterDid', 'label', 'resourceType', 'file'] 
        };
      }
      
      // Create inscription request
      const request = {
        parentDid,
        requesterDid,
        content: Buffer.from(file.buffer),
        contentType: file.type,
        label,
        resourceType,
        feeRate,
        metadata
      };
      
      // Start inscription
      const inscription = await startResourceInscription(request);
      
      // Return the inscription record
      set.status = 201;
      return inscription;
    } catch (error) {
      set.status = 500;
      return { 
        error: 'Failed to start resource inscription',
        message: error instanceof Error ? error.message : String(error)
      };
    }
  },
  {
    body: t.Object({
      parentDid: t.String(),
      requesterDid: t.String(),
      label: t.String(),
      resourceType: t.String(),
      file: t.Object({
        buffer: t.Any(),
        type: t.String()
      }),
      feeRate: t.Optional(t.Number()),
      metadata: t.Optional(t.Object({}))
    }),
    detail: {
      summary: 'Start a new resource inscription',
      description: 'Inscribe a resource linked to a DID on the same satoshi',
      tags: ['Resources']
    }
  });

// GET endpoint to retrieve a resource inscription by ID
resourceInscriptionRouter.get('/:id', 
  async ({ params, set }) => {
    try {
      const typedParams = params as ResourceIdParam;
      const { id } = typedParams;
      
      // Get inscription
      const inscription = await getResourceInscription(id);
      
      if (inscription === null) {
        set.status = 404;
        return { error: 'Resource inscription not found' };
      }
      
      // Return the inscription record
      return inscription;
    } catch (error) {
      set.status = 500;
      return { 
        error: 'Failed to get resource inscription',
        message: error instanceof Error ? error.message : String(error)
      };
    }
  },
  {
    params: t.Object({
      id: t.String()
    }),
    detail: {
      summary: 'Get a resource inscription by ID',
      description: 'Retrieve details of a specific resource inscription',
      tags: ['Resources']
    }
  });

// GET endpoint to retrieve all resource inscriptions for a DID
resourceInscriptionRouter.get('/did/:did', 
  async ({ params, set }) => {
    try {
      const typedParams = params as ResourceDidParam;
      const { did } = typedParams;
      
      // Get inscriptions
      const inscriptions = await getResourceInscriptionsByDid(did);
      
      // Return the inscription records
      return inscriptions;
    } catch (error) {
      set.status = 500;
      return { 
        error: 'Failed to get resource inscriptions',
        message: error instanceof Error ? error.message : String(error)
      };
    }
  },
  {
    params: t.Object({
      did: t.String()
    }),
    detail: {
      summary: 'Get all resource inscriptions for a DID',
      description: 'Retrieve all resource inscriptions linked to a specific DID',
      tags: ['Resources']
    }
  });

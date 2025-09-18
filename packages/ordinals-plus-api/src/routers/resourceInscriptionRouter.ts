/**
 * Resource Inscription Router
 * 
 * API routes for resource inscription operations
 */
import { Elysia, t } from 'elysia';
import { 
  startResourceInscription, 
  startBatchResourceInscription,
  getResourceInscription, 
  getResourceInscriptionsByDid,
  prepareResourceInscription,
  acceptCommitTx,
  finalizeRevealTx
} from '../controllers/resourceInscriptionController';

// Define types for request bodies and parameters
type ResourceInscriptionBody = {
  parentDid?: string;
  requesterDid?: string;
  satNumber?: number;
  label: string;
  resourceType: string;
  file: {
    buffer?: unknown;
    base64?: string;
    contentBase64?: string;
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
      
      // Validate required fields (allow parentDid/requesterDid to be optional)
      if (!label || !resourceType || !file) {
        set.status = 400;
        return { 
          error: 'Missing required fields', 
          requiredFields: ['label', 'resourceType', 'file'] 
        };
      }
      // Normalize file buffer
      let contentBuffer: Buffer;
      const base64 = (file as any).base64 || (file as any).contentBase64;
      if (typeof base64 === 'string') {
        contentBuffer = Buffer.from(base64, 'base64');
      } else if ((file as any).buffer) {
        try {
          const bufObj: any = (file as any).buffer;
          if (Array.isArray(bufObj)) {
            contentBuffer = Buffer.from(bufObj);
          } else if (Array.isArray(bufObj?.data)) {
            // Node Buffer serialized as { type: 'Buffer', data: [...] }
            contentBuffer = Buffer.from(bufObj.data);
          } else if (typeof bufObj === 'object' && typeof bufObj.length === 'number') {
            // Array-like
            contentBuffer = Buffer.from(bufObj as any);
          } else {
            // Fallback: try to convert values
            contentBuffer = Buffer.from(Object.values(bufObj) as any);
          }
        } catch (e) {
          set.status = 400;
          return { error: 'Invalid file buffer format' };
        }
      } else {
        set.status = 400;
        return { error: 'File must include base64 or buffer' };
      }

      // Create inscription request
      const request = {
        parentDid,
        requesterDid,
        satNumber: typedBody.satNumber,
        content: contentBuffer,
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
      parentDid: t.Optional(t.String()),
      requesterDid: t.Optional(t.String()),
      satNumber: t.Optional(t.Number()),
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

// POST endpoint to start a batch of resource inscriptions
resourceInscriptionRouter.post('/batch',
  async ({ body, set }) => {
    try {
      const typedBody = body as { requests: ResourceInscriptionBody[] };
      const { requests } = typedBody;
      if (!Array.isArray(requests) || requests.length === 0) {
        set.status = 400;
        return { error: 'Requests array is required and cannot be empty' };
      }

      // Validate each request has the required fields
      for (const r of requests) {
        if (!r.label || !r.resourceType || !r.file) {
          set.status = 400;
          return { 
            error: 'Each request is missing required fields',
            requiredFields: ['label', 'resourceType', 'file']
          };
        }
      }

      // Map to service request shape
      const serviceRequests = requests.map(r => {
        const base64 = (r.file as any).base64 || (r.file as any).contentBase64;
        let buffer: Buffer;
        if (typeof base64 === 'string') {
          buffer = Buffer.from(base64, 'base64');
        } else if ((r.file as any).buffer) {
          const bufObj: any = (r.file as any).buffer;
          if (Array.isArray(bufObj)) buffer = Buffer.from(bufObj);
          else if (Array.isArray(bufObj?.data)) buffer = Buffer.from(bufObj.data);
          else if (typeof bufObj === 'object' && typeof bufObj.length === 'number') buffer = Buffer.from(bufObj as any);
          else buffer = Buffer.from(Object.values(bufObj) as any);
        } else {
          throw new Error('File must include base64 or buffer');
        }
        return {
          parentDid: r.parentDid,
          requesterDid: r.requesterDid,
          satNumber: r.satNumber,
          content: buffer,
          contentType: r.file.type,
          label: r.label,
          resourceType: r.resourceType,
          feeRate: r.feeRate,
          metadata: r.metadata
        };
      });

      const inscriptions = await startBatchResourceInscription(serviceRequests as any);
      set.status = 201;
      return { items: inscriptions, count: inscriptions.length };
    } catch (error) {
      set.status = 500;
      return {
        error: 'Failed to start batch resource inscriptions',
        message: error instanceof Error ? error.message : String(error)
      };
    }
  },
  {
    body: t.Object({
      requests: t.Array(t.Object({
        parentDid: t.Optional(t.String()),
        requesterDid: t.Optional(t.String()),
        satNumber: t.Optional(t.Number()),
        label: t.String(),
        resourceType: t.String(),
        file: t.Object({
          buffer: t.Any(),
          type: t.String()
        }),
        feeRate: t.Optional(t.Number()),
        metadata: t.Optional(t.Object({}))
      }), { minItems: 1 })
    }),
    detail: {
      summary: 'Start batch resource inscriptions',
      description: 'Start multiple resource inscriptions in one request',
      tags: ['Resources']
    }
  }
);

// POST /:id/prepare - prepare commit/reveal data
resourceInscriptionRouter.post('/:id/prepare',
  async ({ params, query, body, set }) => {
    try {
      const { id } = params as { id: string };
      const network = (query?.network as 'mainnet' | 'signet' | 'testnet') || 'mainnet';
      const feeRate = (body as any)?.feeRate as number | undefined;
      const recipientAddress = (body as any)?.recipientAddress as string | undefined;
      if (!recipientAddress) { set.status = 400; return { error: 'recipientAddress required' }; }
      const result = await prepareResourceInscription(id, network, recipientAddress, feeRate);
      return result;
    } catch (error) {
      set.status = 500;
      return { error: 'Failed to prepare resource inscription', message: error instanceof Error ? error.message : String(error) };
    }
  },
  {
    params: t.Object({ id: t.String() }),
    query: t.Object({ network: t.Optional(t.String()) }),
    body: t.Object({ feeRate: t.Optional(t.Number()), recipientAddress: t.String() } as any),
    detail: { summary: 'Prepare resource inscription', tags: ['Resources'] }
  }
);

// POST /:id/commit - accept commit txid
resourceInscriptionRouter.post('/:id/commit',
  async ({ params, body, set }) => {
    try {
      const { id } = params as { id: string };
      const { commitTxid } = body as { commitTxid: string };
      if (!commitTxid) { set.status = 400; return { error: 'commitTxid required' }; }
      const result = await acceptCommitTx(id, commitTxid);
      return result;
    } catch (error) {
      set.status = 500;
      return { error: 'Failed to accept commit tx', message: error instanceof Error ? error.message : String(error) };
    }
  },
  {
    params: t.Object({ id: t.String() }),
    body: t.Object({ commitTxid: t.String() }),
    detail: { summary: 'Accept commit transaction id', tags: ['Resources'] }
  }
);

// POST /:id/reveal - finalize with reveal txid
resourceInscriptionRouter.post('/:id/reveal',
  async ({ params, body, set }) => {
    try {
      const { id } = params as { id: string };
      const { revealTxid } = body as { revealTxid: string };
      if (!revealTxid) { set.status = 400; return { error: 'revealTxid required' }; }
      const result = await finalizeRevealTx(id, revealTxid);
      return result;
    } catch (error) {
      set.status = 500;
      return { error: 'Failed to finalize reveal tx', message: error instanceof Error ? error.message : String(error) };
    }
  },
  {
    params: t.Object({ id: t.String() }),
    body: t.Object({ revealTxid: t.String() }),
    detail: { summary: 'Finalize reveal transaction', tags: ['Resources'] }
  }
);

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

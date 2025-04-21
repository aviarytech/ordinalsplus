import { Elysia, t, NotFoundError, ValidationError, ParseError } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
// import { DidDocument } from 'did-resolver'; // REMOVED - Incorrect assumption
import type { LinkedResource, Utxo } from 'ordinalsplus'; // Import Utxo type
// import { getFeeEstimates } from './services/mempoolService'; // REMOVED - Linter cannot find this module
import { getInscriptionDetails, InscriptionNotFoundError } from './services/inscriptionService';
// Import the controller function
import { getAllResources } from './controllers/resourcesController'; 
import type { 
  ResourceInscriptionRequest, 
  DidInscriptionRequest,
  PsbtResponse,
  FeeEstimateResponse,
  ErrorResponse,
  InscriptionDetailsResponse,
  NetworkInfo,
  ApiResponse // Use the non-generic ApiResponse from ./types
} from './types';
import express from 'express';
import bodyParser from 'body-parser';
import { prepareInscriptionEnvelope, getAddressUtxos } from 'ordinalsplus'; // Import getAddressUtxos
// --- Import provider service ---
import { getProvider } from './services/providerService';

// --- Mock function placeholders --- 
// Replace these with actual imports or implementations from ordinalsplus or internal services
// Define a placeholder type if DidDocument isn't available
type PlaceholderDidDocument = { id: string; [key: string]: any };

const resolveDid = async (did: string): Promise<PlaceholderDidDocument | null> => { 
    console.warn(`[Mock] resolveDid called for: ${did}`); 
    return null; 
};
const fetchResourcesForDid = async (did: string): Promise<LinkedResource[]> => { 
    console.warn(`[Mock] fetchResourcesForDid called for: ${did}`); 
    return []; 
};
const fetchResourceContent = async (id: string): Promise<LinkedResource | null> => { 
    console.warn(`[Mock] fetchResourceContent called for: ${id}`); 
    return null; 
};
const constructGenericPsbt = async (body: ResourceInscriptionRequest | DidInscriptionRequest): Promise<PsbtResponse> => { 
    console.warn('[Mock] constructGenericPsbt called with:', body); 
    throw new Error('[Mock] PSBT generation not implemented'); 
};
// Mock for fee estimates as mempoolService import was removed
const getFeeEstimates = async (): Promise<FeeEstimateResponse> => {
    console.warn('[Mock] getFeeEstimates called');
    // Return default/placeholder fees
    return { low: 5, medium: 10, high: 15 };
};
// --- End Mock Placeholders ---

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';
const API_BASE_URL = process.env.API_BASE_URL || `http://localhost:${PORT}`;

console.log(`API starting on ${HOST}:${PORT}`);

const app = new Elysia()
  // --- Basic Setup ---
  .use(cors())
  .use(swagger({
    path: '/docs',
    documentation: {
        info: {
            title: 'Ordinals Plus API',
            version: '1.0.0',
            description: 'API for managing and exploring Ordinals-based DIDs and linked resources.'
        }
    }
  }))
  // --- Updated onError Handler ---
  .onError(({ code, error, set }) => {
    let message = 'Internal Server Error';
    let status = 500;
    let details: any = undefined;

    console.error(`[${code}] Error caught:`, error); // Log the raw error first

    // Handle specific Elysia errors
    if (error instanceof NotFoundError) {
        message = error.message || 'Resource not found'; // Use message from error if available
        status = 404;
    } else if (error instanceof ValidationError) {
        message = 'Validation failed';
        status = 400;
        // Attempt to extract meaningful details from validation error
        details = error.all ?? error.message; 
    } else if (error instanceof ParseError) {
        message = 'Failed to parse request body';
        status = 400;
        details = error.message;
    } 
    // Handle custom application errors
    else if (error instanceof InscriptionNotFoundError) {
        message = error.message || 'Inscription not found';
        status = 404;
    } 
    // Handle generic JS Errors
    else if (error instanceof Error) {
        message = error.message || 'An unexpected error occurred';
        // Keep status 500 unless it's a re-thrown known error
    } 
    // Handle non-standard errors/objects thrown
    else {
        message = 'An unknown error occurred';
        details = String(error); // Convert the thrown value to string
    }

    console.error(`Responding with status ${status}: ${message}`, details ? `| Details: ${JSON.stringify(details)}` : '');

    set.status = status;
    // Ensure response conforms to a basic error shape
    const responseBody: ErrorResponse = { error: message };
    if (details !== undefined) {
        responseBody.details = details;
    }
    return responseBody; 
  })
  // --- Routes (Using Mock Placeholders) ---
  .get('/', () => ({ message: 'Ordinals Plus API Running' }))
  .get('/health', () => ({ status: 'healthy', timestamp: new Date().toISOString() }))

  // --- NEW: Network Information ---
  .get('/api/networks', (): NetworkInfo[] => {
    // Return a static list of supported/relevant networks
    // In a real scenario, this might come from configuration or dynamically
    console.log('[Route] GET /api/networks');
    return [
      { id: 'mainnet', name: 'Bitcoin Mainnet' },
      { id: 'testnet', name: 'Bitcoin Testnet' },
      { id: 'signet', name: 'Bitcoin Signet' },
      // Add others if relevant
    ];
  }, {
    detail: {
      summary: 'Get Available Networks',
      description: 'Returns a list of Bitcoin networks the application might interact with.',
      tags: ['Configuration']
    }
  })

  // --- NEW: Explore All Resources Route ---
  .get('/api/explore', async ({ query }) => {
      console.log(`[Route] GET /api/explore with query:`, query);
      // Call the imported controller function, passing parsed query params
      const result: ApiResponse = await getAllResources(
          query.page,
          query.limit,
          query.contentType
      );
      return result; // Return the ApiResponse structure directly
  }, {
      query: t.Object({
          page: t.Numeric({ default: 1, minimum: 1 }), 
          limit: t.Numeric({ default: 20, minimum: 1, maximum: 100 }), 
          contentType: t.Optional(t.String({ minLength: 1 }))
      }),
      response: {
          200: t.Object({
              linkedResources: t.Array(t.Any()), 
              page: t.Optional(t.Number()), 
              totalItems: t.Optional(t.Number()),
              itemsPerPage: t.Optional(t.Number())
          }),
      },
      detail: {
          summary: 'Explore All Linked Resources',
          description: 'Retrieves a paginated list of all linked resources, optionally filtered by content type.',
          tags: ['Resource Management', 'Exploration']
      }
  })

  // --- DID Resolution ---
  .get('/did/:did', async ({ params, set }) => {
    console.log(`Resolving DID: ${params.did}`);
    const didDocument: PlaceholderDidDocument | null = await resolveDid(params.did); // Uses mock
    if (!didDocument) {
      throw new NotFoundError('DID not found'); 
    }
    return didDocument;
  }, {
    params: t.Object({ did: t.String({ minLength: 1, description: 'DID to resolve (e.g., did:btco:...)' }) }),
    detail: {
      summary: 'Resolve a BTCO DID',
      description: 'Fetches the DID Document for a given did:btco identifier.',
      tags: ['DID Resolution'],
    }
  })

  // --- Resource Fetching ---
  .get('/resources/did/:did', async ({ params, set }) => {
    console.log(`Fetching resources for DID: ${params.did}`);
    const resources: LinkedResource[] = await fetchResourcesForDid(params.did); // Uses mock
    return { data: resources };
  }, {
    params: t.Object({ did: t.String({ minLength: 1, description: 'DID to fetch resources for' }) }),
    detail: {
      summary: 'Fetch Linked Resources for a DID',
      description: 'Retrieves all linked resources associated with a specific BTCO DID.',
      tags: ['Resource Management']
    }
  })

  .get('/resources/:resourceId', async ({ params, set }) => {
    console.log(`Fetching resource content by ID: ${params.resourceId}`);
    const resource: LinkedResource | null = await fetchResourceContent(params.resourceId); // Uses mock
    if (!resource) {
      throw new NotFoundError('Resource not found'); 
    }
    return { data: resource };
  }, {
      params: t.Object({ resourceId: t.String({ minLength: 1, description: 'The unique identifier (e.g., inscription ID) of the resource' }) }),
      detail: {
        summary: 'Fetch a Specific Linked Resource by ID',
        description: 'Retrieves the details of a specific linked resource using its identifier (often the inscription ID).',
        tags: ['Resource Management']
      }
  })

  // --- Fetch Inscription Details ---
  .get('/inscription/:inscriptionId', async ({ params, set }) => {
    console.log(`[Route] GET /inscription/${params.inscriptionId}`);
    const details: InscriptionDetailsResponse = await getInscriptionDetails(params.inscriptionId); // Uses real service
    set.status = 200;
    return details;
  }, {
      params: t.Object({
          inscriptionId: t.String({ minLength: 1, description: 'The inscription ID' })
      }),
      response: {
        200: t.Object({ // Define success response schema
            inscriptionId: t.String(),
            contentType: t.String(),
            contentBase64: t.String(),
            contentLength: t.Number()
        }, { description: 'Inscription details successfully retrieved' }),
        // 400 Bad Request (Handled by validation middleware)
        404: t.Object({ error: t.Literal('Inscription not found') }, { description: 'The requested inscription ID was not found.' }),
        500: t.Object({ error: t.String() }, { description: 'Internal server error occurred while fetching details.' })
      },
      detail: {
        summary: 'Fetch Inscription Details by ID',
        description: 'Retrieves the raw content (Base64 encoded) and content type for a specific inscription directly from the Ord node.',
        tags: ['Inscription Fetching'],
      }
  })

  // --- Fee Estimation ---
  .get('/fees/estimate', async ({ set }) => {
    console.log('Fetching fee estimates');
    const estimates: FeeEstimateResponse = await getFeeEstimates(); // Uses mock
    return estimates;
  }, {
    detail: {
      summary: 'Get Bitcoin Network Fee Estimates',
      description: 'Provides estimated fee rates (sats/vB) for different confirmation speeds.',
      tags: ['Fees', 'Network']
    }
  })

  // --- NEW: Inscription Preparation ---
  .post('/api/inscriptions/prepare', async ({ body, set }) => {
    console.log('[Route] POST /api/inscriptions/prepare with body:', body);
    try {
      // Call the library function to prepare the envelope
      const { inscriptionScript, revealFee } = prepareInscriptionEnvelope(
        body.contentType,
        body.content, // Assumes content is the correctly formatted JSON string
        body.feeRate
      );

      // Return the script (hex) and fee estimate
      set.status = 200;
      return {
        inscriptionScript: inscriptionScript.toString('hex'),
        estimatedFee: revealFee,
      };
    } catch (error) {
      console.error('Error preparing inscription envelope:', error);
      // Let the central onError handler manage the response details
      if (error instanceof Error) {
         // Re-throw specific known errors if needed, or just the generic one
         throw new Error(`Failed to prepare inscription: ${error.message}`);
      } else {
         throw new Error('An unknown error occurred during inscription preparation.');
      } 
    }
  }, {
    body: t.Object({
        contentType: t.String({ minLength: 1, description: 'MIME type of the content (e.g., application/json)' }),
        content: t.String({ minLength: 1, description: 'The content to inscribe, typically a JSON string formatted by ordinalsplus utilities.' }),
        feeRate: t.Numeric({ minimum: 0.1, description: 'Desired fee rate in sats/vB' })
    }),
    response: {
        200: t.Object({
            inscriptionScript: t.String({ description: 'Hex-encoded taproot output script for the reveal transaction.' }),
            estimatedFee: t.Number({ description: 'Estimated fee in satoshis for the reveal transaction.' })
        }, { description: 'Inscription prepared successfully.' }),
        // 400 handled by validation
        500: t.Object({ error: t.String() }, { description: 'Internal server error preparing inscription.' })
    },
    detail: {
        summary: 'Prepare Inscription Envelope',
        description: 'Constructs the necessary taproot output script (inscription envelope) for an Ordinal inscription based on content and fee rate, returning the script and estimated reveal fee.',
        tags: ['Inscription Creation']
    }
  })

  // --- Inscription PSBT Generation ---
  .post('/inscriptions/create', async ({ body, set }) => {
    console.log('Received request to create generic inscription PSBT', body);
    // Uses mock constructGenericPsbt
    const result: PsbtResponse = await constructGenericPsbt(body as any);
    return result;
  }, {
    body: t.Union([
      t.Object({ // Resource Inscription
        contentType: t.String(),
        contentBase64: t.String(),
        feeRate: t.Number({ minimum: 1 }),
        recipientAddress: t.String(),
        parentDid: t.Optional(t.String()),
        metadata: t.Optional(t.Record(t.String(), t.String())),
        // type: t.Literal('resource') // Optional discriminator if needed
      }, { description: 'Resource Inscription Request' }),
      t.Object({ // DID Inscription (assuming similar structure for now)
        contentType: t.String(), // e.g., 'application/did+json'
        contentBase64: t.String(), // Base64 of the initial DID document content
        feeRate: t.Number({ minimum: 1 }),
        recipientAddress: t.String(),
        // type: t.Literal('did') // Optional discriminator
      }, { description: 'DID Inscription Request' })
    ]),
    response: {
        200: t.Object({ // Define success response schema based on PsbtResponse type
            psbtBase64: t.String(),
            commitTxOutputValue: t.Number(),
            revealFee: t.Number(),
            revealSignerPrivateKeyWif: t.String(),
            // Include fields from backend PsbtResponse if they differ
            commitTxId: t.Optional(t.String()), // Mark as optional if not always returned
            revealTxId: t.Optional(t.String()),
            fee: t.Optional(t.Number()),
            inscriptionId: t.Optional(t.String())
        }), 
        400: t.Object({ error: t.String(), details: t.Optional(t.Any()) }),
        500: t.Object({ error: t.String(), details: t.Optional(t.Any()) })
    },
    detail: {
      summary: 'Create Inscription Reveal PSBT',
      description: 'Generates the reveal PSBT for inscribing data (DID or Resource). Takes content, fee rate, and recipient. Returns the PSBT and necessary info.',
      tags: ['Inscription Creation']
    }
  })

  // --- NEW UTXO Route ---
  .get('/api/addresses/:address/utxos', async ({ params, query, set }) => {
    const { address } = params;
    const network = query.network === 'testnet' ? 'testnet' : 'mainnet'; 

    if (!address) {
        set.status = 400;
        return { status: 'error', message: 'Address parameter is required.' };
    }
    console.log(`[API] Received GET /api/addresses/${address}/utxos request for network ${network}`);

    try {
        // --- Get the configured provider ---
        const provider = getProvider(); 
        console.log(`[API] Using provider: ${provider?.constructor?.name || 'Unknown Provider'}`);

        // --- Pass provider to getAddressUtxos ---
        const utxos: Utxo[] = await getAddressUtxos(address, provider, network);
        
        console.log(`[API] Found ${utxos.length} UTXOs for address ${address}.`);
        set.status = 200;
        return { status: 'success', data: utxos };
    } catch (error) {
        console.error(`[API] Error fetching UTXOs for ${address}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error fetching UTXOs';
        // Let the global onError handler manage the response
        throw new Error(errorMessage); 
    }
  }, {
    params: t.Object({
        address: t.String({ description: 'Bitcoin address' })
    }),
    query: t.Object({
        network: t.Optional(t.Union([
            t.Literal('mainnet'),
            t.Literal('testnet')
        ], { default: 'mainnet' }))
    }),
    response: {
        200: t.Object({
            status: t.Literal('success'),
            data: t.Array(t.Object({ // Define Utxo schema based on ordinalsplus type
                txid: t.String(),
                vout: t.Number(),
                value: t.Number(),
                scriptPubKey: t.String()
                // Add status if needed from type, but often omitted in API response
            }))
        }),
        400: t.Object({ status: t.Literal('error'), message: t.String() }),
        500: t.Object({ error: t.String() }) // Match onError handler
    },
    detail: {
        summary: 'Get UTXOs for an Address',
        description: 'Retrieves the unspent transaction outputs (UTXOs) for a given Bitcoin address.',
        tags: ['Address Information']
    }
  })

  // --- NEW Transaction Broadcast Route ---
  .post('/api/transactions/broadcast', async ({ body, set }) => {
    const { txHex } = body;
    console.log(`[API] Received POST /api/transactions/broadcast`);

    if (!txHex || typeof txHex !== 'string' || txHex.length === 0) {
        set.status = 400;
        return { error: 'Missing or invalid txHex in request body.' };
    }

    // Use mainnet mempool API directly for now
    const broadcastUrl = `https://mempool.space/api/tx`; 

    try {
        console.log(`[API] Broadcasting tx via ${broadcastUrl}`);
        const response = await fetch(broadcastUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain', // Mempool API expects raw hex string
            },
            body: txHex,
        });

        const responseText = await response.text();
        console.log(`[API] Broadcast response status: ${response.status}, text: ${responseText}`);

        if (!response.ok) {
            // Mempool API often returns the error message directly in the response body
            throw new Error(`Mempool broadcast error ${response.status}: ${responseText || response.statusText}`);
        }

        // If successful, the response text is usually the transaction ID
        const txid = responseText;
        set.status = 200;
        return { status: 'success', txid: txid };

    } catch (error) {
        console.error('[API] Error broadcasting transaction:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error broadcasting transaction';
        // Let the global onError handler manage the response formatting
        throw new Error(errorMessage);
    }
  }, {
      body: t.Object({
          txHex: t.String({ description: 'Raw transaction hex string to broadcast' })
      }),
      response: {
          200: t.Object({
              status: t.Literal('success'),
              txid: t.String({ description: 'Transaction ID of the broadcasted transaction' })
          }),
          // 400 handled by validation / explicit return
          500: t.Object({ error: t.String() }) // Match onError handler
      },
      detail: {
          summary: 'Broadcast Raw Transaction',
          description: 'Broadcasts a signed, raw Bitcoin transaction hex to the network via a public API (e.g., mempool.space). Returns the transaction ID on success.',
          tags: ['Transactions']
      }
  })

  .listen({ port: PORT, hostname: HOST });

console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`);

export type App = typeof app; 

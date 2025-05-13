import { Elysia, t } from 'elysia';

export const transactionRouter = new Elysia({ prefix: '/api' })
    // --- Transaction Broadcast Route ---
    .post('/transactions/broadcast', async ({ body, set }) => {
        const { txHex, network = 'mainnet' } = body;
        console.log(`[API] Received POST /api/transactions/broadcast for network ${network}`);

        if (!txHex || typeof txHex !== 'string' || txHex.length === 0) {
            set.status = 400;
            throw new Error('Missing or invalid txHex in request body.');
        }

        // Determine broadcast URL based on network
        let broadcastUrl;
        if (network === 'signet') {
            broadcastUrl = `https://mempool.space/signet/api/tx`;
        } else if (network === 'testnet') {
            broadcastUrl = `https://mempool.space/testnet/api/tx`;
        } else { // Default to mainnet
            broadcastUrl = `https://mempool.space/api/tx`;
        }
        console.log(`[API] Broadcasting tx via ${broadcastUrl}`);

        try {
            const response = await fetch(broadcastUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain',
                },
                body: txHex,
            });

            const responseText = await response.text();
            console.log(`[API] Broadcast response status: ${response.status}, text: ${responseText}`);

            if (!response.ok) {
                throw new Error(`Mempool broadcast error ${response.status}: ${responseText || response.statusText}`);
            }

            const txid = responseText;
            set.status = 200;
            // Use "as const" to ensure literal type for status
            return { status: 'success', txid: txid } as const;
        } catch (error) {
            console.error('[API] Error broadcasting transaction:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error broadcasting transaction';
            throw new Error(errorMessage);
        }
    }, {
        body: t.Object({
            txHex: t.String({ description: 'Raw transaction hex string to broadcast' }),
            network: t.Optional(t.Union([
                t.Literal('mainnet'),
                t.Literal('signet'),
                t.Literal('testnet')
            ], { default: 'mainnet' }))
        }),
        response: {
            200: t.Object({
                status: t.Literal('success'),
                txid: t.String({ description: 'Transaction ID of the broadcasted transaction' })
            })
        },
        detail: {
            summary: 'Broadcast Raw Transaction',
            description: 'Broadcasts a signed, raw Bitcoin transaction hex to the specified network via a public API (e.g., mempool.space). Returns the transaction ID on success.',
            tags: ['Transactions']
        }
    })
    // --- Transaction Status Route ---
    .get('/transactions/:txid/status', async ({ params, query, set }) => {
        const { txid } = params;
        const { network = 'mainnet' } = query;
        console.log(`[API] Received GET /api/transactions/${txid}/status for network ${network}`);

        if (!txid || typeof txid !== 'string' || txid.length !== 64) { // Basic TXID validation
            set.status = 400;
            throw new Error('Invalid or missing txid parameter.');
        }

        let statusUrl;
        if (network === 'signet') {
            statusUrl = `https://mempool.space/signet/api/tx/${txid}/status`;
        } else if (network === 'testnet') {
            statusUrl = `https://mempool.space/testnet/api/tx/${txid}/status`;
        } else { // Default to mainnet
            statusUrl = `https://mempool.space/api/tx/${txid}/status`;
        }
        console.log(`[API] Fetching tx status from ${statusUrl}`);

        try {
            const response = await fetch(statusUrl);
            console.log(`[API] Status fetch response status: ${response.status}`);

            if (response.status === 404) {
                set.status = 200; // Return 200 OK even if not found, but indicate status
                return { status: 'not_found' } as const;
            }

            if (!response.ok) {
                 const errorText = await response.text();
                 console.error(`[API] Mempool status error ${response.status}: ${errorText}`);
                 throw new Error(`Mempool status fetch error ${response.status}: ${errorText || response.statusText}`);
            }

            // Explicitly assert the expected type from mempool.space/api/tx/:txid/status
            const data = await response.json() as { confirmed: boolean; block_height?: number; block_hash?: string; block_time?: number };
            console.log(`[API] Status fetch response data:`, data);

            // Mempool returns { confirmed: boolean, block_height?: number, ... }
            if (data.confirmed === true) {
                set.status = 200;
                return { status: 'confirmed', block_height: data.block_height } as const;
            } else {
                set.status = 200;
                return { status: 'pending' } as const;
            }

        } catch (error) {
            console.error('[API] Error fetching transaction status:', error);
            // Don't throw here, let Elysia handle internal server error
            // Or, return a specific error status if preferred
            set.status = 500;
            return { status: 'error', message: error instanceof Error ? error.message : 'Unknown error fetching status' };
        }
    }, {
        params: t.Object({ 
            txid: t.String({ 
                description: 'The 64-character transaction ID (hex)',
                pattern: '^[a-fA-F0-9]{64}$' // Regex for hex string of length 64
            })
        }),
        query: t.Object({
            network: t.Optional(t.Union([
                t.Literal('mainnet'),
                t.Literal('signet'),
                t.Literal('testnet')
            ], { default: 'mainnet' }))
        }),
        response: {
             // Use a union to represent the different possible successful status responses
            200: t.Union([
                t.Object({ 
                    status: t.Literal('confirmed'),
                    block_height: t.Optional(t.Number({ description: 'Block height if confirmed' }))
                }),
                t.Object({ status: t.Literal('pending') }),
                t.Object({ status: t.Literal('not_found') })
                // Include error status if needed, though 500 is usually handled by framework
                // t.Object({ status: t.Literal('error'), message: t.String() })
            ]),
            500: t.Object({ // Example error response
                status: t.Literal('error'),
                message: t.String()
            })
        },
        detail: {
            summary: 'Get Transaction Confirmation Status',
            description: 'Fetches the confirmation status of a Bitcoin transaction from a public API (e.g., mempool.space). Returns whether the transaction is confirmed, pending, or not found.',
            tags: ['Transactions']
        }
    }); 
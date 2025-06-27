import { Elysia } from 'elysia';
import { inscriptionRouter } from './inscriptionRouter';
import { resourceRouter } from './resourceRouter';
import { resourceInscriptionRouter } from './resourceInscriptionRouter';
import { exploreRouter } from './exploreRouter';
import { utxoRouter } from './utxoRouter';
import { transactionRouter } from './transactionRouter';
import { verificationRouter } from './verificationRouter';
import { didRouter } from './didRouter';
import { indexerRouter } from './indexerRouter';

// Set up basic routes
export const setupBaseRoutes = (app: Elysia) => {
    return app
        .get('/', () => ({ message: 'Ordinals Plus API Running' }))
        .get('/health', () => ({ 
            status: 'healthy', 
            timestamp: new Date().toISOString() 
        }))
        .get('/api/networks', () => {
            console.log('[Route] GET /api/networks');
            return [
                { id: 'mainnet', name: 'Bitcoin Mainnet', type: 'mainnet' },
                { id: 'signet', name: 'Bitcoin Signet', type: 'signet' },
                { id: 'testnet', name: 'Bitcoin Testnet', type: 'testnet' }
            ];
        }, {
            detail: {
                summary: 'Get Available Networks',
                description: 'Returns a list of Bitcoin networks the application might interact with.',
                tags: ['Configuration']
            }
        });
};

// Register all API routers
export const registerRouters = (app: Elysia) => {
    // First set up the base routes
    const baseApp = setupBaseRoutes(app);
    
    // Then register all feature-specific routers
    return baseApp
        .use(inscriptionRouter)
        .use(resourceRouter)
        .use(resourceInscriptionRouter)
        .use(exploreRouter)
        .use(utxoRouter)
        .use(transactionRouter)
        .use(verificationRouter)
        .use(didRouter)
        .use(indexerRouter);
}; 
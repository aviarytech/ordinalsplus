import { configureApi, PORT, HOST } from './config/apiConfig';
import { registerRouters } from './routers';
import { vcApiRoutes } from './routers/vcApiRoutes';

/**
 * Main API entry point
 * 
 * This file is responsible for:
 * 1. Configuring the API (middleware, plugins, etc.)
 * 2. Registering all routers/routes
 * 3. Starting the server
 * 
 * Business logic is kept separate in controllers and services.
 */

// Initialize API configuration with middleware, plugins, etc.
const app = configureApi();

// Register all routers for different API endpoints
const apiWithRoutes = registerRouters(app);

// Register VC API routes
apiWithRoutes.use(vcApiRoutes);

// Start the server
console.log(`API starting on ${HOST}:${PORT}`);
apiWithRoutes.listen({
    hostname: HOST,
    port: Number(PORT)
});

// Export the app type for testing
export type App = typeof apiWithRoutes;

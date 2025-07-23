import { OrdiscanProvider, OrdNodeProvider, type BitcoinNetwork, type ResourceProvider } from 'ordinalsplus';
import { env } from '../config/envConfig';

// Cache for provider instances per network
const providerCache: Partial<Record<string, ResourceProvider>> = {};

// Function to get provider based on network
export function getProvider(network: string = 'mainnet'): ResourceProvider | null {
    console.log(`[ProviderService] Requesting provider for network: ${network}`);

    // Return cached provider if available
    if (providerCache[network]) {
        console.log(`[ProviderService] Returning cached provider for ${network}`);
        return providerCache[network]!;
    }

    console.log(`[ProviderService] No cached provider found for ${network}. Creating new instance...`);

    let providerInstance: ResourceProvider | null = null;
    let nodeUrl: string | undefined = undefined;
    let ordiscanKey: string | undefined = undefined;

    // Determine configuration based on network
    switch (network) {
        case 'mainnet':
            nodeUrl = env.MAINNET_ORD_NODE_URL;
            ordiscanKey = env.MAINNET_ORDISCAN_API_KEY || env.ORDISCAN_API_KEY; // Allow global fallback
            break;
        case 'testnet':
            nodeUrl = env.TESTNET_ORD_NODE_URL;
            ordiscanKey = env.TESTNET_ORDISCAN_API_KEY; // No global fallback for testnet key
            break;
        case 'signet':
            // Default Signet URL if env var is not set
            nodeUrl = env.SIGNET_ORD_NODE_URL || 'http://127.0.0.1:80';
            console.log(`[ProviderService] Signet nodeUrl resolved to: ${nodeUrl}`);
            // Ordiscan doesn't support Signet, use local ord node
            break;
        default:
            console.error(`[ProviderService] Unsupported network requested: ${network}`);
            return null;
    }

    console.log(`[ProviderService] Network: ${network}, nodeUrl: ${nodeUrl}, ordiscanKey: ${ordiscanKey ? 'SET' : 'NOT SET'}`);

    // Prioritize OrdNodeProvider if URL is configured for the network
    if (nodeUrl) {
        console.log(`[ProviderService] Creating OrdNodeProvider for ${network} with URL: ${nodeUrl}`);
        // Use 'nodeUrl' as expected by the constructor
        providerInstance = new OrdNodeProvider({ nodeUrl: nodeUrl, network: network as BitcoinNetwork }); 
        console.log(`[ProviderService] OrdNodeProvider created successfully for ${network}`);
        // TODO: Add authentication if needed (e.g., cookie file path, user/pass)
    } 
    // Fallback to OrdiscanProvider if API key is available (for mainnet/testnet)
    else if (ordiscanKey && (network === 'mainnet' || network === 'testnet')) {
        console.log(`[ProviderService] Using OrdiscanProvider for ${network}`);
        // Remove the 'network' option, it's likely inferred or set via endpoint
        providerInstance = new OrdiscanProvider({ 
            apiKey: ordiscanKey,
            // apiEndpoint can be set here if needed per network
        });
    } else {
        console.error(`[ProviderService] No configuration found for network: ${network}. Set corresponding ORD_NODE_URL or ORDISCAN_API_KEY.`);
        // Optionally throw an error instead of returning null if a provider is mandatory
        // throw new Error(`No provider configuration found for network: ${network}`);
        return null; 
    }

    // Cache the newly created instance
    if (providerInstance) {
        console.log(`[ProviderService] Caching provider instance for ${network}`);
        providerCache[network] = providerInstance;
    }

    return providerInstance;
} 

// REMOVED old global provider and initializeProvider function
// let provider: ResourceProvider | null = null;
// export function initializeProvider(): ResourceProvider { ... } 
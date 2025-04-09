import { OrdiscanProvider, OrdNodeProvider, type ResourceProvider } from 'ordinalsplus';

let provider: ResourceProvider | null = null;

export function initializeProvider(): ResourceProvider {
    if (provider) {
        return provider;
    }

    const ordiscanApiKey = process.env.ORDISCAN_API_KEY;
    const ordNodeUrl = process.env.ORD_NODE_URL;

    if (ordiscanApiKey) {
        provider = new OrdiscanProvider({ 
            apiKey: ordiscanApiKey,
            apiEndpoint: 'https://api.ordiscan.com/v1'
        });
    } else if (ordNodeUrl) {
        provider = new OrdNodeProvider({ nodeUrl: ordNodeUrl });
    } else {
        throw new Error('No provider configuration found. Set either ORDISCAN_API_KEY or ORD_NODE_URL.');
    }

    return provider;
}

export function getProvider(): ResourceProvider {
    if (!provider) {
        return initializeProvider();
    }
    return provider;
} 
/// <reference types="bun-types" />
import { ResourceResolver } from '../src/resources/resource-resolver';
import { ProviderType } from '../src/resources/providers/provider-factory';
import { ERROR_CODES } from '../src/utils/constants';

// Add type definition for process.env
declare global {
    namespace NodeJS {
        interface ProcessEnv {
            ORDISCAN_API_KEY?: string;
            ORD_NODE_URL?: string;
        }
    }
}

async function testResourceResolution() {
    console.log('Starting resource resolution test...\n');

    // Test with Ordiscan provider
    console.log('Testing Ordiscan Provider:');
    console.log('-------------------------');
    
    const ordiscanResolver = new ResourceResolver({
        type: ProviderType.ORDISCAN,
        options: {
            apiKey: Bun.env.ORDISCAN_API_KEY || 'test-key',
            apiEndpoint: 'https://api.ordiscan.com'
        }
    });

    try {
        // Test valid resource resolution
        console.log('1. Testing valid resource resolution:');
        const resource = await ordiscanResolver.resolve('did:btco:1981695809440896/0');
        console.log('Resource resolved successfully:');
        console.log(`- ID: ${resource.id}`);
        console.log(`- Type: ${resource.type}`);
        console.log(`- Content Type: ${resource.contentType}`);
        console.log(`- Inscription ID: ${resource.inscriptionId}`);
        console.log(`- DID Reference: ${resource.didReference}`);
        console.log(`- Sat: ${resource.sat}`);
        console.log(`- Content: ${JSON.stringify(resource.content)}\n`);

        // Test resource info resolution
        console.log('2. Testing resource info resolution:');
        const resourceInfo = await ordiscanResolver.resolveInfo('did:btco:1981695809440896/0');
        console.log('Resource info resolved successfully:');
        console.log(`- ID: ${resourceInfo.id}`);
        console.log(`- Type: ${resourceInfo.type}`);
        console.log(`- Content Type: ${resourceInfo.contentType}`);
        console.log(`- Created At: ${resourceInfo.createdAt}`);
        console.log(`- Updated At: ${resourceInfo.updatedAt}\n`);

        // Test collection resolution
        console.log('3. Testing collection resolution:');
        const collection = await ordiscanResolver.resolveCollection('did:btco:1713036377953371', { limit: 5 });
        console.log(`Collection resolved successfully with ${collection.length} items`);
        console.log('First item in collection:');
        console.log(`- ID: ${collection[0].id}`);
        console.log(`- Type: ${collection[0].type}\n`);

        // Test invalid resource ID
        console.log('4. Testing invalid resource ID:');
        try {
            await ordiscanResolver.resolve('invalid-id');
        } catch (error) {
            console.log('Expected error caught:');
            console.log(`- Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
        }

    } catch (error) {
        console.error('Error testing Ordiscan provider:', error);
    }

    // Test with Ord provider
    console.log('Testing Ord Provider:');
    console.log('-------------------');
    
    const ordResolver = new ResourceResolver({
        type: ProviderType.ORD,
        options: {
            nodeUrl: Bun.env.ORD_NODE_URL || 'http://localhost:8080'
        }
    });

    try {
        // Test valid resource resolution
        console.log('1. Testing valid resource resolution:');
        const resource = await ordResolver.resolve('did:btco:300000000000/0');
        console.log('Resource resolved successfully:');
        console.log(`- ID: ${resource.id}`);
        console.log(`- Type: ${resource.type}`);
        console.log(`- Content Type: ${resource.contentType}`);
        console.log(`- Inscription ID: ${resource.inscriptionId}`);
        console.log(`- DID Reference: ${resource.didReference}`);
        console.log(`- Sat: ${resource.sat}`);
        console.log(`- Content: ${JSON.stringify(resource.content)}\n`);

        // Test resource info resolution
        console.log('2. Testing resource info resolution:');
        const resourceInfo = await ordResolver.resolveInfo('did:btco:300000000000/0');
        console.log('Resource info resolved successfully:');
        console.log(`- ID: ${resourceInfo.id}`);
        console.log(`- Type: ${resourceInfo.type}`);
        console.log(`- Content Type: ${resourceInfo.contentType}`);
        console.log(`- Created At: ${resourceInfo.createdAt}`);
        console.log(`- Updated At: ${resourceInfo.updatedAt}\n`);

        // Test collection resolution
        console.log('3. Testing collection resolution:');
        const collection = await ordResolver.resolveCollection('did:btco:300000000000', { limit: 5 });
        console.log(`Collection resolved successfully with ${collection.length} items`);
        console.log('First item in collection:');
        console.log(`- ID: ${collection[0].id}`);
        console.log(`- Type: ${collection[0].type}\n`);

        // Test invalid resource ID
        console.log('4. Testing invalid resource ID:');
        try {
            await ordResolver.resolve('invalid-id');
        } catch (error) {
            console.log('Expected error caught:');
            console.log(`- Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
        }

    } catch (error) {
        console.error('Error testing Ord provider:', error);
    }
}

// Run the test
console.log('Resource Resolution Test Script');
console.log('==============================\n');

testResourceResolution()
    .then(() => console.log('\nTest completed successfully'))
    .catch(error => console.error('\nTest failed:', error)); 
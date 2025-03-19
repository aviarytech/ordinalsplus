import OrdinalsPlus, { BtcoDid, ResourceResolver } from '../src';

/**
 * Example showing basic usage of the Ordinals Plus library
 */
async function runExample() {
  console.log('OrdinalsPlus Library Example');
  console.log('============================\n');

  // Example DID and resource
  const exampleDid = 'did:btco:1234567890';
  const exampleResourceId = 'did:btco:1234567890/0';

  // Example 1: Validate a BTCO DID
  console.log('Example 1: Validate DID');
  console.log('-----------------------');
  const isValid = OrdinalsPlus.utils.isValidBtcoDid(exampleDid);
  console.log(`Is "${exampleDid}" a valid BTCO DID? ${isValid}`);
  console.log();

  // Example 2: Parse a BTCO DID
  console.log('Example 2: Parse DID');
  console.log('-------------------');
  const parsedDid = OrdinalsPlus.utils.parseBtcoDid(exampleDid);
  if (parsedDid) {
    console.log('Parsed DID components:');
    console.log(`- Method: ${parsedDid.method}`);
    console.log(`- Sat Number: ${parsedDid.satNumber}`);
  } else {
    console.log('Failed to parse DID');
  }
  console.log();

  // Example 3: Create and use a BtcoDid instance
  console.log('Example 3: Using BtcoDid');
  console.log('------------------------');
  try {
    const did = new BtcoDid(exampleDid);
    console.log(`DID: ${did.getDid()}`);
    console.log(`Sat Number: ${did.getSatNumber()}`);
    
    // Note: This will fail in this example since we're using a fake DID
    // In a real application, you would use a valid DID from the blockchain
    console.log('\nAttempting to resolve DID document (will fail with fake DID):');
    try {
      const didDoc = await did.resolve();
      console.log('DID Document:', JSON.stringify(didDoc, null, 2));
    } catch (error: any) {
      console.log(`Resolution error: ${error.message || 'Unknown error'}`);
    }
  } catch (error: any) {
    console.log(`Error: ${error.message || 'Unknown error'}`);
  }
  console.log();

  // Example 4: Using ResourceResolver
  console.log('Example 4: Using ResourceResolver');
  console.log('--------------------------------');
  const resolver = new ResourceResolver();
  
  // Note: This will fail in this example since we're using a fake resource ID
  // In a real application, you would use a valid resource ID from the blockchain
  console.log('Attempting to resolve resource information (will fail with fake resource ID):');
  try {
    const resourceInfo = await resolver.resolveInfo(exampleResourceId);
    console.log('Resource Info:', JSON.stringify(resourceInfo, null, 2));
  } catch (error: any) {
    console.log(`Resolution error: ${error.message || 'Unknown error'}`);
  }
  
  console.log('\nExample completed.');
}

// Run the example
runExample().catch(error => {
  console.error('Unhandled error:', error);
}); 
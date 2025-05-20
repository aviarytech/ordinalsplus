#!/usr/bin/env node

/**
 * Test script for Verifiable credential creation on Signet
 * 
 * This script automates the process of creating a Verifiable credential
 * on the Signet network for testing purposes.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const CONFIG_PATH = path.join(__dirname, '..', 'signet-config.json');
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));

// Helper functions
function runBitcoinCliCommand(command, wallet = null) {
  const walletArg = wallet ? `-rpcwallet=${wallet}` : '';
  const cmd = `${config.scripts.bitcoinCli} ${walletArg} ${command}`;
  console.log(`Running: ${cmd}`);
  return execSync(cmd, { encoding: 'utf8' });
}

function checkBitcoinNode() {
  try {
    const info = JSON.parse(runBitcoinCliCommand('getblockchaininfo'));
    console.log(`Bitcoin Core running on ${info.chain}`);
    console.log(`Current block height: ${info.blocks}`);
    return true;
  } catch (error) {
    console.error('Bitcoin Core is not running or not accessible');
    console.error(error.message);
    return false;
  }
}

function checkOrdServer() {
  try {
    // Try to connect to the Ord server
    const response = execSync('curl -s http://localhost:80/status', { encoding: 'utf8' });
    console.log('Ord server is running');
    return true;
  } catch (error) {
    console.error('Ord server is not running or not accessible');
    console.error(error.message);
    return false;
  }
}

function checkWalletBalance(wallet) {
  try {
    const balance = runBitcoinCliCommand('getbalance', wallet);
    console.log(`Wallet ${wallet} balance: ${balance} BTC`);
    return parseFloat(balance);
  } catch (error) {
    console.error(`Error checking wallet balance: ${error.message}`);
    return 0;
  }
}

function requestTestCoins(address) {
  try {
    console.log(`Requesting test coins for address: ${address}`);
    execSync(`${config.scripts.requestCoins} ${address}`, { encoding: 'utf8' });
    console.log('Request sent to faucet. Please wait for confirmation.');
  } catch (error) {
    console.error(`Error requesting test coins: ${error.message}`);
  }
}

function createVerifiableCredential() {
  // This function would integrate with the ordinalsplus library
  // to create a Verifiable credential on Signet
  console.log('Creating Verifiable credential...');
  console.log('This functionality will be implemented once the Signet environment is fully set up');
}

// Main execution
async function main() {
  console.log('=== Verifiable Credential Test on Signet ===');
  
  // Step 1: Check if Bitcoin Core is running
  console.log('\n1. Checking Bitcoin Core...');
  if (!checkBitcoinNode()) {
    console.log('Please start Bitcoin Core with: npm run btc:signet');
    process.exit(1);
  }
  
  // Step 2: Check if Ord server is running
  console.log('\n2. Checking Ord server...');
  if (!checkOrdServer()) {
    console.log('Please start Ord server with: npm run ord:server');
    process.exit(1);
  }
  
  // Step 3: Check wallet balance
  console.log('\n3. Checking wallet balance...');
  const balance = checkWalletBalance(config.wallet.name);
  
  // Step 4: Request test coins if balance is too low
  if (balance < 0.001) {
    console.log('\n4. Balance too low, requesting test coins...');
    requestTestCoins(config.wallet.addresses.verifiable_credential);
    console.log('Please wait for the transaction to be confirmed and run this script again.');
    process.exit(0);
  } else {
    console.log('\n4. Balance sufficient for testing.');
  }
  
  // Step 5: Create Verifiable credential
  console.log('\n5. Creating Verifiable credential...');
  createVerifiableCredential();
  
  console.log('\n=== Test completed ===');
}

main().catch(error => {
  console.error('Error running test:', error);
  process.exit(1);
});

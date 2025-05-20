# Signet Testing Environment Setup Documentation

## Overview

This document provides a comprehensive guide to the Signet testing environment setup for the OrdinalsPlus project. This environment is specifically configured for testing the Verifiable credential on the Signet network.

## Components

The Signet testing environment consists of the following components:

1. **Bitcoin Core** - Running on Signet network
2. **Ord Server** - For indexing and serving inscriptions
3. **Test Wallet** - For creating and managing Verifiable credentials
4. **Helper Scripts** - For automating testing tasks

## Setup Process

### 1. Bitcoin Core Configuration

Bitcoin Core has been configured to run on Signet with the following settings:

- Network: Signet
- Data directory: `./data`
- Transaction indexing enabled (required for Ord)
- RPC server enabled on localhost

The configuration is stored in `./bitcoin.conf`.

### 2. Wallet Setup

A dedicated wallet has been created for Verifiable credential testing:

- Wallet name: `verifiable_credential_wallet`
- Address for Verifiable credential: `tb1qlm0ztddtrfu6temuf5ncpssrkaqgtx0wmgdn63`

The wallet information is documented in `./verifiable-credential-wallet-info.md`.

### 3. Ord Server Configuration

The Ord server has been configured to:

- Connect to the Bitcoin Core node on Signet
- Use the same cookie file for authentication
- Store index data in `./data/signet`
- Serve the web interface on port 80

### 4. Helper Scripts

Several helper scripts have been created to simplify testing:

- `scripts/bitcoin-cli-signet.sh` - For running Bitcoin CLI commands with the correct configuration
- `scripts/request-signet-coins.sh` - For requesting test coins from a Signet faucet
- `scripts/test-verifiable-credential.js` - For verifying the environment and testing credential creation
- `scripts/setup-signet-environment.sh` - Launches Bitcoin Core and Ord, creates the test wallet, and requests faucet funds
- `scripts/teardown-signet-environment.sh` - Stops the Signet environment services

### 5. Configuration Files

All configuration settings are stored in:

- `bitcoin.conf` - Bitcoin Core configuration
- `signet-config.json` - Global configuration for the testing environment

## Usage Instructions

### Starting the Environment
You can start all required services with a single command:

```bash
./scripts/setup-signet-environment.sh
```

This script launches Bitcoin Core, creates the test wallet, starts the Ord indexer and server, and requests faucet funds automatically.

Stop all services with:

```bash
./scripts/teardown-signet-environment.sh
```

### Testing the Environment

Run the test script to verify that everything is working correctly:
```
node scripts/test-verifiable-credential.js
```

This script will:
- Check if Bitcoin Core is running
- Check if the Ord server is accessible
- Verify wallet balance
- Request test coins if needed
- (Future) Create a Verifiable credential for testing

### Funding the Test Wallet

Test coins can be requested from a Signet faucet using:
```
./scripts/request-signet-coins.sh tb1qlm0ztddtrfu6temuf5ncpssrkaqgtx0wmgdn63
```

## Troubleshooting

### Bitcoin Core Issues

- If Bitcoin Core fails to start, check if it's already running with `ps aux | grep bitcoind`
- Verify the data directory exists and is writable
- Check the Bitcoin Core logs in the data directory

### Ord Server Issues

- If the Ord server fails to start, ensure Bitcoin Core is running first
- Check that the cookie file exists and is accessible
- Verify the data directory for Ord exists and is writable

### Wallet Issues

- If the wallet balance remains at 0, wait longer for the faucet transaction to confirm
- Check transaction status with `./scripts/bitcoin-cli-signet.sh -rpcwallet=verifiable_credential_wallet listtransactions`
- Try requesting coins from an alternative Signet faucet

## Next Steps

1. Implement the Verifiable credential creation logic in the test script
2. Create integration tests for the Verifiable credential functionality
3. Document the credential creation and verification process

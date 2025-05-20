# Signet Testing Environment Setup

This document describes how to set up and use the Signet testing environment for the OrdinalsPlus project. This environment is used for testing Verifiable credential creation on the Cygnet network.

## Prerequisites

- Bitcoin Core (installed via Homebrew)
- Ord (for inscription indexing)
- Node.js and npm

## Components

The Signet testing environment consists of the following components:

1. **Bitcoin Core** running on Signet network
2. **Ord server** for indexing inscriptions
3. **Test wallet** with funded UTXOs
4. **Configuration files** and helper scripts

## Setup Instructions

### 1. Bitcoin Core Configuration

Bitcoin Core is configured to run on Signet using the `bitcoin.conf` file in the project root:

```
# Network settings
signet=1

# Enable RPC server
server=1
rpcallowip=127.0.0.1
cookiefile=/Users/brian/Projects/ordinalsplus/data/signet/.cookie

# Transaction index (required by ord)
txindex=1

# Data directory
datadir=/Users/brian/Projects/ordinalsplus/data
```

### 2. Starting Bitcoin Core on Signet

Use the provided npm script to start Bitcoin Core on Signet:

```bash
npm run btc:signet
```

This will start Bitcoin Core as a daemon process using the configuration file.

### 3. Wallet Setup

A test wallet has been created for Verifiable credential testing:

```bash
# Create the wallet
./scripts/bitcoin-cli-signet.sh createwallet "verifiable_credential_wallet"

# Generate an address
./scripts/bitcoin-cli-signet.sh -rpcwallet=verifiable_credential_wallet getnewaddress "verifiable_credential" "bech32"
```

The wallet details are stored in `verifiable-credential-wallet-info.md`.

### 4. Funding the Wallet

To fund the wallet with Signet coins, use the provided script:

```bash
./scripts/request-signet-coins.sh tb1qlm0ztddtrfu6temuf5ncpssrkaqgtx0wmgdn63
```

Alternatively, you can use one of these Signet faucets:
- [Signet Faucet](https://signet.bc-2.jp/)
- [Alternative Signet Faucet](https://signetfaucet.com/)

### 5. Starting the Ord Server

To start the Ord server for indexing inscriptions:

```bash
npm run ord:index  # For indexing only
npm run ord:server  # For indexing and serving HTTP requests
```

## Helper Scripts

Several helper scripts have been created to simplify working with the Signet environment:

- `scripts/bitcoin-cli-signet.sh`: Run bitcoin-cli commands with the correct configuration
- `scripts/request-signet-coins.sh`: Request test coins from a Signet faucet

## Configuration

All configuration settings for the Signet environment are stored in `signet-config.json`.

## Verification

To verify that the Signet environment is working correctly:

1. Check that Bitcoin Core is running:
   ```bash
   ./scripts/bitcoin-cli-signet.sh getblockchaininfo
   ```

2. Check wallet balance:
   ```bash
   ./scripts/bitcoin-cli-signet.sh -rpcwallet=verifiable_credential_wallet getbalance
   ```

3. Verify that the Ord server is indexing:
   ```bash
   curl http://localhost:8080/status
   ```

## Troubleshooting

### Bitcoin Core won't start

Check if Bitcoin Core is already running:
```bash
ps aux | grep bitcoind
```

### Wallet has no funds

Request more coins from the Signet faucet or check if the transaction is still pending:
```bash
./scripts/bitcoin-cli-signet.sh -rpcwallet=verifiable_credential_wallet listtransactions
```

### Ord server connection issues

Make sure Bitcoin Core is running and fully synced before starting the Ord server.

## References

- [Bitcoin Core Documentation](https://developer.bitcoin.org/reference/rpc/)
- [Signet Documentation](https://en.bitcoin.it/wiki/Signet)
- [Ord Documentation](https://github.com/ordinals/ord)

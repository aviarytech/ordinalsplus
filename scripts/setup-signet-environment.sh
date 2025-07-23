#!/usr/bin/env bash
set -euo pipefail

# Simple automation script to start the local Signet testing environment
# Requires bitcoind and ord binaries installed and accessible in PATH.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
CONFIG_FILE="$ROOT_DIR/signet-config.json"

# Helper function to extract values from signet-config.json using node
json() {
  node -e "console.log(require('$CONFIG_FILE')$1)" 2>/dev/null
}

BITCOIN_CONF_REL=$(json '.bitcoin.configFile')
BITCOIN_CONF="$(realpath "$ROOT_DIR/$BITCOIN_CONF_REL")"
BITCOIN_CLI_REL=$(json '.scripts.bitcoinCli')
BITCOIN_CLI="$(realpath "$ROOT_DIR/$BITCOIN_CLI_REL")"
RPC_URL=$(json '.bitcoin.rpcUrl')
COOKIE_FILE="$(realpath "$ROOT_DIR/$(json '.bitcoin.cookieFile')")"
ORD_DATA_DIR="$(realpath "$ROOT_DIR/$(json '.ord.dataDir')")"
WALLET_NAME=$(json '.wallet.name')
ADDRESS=$(json '.wallet.addresses.verifiable_credential')
REQUEST_COINS_REL=$(json '.scripts.requestCoins')
REQUEST_COINS="$(realpath "$ROOT_DIR/$REQUEST_COINS_REL")"

echo "Not Starting bitcoind on Signet..."
# bitcoind -conf="$BITCOIN_CONF" -daemon

# Give bitcoind a moment to start
sleep 3

# Create wallet if it doesn't exist
if ! $BITCOIN_CLI -rpcwallet="$WALLET_NAME" getwalletinfo >/dev/null 2>&1; then
  echo "Creating wallet $WALLET_NAME"
  $BITCOIN_CLI createwallet "$WALLET_NAME"
fi

# Generate an address to ensure the wallet is initialized
$BITCOIN_CLI -rpcwallet="$WALLET_NAME" getnewaddress "verifiable_credential" "bech32" >/dev/null

echo "Launching Ord indexer and server..."
ORD_ARGS=(--signet --bitcoin-rpc-url="$RPC_URL" --cookie-file="$COOKIE_FILE" --data-dir="$ORD_DATA_DIR")
ord "${ORD_ARGS[@]}" index &
ORD_INDEX_PID=$!
ord "${ORD_ARGS[@]}" server &
ORD_SERVER_PID=$!

# Request test coins
echo "Requesting Signet coins from faucet..."
$REQUEST_COINS "$ADDRESS" || true

cat <<MSG
Signet environment started.
- bitcoind running with config $BITCOIN_CONF
- Ord indexer PID: $ORD_INDEX_PID
- Ord server PID: $ORD_SERVER_PID
MSG

#!/bin/bash

# Script to request Signet coins from a faucet
# Usage: ./request-signet-coins.sh <address>

if [ -z "$1" ]; then
  echo "Usage: ./request-signet-coins.sh <address>"
  echo "Example: ./request-signet-coins.sh tb1qlm0ztddtrfu6temuf5ncpssrkaqgtx0wmgdn63"
  exit 1
fi

ADDRESS=$1
FAUCET_URL="https://signet.bc-2.jp/api/faucet"

echo "Requesting Signet coins for address: $ADDRESS"
echo "Sending request to faucet: $FAUCET_URL"

# Use curl to request coins from the faucet
curl -X POST "$FAUCET_URL" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "address=$ADDRESS"

echo -e "\n\nPlease check your wallet balance in a few minutes to confirm the transaction."
echo "You can check your balance with: ./scripts/bitcoin-cli-signet.sh -rpcwallet=verifiable_credential_wallet getbalance"

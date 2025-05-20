#!/usr/bin/env bash
set -euo pipefail

# Helper script to run ord wallet commands with the correct configuration for the verifiable credential wallet
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
COOKIE_FILE="${ROOT_DIR}/data/signet/.cookie"
WALLET_DIR="${ROOT_DIR}/data/signet/verifiable_credential_wallet"
ord -s --bitcoin-rpc-url=http://127.0.0.1:38332 --cookie-file="$COOKIE_FILE" --data-dir="$WALLET_DIR" wallet "$@"

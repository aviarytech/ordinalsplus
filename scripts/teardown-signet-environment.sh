#!/usr/bin/env bash
set -euo pipefail

# Stop running Signet services started by setup-signet-environment.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
CONFIG_FILE="$ROOT_DIR/signet-config.json"

json() {
  node -e "console.log(require('$CONFIG_FILE')$1)" 2>/dev/null
}

BITCOIN_CLI_REL=$(json '.scripts.bitcoinCli')
BITCOIN_CLI="$(realpath "$ROOT_DIR/$BITCOIN_CLI_REL")"

# Try to stop ord processes
if pgrep -f "ord.*--signet" >/dev/null; then
  echo "Stopping Ord processes..."
  pkill -f "ord.*--signet" || true
fi

# Stop bitcoind
if pgrep -f "bitcoind" >/dev/null; then
  echo "Stopping bitcoind..."
  $BITCOIN_CLI stop || true
fi

echo "Signet environment stopped."

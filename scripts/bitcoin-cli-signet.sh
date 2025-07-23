#!/usr/bin/env bash
set -euo pipefail

# Helper script to run bitcoin-cli with the correct configuration for Signet
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
bitcoin-cli -conf="${ROOT_DIR}/bitcoin.conf" -signet "$@"

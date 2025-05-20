#!/usr/bin/env bash
set -euo pipefail

# Basic setup script for local development or CI
# Installs Bun if missing and installs dependencies for all packages

echo "Configuring OrdinalsPlus environment..."

if ! command -v bun >/dev/null 2>&1; then
  echo "Bun not found. Installing..."
  curl -fsSL https://bun.sh/install | bash
  export BUN_INSTALL="$HOME/.bun"
  export PATH="$BUN_INSTALL/bin:$PATH"
fi

echo "Installing root dependencies..."
npm install

for pkg in packages/*; do
  if [ -d "$pkg" ]; then
    echo "Installing dependencies in $pkg..."
    (cd "$pkg" && bun install)
  fi
done

echo "Environment configuration complete."

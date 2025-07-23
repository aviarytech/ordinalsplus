#!/bin/bash

# Restore npm version script
# This script restores the npm version of ordinalsplus

echo "🔄 Restoring npm version..."

# Restore the original package.json
cp package.json.backup package.json

echo "✅ Restored npm version of ordinalsplus"
echo "📦 Installing dependencies..."
npm install

echo "🚀 Ready!" 
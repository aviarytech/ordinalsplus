#!/bin/bash

# Railway deployment script
# This script ensures that Railway uses the npm version of ordinalsplus

echo "🚀 Preparing for Railway deployment..."

# Copy the Railway-specific package.json
cp package.railway.json package.json

echo "✅ Using npm version of ordinalsplus for Railway deployment"
echo "📦 Installing dependencies..."
npm install

echo "🚀 Ready for Railway deployment!" 
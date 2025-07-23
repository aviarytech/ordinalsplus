#!/bin/bash

# Local development setup script
# This script switches to the local ordinalsplus package for development

echo "🔧 Setting up local development..."

# Create a temporary package.json with local file reference
cp package.json package.json.backup
sed 's/"ordinalsplus": "^1.0.3"/"ordinalsplus": "file:..\/ordinalsplus"/' package.json.backup > package.json

echo "✅ Using local ordinalsplus package for development"
echo "📦 Installing dependencies..."
npm install

echo "🚀 Ready for local development!"
echo "💡 Run './restore-npm.sh' to switch back to npm version" 
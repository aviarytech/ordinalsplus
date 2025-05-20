#!/bin/bash

# Install dependencies
echo "Installing dependencies..."
bun install

# Run linting
echo "Running linter..."
bun run lint || { echo "Linting failed"; exit 1; }

# Run tests
echo "Running tests..."
bun test || { echo "Tests failed"; exit 1; }

# Build the project
echo "Building project..."
bun run build || { echo "Build failed"; exit 1; }

echo "Build successful!"
echo "You can run the example with: bun run example" 
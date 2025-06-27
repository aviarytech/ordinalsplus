#!/bin/bash

# Clean Ordinals Plus Indexer Startup Script
# This script starts the clean, simple indexer that leverages the existing OrdinalsIndexer

echo "🚀 Starting Ordinals Plus Indexer..."

# Set default environment variables if not already set
export INDEXER_URL="${INDEXER_URL:-http://localhost:3000}"
export REDIS_URL="${REDIS_URL:-redis://localhost:6379}"
export POLL_INTERVAL="${POLL_INTERVAL:-60000}"
export BATCH_SIZE="${BATCH_SIZE:-100}"

echo "📋 Configuration:"
echo "  Ord Server: $INDEXER_URL"
echo "  Redis: $REDIS_URL"
echo "  Poll Interval: ${POLL_INTERVAL}ms"
echo "  Batch Size: $BATCH_SIZE"

# Health check for Redis
echo "🔍 Checking Redis connection..."
if command -v redis-cli &> /dev/null; then
    if ! redis-cli -u "$REDIS_URL" ping > /dev/null 2>&1; then
        echo "❌ Redis is not available at $REDIS_URL"
        echo "💡 Make sure Redis is running: docker run -d -p 6379:6379 redis:alpine"
        exit 1
    fi
    echo "✅ Redis is running"
else
    echo "⚠️  redis-cli not found, skipping Redis health check"
fi

# Start the indexer
node dist/cli.js start 
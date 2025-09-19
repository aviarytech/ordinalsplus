#!/bin/bash

# Simple status script to check indexer progress
# Requires redis-cli to be available

echo "🔍 Ordinals Plus Indexer Status"
echo "================================"

# Check if redis-cli is available
if ! command -v redis-cli &> /dev/null; then
    echo "❌ redis-cli not found. Please install redis-tools."
    exit 1
fi

# Get Redis URL from environment or use default
REDIS_URL=${REDIS_URL:-"redis://localhost:6379"}

# Extract host and port from Redis URL
if [[ $REDIS_URL =~ redis://([^:]+):([0-9]+) ]]; then
    REDIS_HOST=${BASH_REMATCH[1]}
    REDIS_PORT=${BASH_REMATCH[2]}
else
    REDIS_HOST="localhost"
    REDIS_PORT="6379"
fi

# Check Redis connection
if ! redis-cli -h $REDIS_HOST -p $REDIS_PORT ping > /dev/null 2>&1; then
    echo "❌ Cannot connect to Redis at $REDIS_HOST:$REDIS_PORT"
    echo "   Make sure Redis is running and REDIS_URL is correct"
    exit 1
fi

echo "✅ Connected to Redis at $REDIS_HOST:$REDIS_PORT"
echo ""

# Get cursor position
CURSOR=$(redis-cli -h $REDIS_HOST -p $REDIS_PORT get "indexer:cursor" 2>/dev/null || echo "Not set")
echo "📍 Current cursor position: $CURSOR"

# Get failure info
FAILURES=$(redis-cli -h $REDIS_HOST -p $REDIS_PORT get "indexer:consecutive_failures" 2>/dev/null || echo "0")
BACKOFF_UNTIL=$(redis-cli -h $REDIS_HOST -p $REDIS_PORT get "indexer:backoff_until" 2>/dev/null || echo "")

echo "⚠️ Consecutive failures: $FAILURES"

if [ ! -z "$BACKOFF_UNTIL" ]; then
    CURRENT_TIME=$(date +%s)000  # Convert to milliseconds
    if [ "$BACKOFF_UNTIL" -gt "$CURRENT_TIME" ]; then
        REMAINING=$(( ($BACKOFF_UNTIL - $CURRENT_TIME) / 1000 ))
        echo "⏸️ In backoff mode for $REMAINING more seconds"
    else
        echo "✅ Backoff period expired, ready to resume"
    fi
else
    echo "✅ No backoff active"
fi

echo ""

# Get resource counts
ORDINALS_TOTAL=$(redis-cli -h $REDIS_HOST -p $REDIS_PORT get "ordinals-plus:stats:total" 2>/dev/null || echo "0")
NON_ORDINALS_TOTAL=$(redis-cli -h $REDIS_HOST -p $REDIS_PORT get "non-ordinals:stats:total" 2>/dev/null || echo "0")
DID_COUNT=$(redis-cli -h $REDIS_HOST -p $REDIS_PORT get "ordinals-plus:stats:did-document" 2>/dev/null || echo "0")
VC_COUNT=$(redis-cli -h $REDIS_HOST -p $REDIS_PORT get "ordinals-plus:stats:verifiable-credential" 2>/dev/null || echo "0")
ERROR_COUNT=$(redis-cli -h $REDIS_HOST -p $REDIS_PORT get "indexer:stats:errors" 2>/dev/null || echo "0")

echo "📊 Resource Statistics:"
echo "   📋 Ordinals Plus total: $ORDINALS_TOTAL"
echo "   └── DID Documents: $DID_COUNT"
echo "   └── Verifiable Credentials: $VC_COUNT"
echo "   📋 Non-Ordinals total: $NON_ORDINALS_TOTAL"
echo "   ❌ Processing errors: $ERROR_COUNT"

echo ""

# Show recent resources (first 5 from each list)
echo "🔍 Recent Ordinals Plus resources (sample):"
redis-cli -h $REDIS_HOST -p $REDIS_PORT smembers "ordinals-plus-resources" 2>/dev/null | head -5 | sed 's/^/   ✅ /'

if [ "$ERROR_COUNT" -gt "0" ]; then
    echo ""
    echo "❌ Recent errors (first 3):"
    redis-cli -h $REDIS_HOST -p $REDIS_PORT lrange "indexer:errors" 0 2 2>/dev/null | head -3 | sed 's/^/   ❌ /'
fi

echo ""
echo "💡 To start/resume indexer:"
echo "   NETWORK=signet bun run cli start"
echo ""
echo "💡 To reset cursor (start over):"
echo "   redis-cli -h $REDIS_HOST -p $REDIS_PORT set indexer:cursor 0"
echo ""
echo "💡 To view error details:"
echo "   redis-cli -h $REDIS_HOST -p $REDIS_PORT hgetall indexer:error:<inscription-number>" 
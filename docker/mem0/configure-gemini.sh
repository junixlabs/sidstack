#!/bin/bash
# Configure mem0 server to use Gemini + Qdrant after startup
# Run this ONCE after docker compose up

MEM0_URL="${MEM0_URL:-http://localhost:4321}"

echo "Waiting for mem0 server..."
until curl -s "$MEM0_URL/" > /dev/null 2>&1; do
  sleep 1
done
echo "mem0 server is up!"

echo "Configuring Gemini LLM + embedder with Qdrant..."
curl -s -X POST "$MEM0_URL/configure" \
  -H "Content-Type: application/json" \
  -d '{
    "llm": {
      "provider": "gemini",
      "config": {
        "model": "gemini-2.0-flash",
        "temperature": 0.1,
        "max_tokens": 1000
      }
    },
    "embedder": {
      "provider": "gemini",
      "config": {
        "model": "text-embedding-004"
      }
    },
    "vector_store": {
      "provider": "qdrant",
      "config": {
        "host": "qdrant",
        "port": 6333
      }
    }
  }' | python3 -m json.tool 2>/dev/null || cat

echo ""
echo "Done! Test with: curl $MEM0_URL/memories/"

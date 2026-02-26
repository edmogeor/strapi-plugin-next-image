#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Install dependencies if needed
if [ ! -d "$ROOT/examples/strapi/node_modules" ]; then
  echo "Installing Strapi dependencies..."
  npm install --prefix "$ROOT/examples/strapi"
fi

if [ ! -d "$ROOT/examples/frontend/node_modules" ]; then
  echo "Installing frontend dependencies..."
  npm install --prefix "$ROOT/examples/frontend"
fi

echo ""
echo "Starting Strapi (port 1337) and Vite (port 5173)..."
echo "  Strapi admin:  http://localhost:1337/admin"
echo "  Frontend:      http://localhost:5173"
echo ""

# Run both in parallel, kill both on Ctrl+C
trap 'kill 0' EXIT
npm run develop --prefix "$ROOT/examples/strapi" &
npm run dev --prefix "$ROOT/examples/frontend" &
wait

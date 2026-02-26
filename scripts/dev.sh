#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Use Node 22 via nvm if available (Strapi v5 requires Node <=22)
if [ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]; then
  unset NPM_CONFIG_PREFIX 2>/dev/null || true
  source "${NVM_DIR:-$HOME/.nvm}/nvm.sh"
  nvm use 22 2>/dev/null || echo "Warning: Node 22 not installed via nvm, using $(node -v)"
fi

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

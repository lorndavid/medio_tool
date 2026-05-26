#!/usr/bin/env bash
# ============================================================
# MediaFlow Bot — deploy / update on Oracle Cloud
# Run after a `git pull` to install deps, build CSS, restart PM2.
# Usage:
#   cd ~/mediaflow && bash deploy/deploy.sh
# ============================================================
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "❌ .env is missing. Copy .env.example to .env and fill it in first."
  exit 1
fi

echo ">>> Installing production dependencies..."
npm ci --omit=dev || npm install --omit=dev

echo ">>> Building Tailwind CSS..."
# Tailwind is a devDep, install it just for the build then drop it again
npm install --no-save tailwindcss@3
npx tailwindcss -i src/styles/tailwind.input.css -o public/css/tailwind.css --minify

echo ">>> Creating logs / uploads dirs..."
mkdir -p logs uploads

echo ">>> Bootstrapping admin (idempotent)..."
node src/scripts/seedAdmin.js || echo "(admin already exists)"

echo ">>> Reloading PM2..."
if pm2 describe mediaflow-app >/dev/null 2>&1; then
  pm2 reload ecosystem.config.js --update-env
else
  pm2 start ecosystem.config.js
fi
pm2 save

echo ""
echo "✅ Deploy complete."
echo "   pm2 status        # see running processes"
echo "   pm2 logs          # tail logs"
echo "   curl localhost:3000/healthz"

#!/usr/bin/env bash
# Safe deploy for Traderra: STOP → BUILD → START.
#
# Never run `npm run build` while the server is live — `next start` reads .next/
# while `next build` rewrites it, causing a crash-loop (missing middleware-manifest.json).
# This script avoids the race by stopping first.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "→ Stopping traderra (if running)"
pm2 stop traderra >/dev/null 2>&1 || true

echo "→ Building (next build)…"
npm run build

echo "→ Starting traderra"
pm2 start ecosystem.config.cjs --update-env
sleep 6

echo "→ Health check"
curl -s -o /dev/null -w "scanner: HTTP %{http_code}\n" http://localhost:6565/scanner || echo "⚠ scanner not responding yet"
pm2 list | grep -E "traderra|name" || true

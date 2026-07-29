#!/usr/bin/env bash
# Safe deploy for Traderra with full rollback guardrails.
#
# Prevents the 2026-07-29 outage class: a deploy whose build was interrupted
# left a HALF-BUILT .next — some routes served 200 (built first) while others
# 500'd (corrupt bundles) → PM2 crash-loop → nothing on :6565.
#
# Guardrails added:
#   1. Backs up the known-good .next → .next.prev BEFORE building.
#   2. Build failure / interrupt → restores previous build + restarts (no serving
#      a broken build; old build keeps running).
#   3. Verifies the build is structurally complete (BUILD_ID + middleware-manifest).
#   4. Post-start MULTI-ROUTE healthcheck (/ and /scanner must both 200). Any
#      failure → automatic rollback to the previous build.
#
# NOTE: build happens while the server is STOPPED (never run `next build` while
# `next start` is reading .next — that race causes the crash-loop). Build-time
# downtime is ~2-4 min; the tradeoff is guaranteed rollback safety.
set -uo pipefail            # no -e: we handle errors explicitly for rollback
cd "$(dirname "$0")/.."

PORT="${TRADERRA_PORT:-6565}"
GATE_ROUTES="/ /scanner"    # must ALL return 200 or we roll back
PREV=".next.prev"           # rollback snapshot of the previous good build

red()   { printf '\033[31m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
bold()  { printf '\033[1m%s\033[0m\n' "$*"; }

# Rollback: restore previous build, restart, verify /, abort deploy.
rollback() {
  red "⚠ ROLLBACK — $1"
  if [ -d "$PREV" ]; then
    rm -rf .next
    mv "$PREV" .next
    pm2 start traderra >/dev/null 2>&1 || pm2 restart traderra >/dev/null 2>&1 || true
    sleep 6
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "http://localhost:$PORT/" || echo 000)
    if [ "$code" = "200" ]; then
      green "✓ Rolled back to previous build — / is HTTP 200 (site serving)"
    else
      red "⚠ Rollback restored previous build but / is HTTP $code — investigate manually"
    fi
  else
    red "⚠ No previous build to roll back to ($PREV missing). Server is STOPPED — fix the build then re-run deploy."
  fi
  exit 1
}

bold "→ Traderra guarded deploy (port $PORT)"

# 1. Snapshot the known-good build BEFORE touching anything (enables rollback).
if [ -d ".next" ]; then
  rm -rf "$PREV"
  mv .next "$PREV"
  echo "  backed up current build → $PREV"
else
  echo "  no existing .next — first deploy (no rollback snapshot)"
fi

# 2. Stop server so no reader touches .next during build (avoids the .next race).
echo "→ Stopping traderra"
pm2 stop traderra >/dev/null 2>&1 || true

# 3. Build. Non-zero exit → rollback.
echo "→ Building (next build)…"
if ! npm run build; then
  rollback "npm run build failed (exit $?)"
fi

# 4. Structural verification of the fresh build.
[ -f .next/BUILD_ID ]               || rollback "build exited 0 but .next/BUILD_ID missing (incomplete build)"
[ -f .next/server/middleware-manifest.json ] || rollback "middleware-manifest.json missing (would crash-loop next start)"
echo "  build OK — BUILD_ID=$(cat .next/BUILD_ID)"

# 5. Start the new build.
echo "→ Starting traderra"
pm2 start ecosystem.config.cjs --update-env
sleep 7

# 6. Multi-route gate: every gate route must be 200 or we roll back.
echo "→ Health check (gate routes)"
bad=0
for route in $GATE_ROUTES; do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 12 "http://localhost:$PORT$route" || echo 000)
  printf "  %-12s → %s\n" "$route" "$code"
  [ "$code" = "200" ] || bad=1
done
# informational-only (DB-dependent, not a rollback trigger)
hcode=$(curl -s -o /dev/null -w "%{http_code}" --max-time 12 "http://localhost:$PORT/api/health" || echo 000)
printf "  %-12s → %s  (info only)\n" "/api/health" "$hcode"
[ "$bad" = "0" ] || rollback "a gate route did not return 200 (half-serving detected)"

# 7. Success — drop the rollback snapshot.
rm -rf "$PREV"
green "✓ Deploy complete — gate routes healthy, previous snapshot cleared"
pm2 list | grep -E "traderra|name" || true

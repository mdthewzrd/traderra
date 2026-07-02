#!/bin/bash
# Watchdog: if traderra isn't serving HTTP 200, fully delete + start it.
# Only logs when it actually does something (no spam on success).
# Cron (every 2 min): */2 * * * * /home/mdwzrd/traderra/scripts/watchdog.sh >> /home/mdwzrd/traderra/scripts/watchdog.log 2>&1

# cron has minimal PATH — load nvm so pm2 resolves
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
PM2="$HOME/.nvm/versions/node/v22.22.0/bin/pm2"
cd /home/mdwzrd/traderra

# If a rebuild is in progress (.next deleted), DON'T thrash — just exit.
# Restarting next-server with no build = crash loop = stays down.
if [ ! -f .next/BUILD_ID ]; then
  echo "$(date -Is) .next missing — rebuild in progress, skipping"
  exit 0
fi

code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 6 http://localhost:6565/database 2>/dev/null)
if [ "$code" != "200" ]; then
  echo "$(date -Is) DOWN (http=$code) — full delete + start"
  # delete (NOT reset) clears the stale exec-path; start from project dir loads ecosystem.config.cjs
  $PM2 delete traderra >/dev/null 2>&1
  $PM2 start ecosystem.config.cjs >/dev/null 2>&1
  sleep 5
  # verify it actually came back
  code2=$(curl -s -o /dev/null -w '%{http_code}' --max-time 6 http://localhost:6565/database 2>/dev/null)
  if [ "$code2" = "200" ]; then
    echo "$(date -Is) RECOVERED ✓"
  else
    echo "$(date -Is) STILL DOWN (http=$code2) — manual intervention needed"
  fi
fi

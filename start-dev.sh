#!/bin/bash
cd /home/mdwzrd/traderra
rm -rf .next
export NODE_OPTIONS="--max-old-space-size=4096"
exec npx next dev -p 6565 -H 0.0.0.0 --turbo

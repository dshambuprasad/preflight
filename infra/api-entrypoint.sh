#!/bin/sh
# migrations run inside the api on boot (main.ts); seed is idempotent and prints the demo password once.
set -e
if [ "${PREFLIGHT_SEED_ON_BOOT:-true}" = "true" ]; then
  node dist/src/seed.js || exit 1
fi
exec node dist/src/main.js

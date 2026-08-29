#!/bin/sh
set -e

API_PORT="${API_PORT:-3001}"
export API_PORT
export NODE_ENV=production

node api-dist/index.js &
exec caddy run --config Caddyfile --adapter caddyfile

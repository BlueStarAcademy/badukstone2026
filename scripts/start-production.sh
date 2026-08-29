#!/bin/sh
set -e

API_PORT="${API_PORT:-3001}"

if [ -z "$DATABASE_URL" ]; then
    echo "ERROR: DATABASE_URL is not set on this Railway service."
    echo "Fix: PostgreSQL 플러그인 → Connect → 프론트 서비스(badukstone2026)에 DATABASE_URL 연결"
    echo "Also set JWT_SECRET, MASTER_EMAIL, MASTER_PASSWORD on the same service."
    exit 1
fi

export API_PORT
export NODE_ENV=production

echo "Starting BadukStone API on 127.0.0.1:${API_PORT}..."
node api-dist/index.js &
API_PID=$!

ready=0
i=0
while [ "$i" -lt 45 ]; do
    if node -e "fetch('http://127.0.0.1:${API_PORT}/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))" 2>/dev/null; then
        ready=1
        break
    fi
    if ! kill -0 "$API_PID" 2>/dev/null; then
        echo "ERROR: API process exited during startup (check DATABASE_URL / JWT / migrations)."
        wait "$API_PID" || true
        exit 1
    fi
    i=$((i + 1))
    sleep 1
done

if [ "$ready" -ne 1 ]; then
    echo "ERROR: API did not become healthy within 45s."
    kill "$API_PID" 2>/dev/null || true
    exit 1
fi

echo "API is healthy. Starting Caddy on port ${PORT:-3000}..."
exec caddy run --config Caddyfile --adapter caddyfile

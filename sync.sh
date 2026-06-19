#!/bin/bash
# Sync game to GitHub + Vercel. Usage: ./sync.sh ["commit message"]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
NODE="${NODE_BIN:-/tmp/node-v22.16.0-darwin-x64/bin/node}"
export PATH="/tmp/node-v22.16.0-darwin-x64/bin:${PATH:-/usr/bin:/bin}"
exec "$NODE" "$ROOT/sync.js" "${1:-}"
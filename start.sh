#!/bin/bash
cd "$(dirname "$0")"
PORT=${1:-8765}
echo "🎮 Toon Blast running at http://localhost:$PORT"
echo "   Press Ctrl+C to stop"
ruby -run -e httpd . -p "$PORT"
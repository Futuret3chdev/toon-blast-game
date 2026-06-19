#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
GH="${GH_BIN:-$(cd "$(dirname "$0")" && pwd)/.tools/gh}"
NODE_BIN="${NODE_BIN:-/tmp/node-v22.16.0-darwin-x64/bin}"
REPO_NAME="${REPO_NAME:-toon-blast-game}"

export PATH="$NODE_BIN:$PATH"

cd "$ROOT"

if ! "$GH" auth status &>/dev/null; then
  echo "GitHub login required. Run:"
  echo "  $GH auth login"
  exit 1
fi

OWNER=$("$GH" api user -q .login)
echo "Deploying as $OWNER..."

if ! "$GH" repo view "$OWNER/$REPO_NAME" &>/dev/null; then
  "$GH" repo create "$REPO_NAME" --public --description "Toon Blast puzzle game — tap matching blocks to blast!" --source=. --remote=origin
fi

"$GH" repo sync "$OWNER/$REPO_NAME" 2>/dev/null || true

# Push via gh (works without system git in some cases)
if command -v git &>/dev/null && git --version &>/dev/null; then
  git init -b main 2>/dev/null || git init
  git branch -M main 2>/dev/null || true
  git add -A
  git commit -m "Initial commit: Toon Blast puzzle game" 2>/dev/null || true
  git remote remove origin 2>/dev/null || true
  git remote add origin "https://github.com/$OWNER/$REPO_NAME.git"
  "$GH" auth setup-git
  git push -u origin main --force
else
  echo "Using GitHub API to upload files (no git available)..."
  "$ROOT/upload-to-github.sh" "$OWNER" "$REPO_NAME"
fi

echo "Deploying to Vercel..."
npx vercel@latest --prod --yes

echo ""
echo "✅ Done!"
echo "   GitHub: https://github.com/$OWNER/$REPO_NAME"
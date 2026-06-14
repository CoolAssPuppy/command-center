#!/bin/bash
#
# Build the dashboard and embed it in the Safari extension's Resources/app.
# Run as an Xcode pre-build Run Script phase on the CommandCenterExtension
# target, so the new tab page is always rebuilt from source before it is copied
# into (and signed inside) the appex.
#
# Bridge selection follows the build configuration:
#   Release -> npm run build:extension        (native handler, real data)
#   else    -> npm run build:extension:demo   (mock fixtures; unsigned dev shows data)
set -euo pipefail

# Xcode build phases run with a minimal PATH. Add Homebrew and, if needed, nvm.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v node >/dev/null 2>&1 && [ -s "$HOME/.nvm/nvm.sh" ]; then
  export NVM_DIR="$HOME/.nvm"
  # shellcheck disable=SC1091
  . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1 || true
fi
if ! command -v node >/dev/null 2>&1; then
  echo "error: node not found on PATH. Install Node, or expose it to Xcode builds." >&2
  exit 1
fi

# SRCROOT is the native/ project dir under Xcode; fall back for manual runs.
SRCROOT="${SRCROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
DASHBOARD="$SRCROOT/../dashboard"

cd "$DASHBOARD"

# Install deps on a clean checkout; skip the cost when they are already present.
if [ ! -d node_modules ]; then
  npm ci
fi

if [ "${CONFIGURATION:-Debug}" = "Release" ]; then
  npm run build:extension
else
  npm run build:extension:demo
fi

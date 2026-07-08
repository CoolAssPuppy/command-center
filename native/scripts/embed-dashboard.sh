#!/usr/bin/env bash
# Build the dashboard as a Safari web-extension bundle and copy it into the
# appex's Resources. Runs as an Xcode build phase, so PATH is bare: normalize it
# for Homebrew and the common Node managers first. The Safari build
# (VITE_TARGET=safari) compiles in the native-messaging Google bridge and emits
# newtab.html + the Safari manifest.json.
#
# Safari reads manifest.json from the root of the appex's Contents/Resources, so
# the bundle is copied there directly (not into a subfolder). Outside Xcode the
# build settings are absent; the script still builds the bundle and just reports
# where it landed, which is handy for a quick standalone check.
set -euo pipefail

# Xcode gives a minimal PATH; add the usual locations for node/pnpm/corepack.
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.nvm/versions/node/current/bin:$HOME/Library/pnpm:$PATH"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DASHBOARD="$REPO_ROOT/dashboard"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "error: pnpm not found on PATH ($PATH)" >&2
  echo "Install pnpm (https://pnpm.io) or add it to PATH for the Xcode build." >&2
  exit 1
fi

cd "$DASHBOARD"

# A clean checkout has no node_modules; install once. --frozen-lockfile keeps the
# build reproducible against pnpm-lock.yaml.
if [ ! -d node_modules ]; then
  pnpm install --frozen-lockfile
fi

pnpm run build:safari

if [ -n "${TARGET_BUILD_DIR:-}" ] && [ -n "${UNLOCALIZED_RESOURCES_FOLDER_PATH:-}" ]; then
  DEST="$TARGET_BUILD_DIR/$UNLOCALIZED_RESOURCES_FOLDER_PATH"
  mkdir -p "$DEST"
  # Copy the bundle to the Resources root. The Safari build uses flat, stable
  # asset names, so a plain copy overwrites cleanly across builds.
  cp -R "$DASHBOARD/dist-extension/." "$DEST/"
  echo "Embedded the Safari dashboard bundle into $DEST"
else
  echo "Built the Safari bundle at $DASHBOARD/dist-extension (no Xcode build dir; not embedded)."
fi

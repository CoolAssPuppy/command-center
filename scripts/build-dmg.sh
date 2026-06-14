#!/bin/bash
#
# Build a distributable, notarized DMG for Command Center. No Sparkle: this is
# a plain Developer ID DMG for manual download, no auto-update signature.
#
# Prerequisites:
#   1. An Xcode Archive + Developer ID export of "CommandCenter.app" that is
#      already signed with Developer ID and notarized+stapled.
#   2. `brew install create-dmg`
#   3. A `notarytool` keychain profile stored via:
#        xcrun notarytool store-credentials <profile> --apple-id ... --team-id ... --password ...
#
# Optional: drop a 1320x800 background.tiff and a VolumeIcon.icns into
# dmg-assets/ to brand the DMG window. Without them a plain DMG is built.
#
# Usage:
#   ./scripts/build-dmg.sh <path-to-CommandCenter.app> <version> <notarytool-profile>
#
# Output:
#   dist/CommandCenter-<version>.dmg   (signed, notarized, stapled)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_PATH="${1:?Usage: $0 <path-to-CommandCenter.app> <version> <notarytool-profile>}"
VERSION="${2:?Usage: $0 <path-to-CommandCenter.app> <version> <notarytool-profile>}"
NOTARY_PROFILE="${3:?Usage: $0 <path-to-CommandCenter.app> <version> <notarytool-profile>}"

APP_NAME="CommandCenter"
SIGN_IDENTITY="${SIGN_IDENTITY:-Developer ID Application: Prashant Sridharan (955GSY56UT)}"

BACKGROUND="$REPO_ROOT/dmg-assets/background.tiff"
VOLUME_ICON="$REPO_ROOT/dmg-assets/VolumeIcon.icns"
DMG_OUT="$REPO_ROOT/dist/$APP_NAME-$VERSION.dmg"

if [[ ! -d "$APP_PATH" ]]; then
  echo "Error: App not found at $APP_PATH"
  exit 1
fi

if ! command -v create-dmg >/dev/null 2>&1; then
  echo "Error: create-dmg not installed. Run: brew install create-dmg"
  exit 1
fi

mkdir -p "$REPO_ROOT/dist"
rm -f "$DMG_OUT"

echo "Building DMG for $APP_NAME v$VERSION..."
echo "  App:    $APP_PATH"
echo "  Output: $DMG_OUT"
echo ""

# Window coords assume a 1320x800 (2x retina) background -> 660x400 window.
CREATE_DMG_ARGS=(
  --volname "$APP_NAME"
  --window-pos 200 120
  --window-size 660 400
  --icon-size 90
  --icon "$APP_NAME.app" 377 184
  --app-drop-link 595 184
  --hide-extension "$APP_NAME.app"
  --no-internet-enable
  --hdiutil-quiet
)
if [[ -f "$BACKGROUND" ]]; then
  CREATE_DMG_ARGS+=(--background "$BACKGROUND")
else
  echo "Note: $BACKGROUND missing — building an unbranded DMG window."
fi
if [[ -f "$VOLUME_ICON" ]]; then
  CREATE_DMG_ARGS+=(--volicon "$VOLUME_ICON")
fi

create-dmg "${CREATE_DMG_ARGS[@]}" "$DMG_OUT" "$APP_PATH"

echo ""
echo "DMG built: $DMG_OUT"
echo ""

echo "Codesigning DMG with: $SIGN_IDENTITY"
codesign --force --sign "$SIGN_IDENTITY" --timestamp "$DMG_OUT"

echo "Notarizing DMG (this can take several minutes)..."
xcrun notarytool submit "$DMG_OUT" --keychain-profile "$NOTARY_PROFILE" --wait

echo ""
echo "Stapling notarization ticket..."
xcrun stapler staple "$DMG_OUT"

echo ""
echo "Verifying notarization..."
xcrun stapler validate "$DMG_OUT"
spctl -a -t open --context context:primary-signature -v "$DMG_OUT"

echo ""
echo "============================================================"
echo "Release artifact for v$VERSION"
echo "============================================================"
echo "  DMG: $DMG_OUT"

#!/bin/bash
#
# One-shot release automation for Command Center. Mirrors the SyncBar release
# system, with Sparkle (auto-update) intentionally left out for now.
#
# Does:
#   1. Bumps MARKETING_VERSION + CURRENT_PROJECT_VERSION in native/project.yml
#   2. Regenerates the Xcode project with xcodegen
#   3. Archives + exports a Developer ID .app (the pre-build phase embeds the
#      dashboard with the native bridge for Release)
#   4. Notarizes + staples the .app
#   5. Builds a DMG, notarizes + staples it
#   6. Uploads the DMG (versioned + latest alias) to Cloudflare R2
#   7. Verifies the download is live
#
# Prerequisites:
#   - notarytool keychain profile (default "agent-server")
#   - create-dmg installed (brew install create-dmg)
#   - doppler CLI logged in with access to the command-center/prd config
#     (provides CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, R2_BUCKET_NAME,
#     R2_PUBLIC_BASE_URL)
#   - wrangler available (npm i -g wrangler) or npx on PATH
#   - python3 + xcodegen on PATH
#   - The App ID provisioned for App Groups and iCloud KVS (see the entitlements);
#     archive uses -allowProvisioningUpdates to register them.
#
# Usage:
#   ./scripts/release.sh <version>
#
# Example:
#   ./scripts/release.sh 0.2.0
set -euo pipefail

VERSION="${1:?Usage: $0 <version>}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NATIVE="$REPO_ROOT/native"
DIST="$REPO_ROOT/dist"
SCRIPTS="$REPO_ROOT/scripts"

NOTARY_PROFILE="${NOTARY_PROFILE:-agent-server}"

APP_NAME="CommandCenter"
APP_FOLDER="commandcenter"

DOPPLER_PROJECT="${DOPPLER_PROJECT:-command-center}"
DOPPLER_CONFIG="${DOPPLER_CONFIG:-prd}"
export DOPPLER_PROJECT DOPPLER_CONFIG

if command -v wrangler >/dev/null 2>&1; then
  WRANGLER=(wrangler)
else
  WRANGLER=(npx --yes wrangler)
fi

if command -v xcbeautify >/dev/null 2>&1; then
  PRETTY=(xcbeautify --quiet)
else
  PRETTY=(cat)
fi

#----------------------------------------------------------------------
# Preflight
#----------------------------------------------------------------------
for tool in xcodebuild xcodegen create-dmg doppler python3; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "Error: required tool not found: $tool"
    exit 1
  fi
done

if ! "${WRANGLER[@]}" --version >/dev/null 2>&1; then
  echo "Error: wrangler not available. Install with: npm i -g wrangler"
  exit 1
fi

if ! xcrun notarytool history --keychain-profile "$NOTARY_PROFILE" >/dev/null 2>&1; then
  echo "Error: notarytool profile '$NOTARY_PROFILE' not found or invalid."
  echo "Run: xcrun notarytool store-credentials \"$NOTARY_PROFILE\" --apple-id ... --team-id ... --password ..."
  exit 1
fi

mkdir -p "$DIST"

#----------------------------------------------------------------------
# 1. Bump version in native/project.yml
#----------------------------------------------------------------------
echo "==> Bumping version to $VERSION"
CURRENT_BUILD=$(awk -F'"' '/CURRENT_PROJECT_VERSION:/ {print $2}' "$NATIVE/project.yml")
NEW_BUILD=$((CURRENT_BUILD + 1))
python3 - <<PY
import re, pathlib
p = pathlib.Path("$NATIVE/project.yml")
text = p.read_text()
text = re.sub(r'MARKETING_VERSION: "[^"]+"', 'MARKETING_VERSION: "$VERSION"', text)
text = re.sub(r'CURRENT_PROJECT_VERSION: "[^"]+"', 'CURRENT_PROJECT_VERSION: "$NEW_BUILD"', text)
p.write_text(text)
PY
echo "  MARKETING_VERSION=$VERSION CURRENT_PROJECT_VERSION=$NEW_BUILD"

#----------------------------------------------------------------------
# 2. Regenerate project
#----------------------------------------------------------------------
echo "==> Regenerating Xcode project"
(cd "$NATIVE" && xcodegen generate)

#----------------------------------------------------------------------
# 3. Archive
#----------------------------------------------------------------------
ARCHIVE="$DIST/$APP_NAME-$VERSION.xcarchive"
rm -rf "$ARCHIVE"
echo "==> Archiving"
xcodebuild -project "$NATIVE/$APP_NAME.xcodeproj" \
  -scheme "$APP_NAME" \
  -configuration Release \
  -archivePath "$ARCHIVE" \
  -allowProvisioningUpdates \
  archive | "${PRETTY[@]}"

#----------------------------------------------------------------------
# 4. Export Developer ID .app
#----------------------------------------------------------------------
EXPORT_DIR="$DIST/export-$VERSION"
rm -rf "$EXPORT_DIR"
echo "==> Exporting .app"
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE" \
  -exportPath "$EXPORT_DIR" \
  -exportOptionsPlist "$SCRIPTS/export-options.plist" \
  -allowProvisioningUpdates >/dev/null

APP_PATH="$EXPORT_DIR/$APP_NAME.app"
if [ ! -d "$APP_PATH" ]; then
  echo "Error: export did not produce $APP_PATH"
  exit 1
fi

#----------------------------------------------------------------------
# 5. Notarize + staple the .app
#----------------------------------------------------------------------
echo "==> Notarizing .app (takes a few minutes)"
APP_ZIP="$EXPORT_DIR/$APP_NAME.app.zip"
ditto -c -k --sequesterRsrc --keepParent "$APP_PATH" "$APP_ZIP"
xcrun notarytool submit "$APP_ZIP" --keychain-profile "$NOTARY_PROFILE" --wait
rm -f "$APP_ZIP"

echo "==> Stapling .app"
xcrun stapler staple "$APP_PATH"
xcrun stapler validate "$APP_PATH"

#----------------------------------------------------------------------
# 6. DMG + notarize + staple
#----------------------------------------------------------------------
echo "==> Building DMG"
"$SCRIPTS/build-dmg.sh" "$APP_PATH" "$VERSION" "$NOTARY_PROFILE"

DMG="$DIST/$APP_NAME-$VERSION.dmg"
if [ ! -f "$DMG" ]; then
  echo "Error: DMG missing after build-dmg.sh"
  exit 1
fi

#----------------------------------------------------------------------
# 7. Fetch Cloudflare R2 credentials from Doppler
#----------------------------------------------------------------------
echo "==> Fetching Cloudflare R2 credentials from Doppler ($DOPPLER_PROJECT/$DOPPLER_CONFIG)"
export CLOUDFLARE_API_TOKEN
CLOUDFLARE_API_TOKEN=$(doppler secrets get CLOUDFLARE_API_TOKEN \
  --project "$DOPPLER_PROJECT" --config "$DOPPLER_CONFIG" --plain 2>/dev/null || true)
export CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_ACCOUNT_ID=$(doppler secrets get CLOUDFLARE_ACCOUNT_ID \
  --project "$DOPPLER_PROJECT" --config "$DOPPLER_CONFIG" --plain 2>/dev/null || true)
R2_BUCKET=$(doppler secrets get R2_BUCKET_NAME \
  --project "$DOPPLER_PROJECT" --config "$DOPPLER_CONFIG" --plain 2>/dev/null || echo "strategic-nerds-downloads")
R2_PUBLIC_BASE=$(doppler secrets get R2_PUBLIC_BASE_URL \
  --project "$DOPPLER_PROJECT" --config "$DOPPLER_CONFIG" --plain 2>/dev/null || echo "https://downloads.strategicnerds.com")

if [ -z "$CLOUDFLARE_API_TOKEN" ] || [ -z "$CLOUDFLARE_ACCOUNT_ID" ]; then
  echo "Error: missing CLOUDFLARE_API_TOKEN or CLOUDFLARE_ACCOUNT_ID in Doppler $DOPPLER_PROJECT/$DOPPLER_CONFIG"
  exit 1
fi

#----------------------------------------------------------------------
# 8. Upload DMG to R2 (versioned + stable latest alias)
#----------------------------------------------------------------------
DMG_NAME="$APP_NAME-$VERSION.dmg"
R2_DMG_KEY="apps/$APP_FOLDER/$DMG_NAME"
echo "==> Uploading $DMG_NAME to R2 ($R2_BUCKET/$R2_DMG_KEY)"
"${WRANGLER[@]}" r2 object put "$R2_BUCKET/$R2_DMG_KEY" \
  --file="$DMG" \
  --content-type="application/x-apple-diskimage" \
  --remote

R2_LATEST_KEY="apps/$APP_FOLDER/$APP_NAME-latest.dmg"
echo "==> Uploading latest.dmg alias to R2 ($R2_BUCKET/$R2_LATEST_KEY)"
"${WRANGLER[@]}" r2 object put "$R2_BUCKET/$R2_LATEST_KEY" \
  --file="$DMG" \
  --content-type="application/x-apple-diskimage" \
  --remote

ENCLOSURE_URL="$R2_PUBLIC_BASE/apps/$APP_FOLDER/$DMG_NAME"
LATEST_URL="$R2_PUBLIC_BASE/apps/$APP_FOLDER/$APP_NAME-latest.dmg"

#----------------------------------------------------------------------
# 9. Verify
#----------------------------------------------------------------------
echo ""
echo "==> Verifying uploaded DMG"
curl -sI "$ENCLOSURE_URL" | grep -iE '^(HTTP|content-length)'

#----------------------------------------------------------------------
# 10. Prune build intermediates from dist/
#----------------------------------------------------------------------
echo "==> Pruning build intermediates from dist/"
rm -rf "$ARCHIVE" "$EXPORT_DIR"
find "$DIST" -maxdepth 1 -type d \( -name "*.xcarchive" -o -name "export-*" \) -exec rm -rf {} + 2>/dev/null || true

echo ""
echo "============================================================"
echo "Released $APP_NAME $VERSION (build $NEW_BUILD)"
echo ""
echo "Local artifact:"
echo "  $DMG"
echo ""
echo "Live:"
echo "  $ENCLOSURE_URL"
echo "  $LATEST_URL"
echo ""
echo "Don't forget to commit: native/project.yml"
echo "============================================================"

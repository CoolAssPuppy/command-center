#!/usr/bin/env bash
# One-shot Safari release: version bump -> archive -> export -> notarize ->
# DMG -> Sparkle sign -> upload to R2 -> appcast. Runs locally on the maintainer's
# Mac because it needs the login-keychain Developer ID cert and the Sparkle
# private key. Mirrors the agent-server pipeline.
#
#   scripts/release.sh <version> "<release notes HTML>"
#   e.g. scripts/release.sh 0.4.0 "<li>Safari support.</li><li>Google via the app.</li>"
set -euo pipefail

VERSION="${1:?usage: release.sh <version> \"<release notes HTML>\"}"
NOTES="${2:?missing release notes HTML}"

SCRIPTS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPTS/.." && pwd)"
NATIVE="$REPO_ROOT/native"
DIST="$REPO_ROOT/dist"
PROJECT_YML="$NATIVE/project.yml"
APPCAST="$DIST/appcast.xml"

NOTARY_PROFILE="${NOTARY_PROFILE:-command-center}"
DOPPLER_PROJECT="${DOPPLER_PROJECT:-command-center}"
DOPPLER_CONFIG="${DOPPLER_CONFIG:-prd}"

# Pull the Doppler secrets up front, before anything derived from them is computed.
# R2_PUBLIC_BASE_URL in particular ends up baked into the appcast enclosure URL, so
# reading it after the fact silently publishes an appcast pointing at the wrong host.
# set -a exports them into wrangler's (child) environment; `doppler secrets download
# --format env` emits KEY="val" lines without `export`.
if command -v doppler >/dev/null 2>&1 && [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  set -a
  eval "$(doppler secrets download --no-file --format env \
    --project "$DOPPLER_PROJECT" --config "$DOPPLER_CONFIG" 2>/dev/null || true)"
  set +a
fi

R2_BUCKET="${R2_BUCKET_NAME:-strategic-nerds-downloads}"
# The r2.dev public URL is the live host. downloads.strategicnerds.com does not
# resolve, so it must never be a fallback: a dead enclosure URL breaks auto-update.
R2_PUBLIC_BASE="${R2_PUBLIC_BASE_URL:-https://pub-9c8d72fe664b4ce18aac0d718b4e0346.r2.dev}"
R2_PREFIX="apps/command-center"

mkdir -p "$DIST"

echo "==> Preflight"
for tool in xcodegen xcodebuild create-dmg python3; do
  command -v "$tool" >/dev/null 2>&1 || { echo "missing tool: $tool" >&2; exit 1; }
done

echo "==> Bumping version to $VERSION"
CURRENT_BUILD="$(awk -F'"' '/CURRENT_PROJECT_VERSION:/ {print $2}' "$PROJECT_YML")"
NEXT_BUILD=$(( ${CURRENT_BUILD:-0} + 1 ))
python3 - "$PROJECT_YML" "$VERSION" "$NEXT_BUILD" <<'PY'
import re, sys
path, version, build = sys.argv[1], sys.argv[2], sys.argv[3]
text = open(path).read()
text = re.sub(r'(MARKETING_VERSION:\s*)"[^"]*"', rf'\g<1>"{version}"', text)
text = re.sub(r'(CURRENT_PROJECT_VERSION:\s*)"[^"]*"', rf'\g<1>"{build}"', text)
open(path, "w").write(text)
PY

echo "==> Generating the Xcode project"
( cd "$NATIVE" && xcodegen generate )

ARCHIVE="$DIST/CommandCenter-$VERSION.xcarchive"
EXPORT_DIR="$DIST/export-$VERSION"
APP_PATH="$EXPORT_DIR/Command Center.app"

echo "==> Archiving"
xcodebuild -project "$NATIVE/CommandCenter.xcodeproj" \
  -scheme CommandCenter -configuration Release \
  -archivePath "$ARCHIVE" archive

echo "==> Exporting Developer ID app"
rm -rf "$EXPORT_DIR"
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE" \
  -exportPath "$EXPORT_DIR" \
  -exportOptionsPlist "$SCRIPTS/export-options.plist"

echo "==> Notarizing and stapling the .app"
# The Apple app-specific password is shared across the fleet, so pull it from
# Doppler unless notary creds are already supplied. Exported so build-dmg.sh
# reuses the same auth for the DMG.
NOTARY_APPLE_ID="${NOTARY_APPLE_ID:-prashant_sridharan@hotmail.com}"
NOTARY_TEAM_ID="${NOTARY_TEAM_ID:-955GSY56UT}"
if [ -z "${NOTARY_PASSWORD:-}" ] && command -v doppler >/dev/null 2>&1; then
  NOTARY_PASSWORD="$(doppler secrets get SPARKLE_APP_SPECIFIC_PASSWORD \
    --project "$DOPPLER_PROJECT" --config "$DOPPLER_CONFIG" --plain 2>/dev/null || true)"
fi
if [ -n "${NOTARY_PASSWORD:-}" ]; then
  NOTARY_AUTH=(--apple-id "$NOTARY_APPLE_ID" --team-id "$NOTARY_TEAM_ID" --password "$NOTARY_PASSWORD")
  export NOTARY_APPLE_ID NOTARY_TEAM_ID NOTARY_PASSWORD
else
  NOTARY_AUTH=(--keychain-profile "$NOTARY_PROFILE")
fi
APP_ZIP="$EXPORT_DIR/CommandCenter.app.zip"
ditto -c -k --sequesterRsrc --keepParent "$APP_PATH" "$APP_ZIP"
xcrun notarytool submit "$APP_ZIP" "${NOTARY_AUTH[@]}" --wait
rm -f "$APP_ZIP"
xcrun stapler staple "$APP_PATH"
xcrun stapler validate "$APP_PATH"

echo "==> Building the DMG"
"$SCRIPTS/build-dmg.sh" "$APP_PATH" "$VERSION" "$NOTARY_PROFILE"

DMG="$DIST/CommandCenter-$VERSION.dmg"
SPARKLE_TXT="$DIST/CommandCenter-$VERSION.sparkle.txt"

echo "==> Unregistering build copies from LaunchServices"
# Each copy the build produces (the archive, the export, the DMG's mounted volume)
# registers itself with LaunchServices. Safari enumerates registered app bundles,
# so every leftover shows up as another "Command Center" extension in its settings.
# Drop everything that is not the installed app.
LSREGISTER="/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"
if [ -x "$LSREGISTER" ]; then
  "$LSREGISTER" -dump 2>/dev/null \
    | grep -E '^[[:space:]]*path:.*Command Center\.app \(0x' \
    | sed -E 's/^[[:space:]]*path:[[:space:]]*(.*\.app) \(0x[0-9a-f]+\)$/\1/' \
    | sort -u \
    | grep -vFx "/Applications/Command Center.app" \
    | while IFS= read -r stray; do
        "$LSREGISTER" -u "$stray" 2>/dev/null && echo "  unregistered $stray"
      done
fi

echo "==> Uploading to R2"
# Prefer inline creds (e.g. exported from Doppler); fall back to `doppler run`.
run_wrangler() {
  if command -v wrangler >/dev/null 2>&1; then wrangler "$@"; else pnpm dlx wrangler "$@"; fi
}
upload() { # <local> <key>
  run_wrangler r2 object put "$R2_BUCKET/$2" --file="$1" \
    --content-type="application/x-apple-diskimage" --remote
}
upload "$DMG" "$R2_PREFIX/CommandCenter-$VERSION.dmg"
upload "$DMG" "$R2_PREFIX/CommandCenter-latest.dmg"

echo "==> Updating the appcast"
# sign_update wrote one line: sparkle:edSignature="..." length="<bytes>". That
# carries both the signature and the file length, so the enclosure needs nothing
# more than the URL, type, and this line.
ED_SIGNATURE_LINE="$(cat "$SPARKLE_TXT")"
DMG_URL="$R2_PUBLIC_BASE/$R2_PREFIX/CommandCenter-$VERSION.dmg"
python3 - "$APPCAST" "$VERSION" "$NEXT_BUILD" "$DMG_URL" "$ED_SIGNATURE_LINE" "$NOTES" <<'PY'
import sys
from email.utils import formatdate
appcast, version, build, url, ed_line, notes = sys.argv[1:7]
item = f'''    <item>
      <title>{version}</title>
      <pubDate>{formatdate(localtime=False)}</pubDate>
      <sparkle:version>{build}</sparkle:version>
      <sparkle:shortVersionString>{version}</sparkle:shortVersionString>
      <sparkle:minimumSystemVersion>14.0</sparkle:minimumSystemVersion>
      <description><![CDATA[{notes}]]></description>
      <enclosure url="{url}" type="application/x-apple-diskimage" {ed_line.strip()}/>
    </item>'''
marker = "<!-- INSERT NEW ITEM ABOVE -->"
xml = open(appcast).read().replace(marker, item + "\n    " + marker)
open(appcast, "w").write(xml)
PY

run_wrangler r2 object put "$R2_BUCKET/$R2_PREFIX/appcast.xml" --file="$APPCAST" \
  --content-type="application/xml" --remote

echo "==> Verifying"
curl -sI "$R2_PUBLIC_BASE/$R2_PREFIX/CommandCenter-$VERSION.dmg" | head -1
curl -sI "$R2_PUBLIC_BASE/$R2_PREFIX/appcast.xml" | head -1

echo "==> Released $VERSION. Commit native/project.yml and dist/appcast.xml."

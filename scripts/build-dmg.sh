#!/usr/bin/env bash
# Package a notarized, Sparkle-signed DMG from an already-exported .app.
#
#   scripts/build-dmg.sh <app-path> <version> [notary-keychain-profile]
#
# Steps, in order (each is load-bearing for Gatekeeper or Sparkle):
#   1. create-dmg  -> a styled disk image containing the app + /Applications link
#   2. codesign    -> Developer ID sign the DMG itself (Gatekeeper checks it)
#   3. notarytool  -> submit and wait for Apple notarization
#   4. stapler     -> attach the notarization ticket so it verifies offline
#   5. spctl       -> assert Gatekeeper will actually open it
#   6. sign_update -> Sparkle Ed25519 signature (edSignature + length) for the appcast
#
# Notary auth: inline NOTARY_APPLE_ID / NOTARY_TEAM_ID / NOTARY_PASSWORD (e.g.
# from Doppler) is preferred; otherwise a stored --keychain-profile is used.
set -euo pipefail

APP_PATH="${1:?usage: build-dmg.sh <app-path> <version> [notary-profile]}"
VERSION="${2:?missing version}"
NOTARY_PROFILE="${3:-command-center}"

SCRIPTS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPTS/.." && pwd)"
DIST="$REPO_ROOT/dist"
DMG_OUT="$DIST/CommandCenter-$VERSION.dmg"

SIGN_IDENTITY="${SIGN_IDENTITY:-Developer ID Application: Prashant Sridharan (955GSY56UT)}"
SIGN_UPDATE="${SPARKLE_SIGN_UPDATE:-$HOME/bin/sparkle/sign_update}"
# Sparkle signing key lives in Doppler (per the sibling apps). The private key is
# pulled at sign time and written to a short-lived file; it is never stored.
DOPPLER_PROJECT="${DOPPLER_PROJECT:-command-center}"
DOPPLER_CONFIG="${DOPPLER_CONFIG:-prd}"
# Multi-resolution installer backdrop (660x400 @1x + 1320x800 @2x). Regenerate
# from the Paper export with native/dmg-assets/make-background.sh.
BACKGROUND="${DMG_BACKGROUND:-$REPO_ROOT/native/dmg-assets/background.tiff}"

[ -f "$BACKGROUND" ] || { echo "missing DMG background: $BACKGROUND (run native/dmg-assets/make-background.sh)" >&2; exit 1; }

mkdir -p "$DIST"
rm -f "$DMG_OUT"

if [ -n "${NOTARY_PASSWORD:-}" ]; then
  NOTARY_AUTH=(--apple-id "${NOTARY_APPLE_ID:?set NOTARY_APPLE_ID with NOTARY_PASSWORD}" \
               --team-id "${NOTARY_TEAM_ID:?set NOTARY_TEAM_ID with NOTARY_PASSWORD}" \
               --password "$NOTARY_PASSWORD")
else
  NOTARY_AUTH=(--keychain-profile "$NOTARY_PROFILE")
fi

echo "==> Creating DMG"
create-dmg \
  --volname "Command Center" \
  --background "$BACKGROUND" \
  --window-pos 200 120 \
  --window-size 660 400 \
  --icon-size 96 \
  --icon "Command Center.app" 355 200 \
  --app-drop-link 555 200 \
  --hide-extension "Command Center.app" \
  --no-internet-enable \
  --hdiutil-quiet \
  "$DMG_OUT" \
  "$APP_PATH"

echo "==> Signing the DMG with Developer ID"
codesign --force --sign "$SIGN_IDENTITY" --timestamp "$DMG_OUT"

echo "==> Notarizing (this waits for Apple)"
xcrun notarytool submit "$DMG_OUT" "${NOTARY_AUTH[@]}" --wait

echo "==> Stapling and verifying"
xcrun stapler staple "$DMG_OUT"
xcrun stapler validate "$DMG_OUT"
spctl -a -t open --context context:primary-signature -v "$DMG_OUT"

echo "==> Sparkle signing (key from Doppler $DOPPLER_PROJECT/$DOPPLER_CONFIG)"
SPARKLE_OUT="${DMG_OUT%.dmg}.sparkle.txt"
# Prefer an already-exported key; otherwise pull it from Doppler. Either way it
# goes into a 0600 temp file that is removed on exit, so the key is never left on
# disk.
SPARKLE_PRIVATE_KEY="${SPARKLE_PRIVATE_KEY:-$(doppler secrets get SPARKLE_PRIVATE_KEY --project "$DOPPLER_PROJECT" --config "$DOPPLER_CONFIG" --plain)}"
[ -n "$SPARKLE_PRIVATE_KEY" ] || { echo "no SPARKLE_PRIVATE_KEY (Doppler $DOPPLER_PROJECT/$DOPPLER_CONFIG or env)" >&2; exit 1; }
SPARKLE_KEY_FILE="$(mktemp)"
chmod 600 "$SPARKLE_KEY_FILE"
trap 'rm -f "$SPARKLE_KEY_FILE"' EXIT
printf '%s' "$SPARKLE_PRIVATE_KEY" > "$SPARKLE_KEY_FILE"
"$SIGN_UPDATE" --ed-key-file "$SPARKLE_KEY_FILE" "$DMG_OUT" | tee "$SPARKLE_OUT"
rm -f "$SPARKLE_KEY_FILE"
trap - EXIT

echo "==> Done: $DMG_OUT"

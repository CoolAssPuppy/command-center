#!/usr/bin/env bash
# Build the multi-resolution DMG background TIFF from the master PNG.
#
# background.png is the 2640x1600 master exported from the Paper source
# ("Command Center — DMG Installer" artboard). The DMG window is 660x400, so
# Finder needs a @1x page (660x400) for non-Retina displays and a @2x page
# (1320x800) for Retina. tiffutil packs both into one background.tiff, and
# build-dmg.sh points --background at it.
#
# Re-run this whenever background.png is re-exported from Paper.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MASTER="$HERE/background.png"
ONE_X="$HERE/background-1x.png"
TWO_X="$HERE/background-2x.png"
TIFF="$HERE/background.tiff"

[ -f "$MASTER" ] || { echo "missing $MASTER (export it from Paper first)" >&2; exit 1; }

sips --resampleHeightWidth 400 660 "$MASTER" --out "$ONE_X" >/dev/null
sips --resampleHeightWidth 800 1320 "$MASTER" --out "$TWO_X" >/dev/null
tiffutil -cathidpicheck "$ONE_X" "$TWO_X" -out "$TIFF" >/dev/null
rm -f "$ONE_X" "$TWO_X"

echo "Wrote $TIFF (660x400 @1x + 1320x800 @2x)."

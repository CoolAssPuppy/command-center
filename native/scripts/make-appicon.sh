#!/usr/bin/env bash
# Generate the macOS AppIcon set from the 1024x1024 master.
#
# icon_1024.png is the master, exported from the "Icon 2 — Day & Night" artboard
# in the Paper file (the official app icon). This resamples it to every size the
# macOS app icon slot needs and writes the asset-catalog Contents.json. Xcode
# compiles the set into the app via ASSETCATALOG_COMPILER_APPICON_NAME=AppIcon.
#
# Re-run this whenever icon_1024.png is re-exported.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SET="$HERE/../CommandCenter/Assets.xcassets/AppIcon.appiconset"
MASTER="$SET/icon_1024.png"

[ -f "$MASTER" ] || { echo "missing $MASTER (export the icon from Paper first)" >&2; exit 1; }

for size in 16 32 64 128 256 512; do
  sips --resampleHeightWidth "$size" "$size" "$MASTER" --out "$SET/icon_$size.png" >/dev/null
done

cat > "$SET/Contents.json" <<'JSON'
{
  "images" : [
    { "size" : "16x16",   "idiom" : "mac", "filename" : "icon_16.png",   "scale" : "1x" },
    { "size" : "16x16",   "idiom" : "mac", "filename" : "icon_32.png",   "scale" : "2x" },
    { "size" : "32x32",   "idiom" : "mac", "filename" : "icon_32.png",   "scale" : "1x" },
    { "size" : "32x32",   "idiom" : "mac", "filename" : "icon_64.png",   "scale" : "2x" },
    { "size" : "128x128", "idiom" : "mac", "filename" : "icon_128.png",  "scale" : "1x" },
    { "size" : "128x128", "idiom" : "mac", "filename" : "icon_256.png",  "scale" : "2x" },
    { "size" : "256x256", "idiom" : "mac", "filename" : "icon_256.png",  "scale" : "1x" },
    { "size" : "256x256", "idiom" : "mac", "filename" : "icon_512.png",  "scale" : "2x" },
    { "size" : "512x512", "idiom" : "mac", "filename" : "icon_512.png",  "scale" : "1x" },
    { "size" : "512x512", "idiom" : "mac", "filename" : "icon_1024.png", "scale" : "2x" }
  ],
  "info" : { "version" : 1, "author" : "xcode" }
}
JSON

echo "Wrote AppIcon set (16-1024) and Contents.json in $SET."

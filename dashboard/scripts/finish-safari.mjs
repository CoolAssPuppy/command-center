// Finish the Safari web-extension bundle after the Vite extension build.
//
// The Vite build (run with VITE_TARGET=safari, so the native-messaging Google
// bridge is compiled in and chrome.identity is compiled out) emits
// dist-extension/index.html plus flat assets and copies public/ verbatim, which
// includes the Chrome manifest. This step makes that directory a valid Safari
// extension: it renames the HTML entry to the newtab override target and rewrites
// manifest.json through toSafariManifest (drops the Chrome key and identity
// permission, adds nativeMessaging). The result is ready for the Xcode appex to
// copy into its Resources. Run via "npm run build:safari".
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { toSafariManifest } from "./safariManifest.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, "..", "dist-extension");
const indexHtml = join(dist, "index.html");
const newtab = join(dist, "newtab.html");
const manifestPath = join(dist, "manifest.json");

if (!existsSync(indexHtml)) {
  console.error("No dist-extension/index.html. Run the Vite extension build first.");
  process.exit(1);
}
if (!existsSync(manifestPath)) {
  console.error("No dist-extension/manifest.json. Is public/manifest.json present?");
  process.exit(1);
}

renameSync(indexHtml, newtab);

const chromeManifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const safariManifest = toSafariManifest(chromeManifest);
writeFileSync(manifestPath, `${JSON.stringify(safariManifest, null, 2)}\n`);

console.log("Assembled the Safari web-extension bundle in dist-extension/ (newtab.html + Safari manifest.json).");

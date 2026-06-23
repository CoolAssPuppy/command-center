// Finish the unpacked Chrome MV3 extension after the Vite extension build.
// Vite emits dist-extension/index.html plus flat js/css assets, and copies
// public/ (manifest.json, the city images) verbatim. Chrome's new tab override
// points at newtab.html, so the only step left is renaming the HTML entry.
// After this runs, dist-extension/ is loadable via chrome://extensions ->
// "Load unpacked". Run via "npm run build:extension".
import { existsSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, "..", "dist-extension");
const indexHtml = join(dist, "index.html");
const newtab = join(dist, "newtab.html");

if (!existsSync(indexHtml)) {
  console.error("No dist-extension/index.html. Run the Vite extension build first.");
  process.exit(1);
}
if (!existsSync(join(dist, "manifest.json"))) {
  console.error("No dist-extension/manifest.json. Is public/manifest.json present?");
  process.exit(1);
}

renameSync(indexHtml, newtab);
console.log("Assembled the unpacked Chrome extension in dist-extension/ (newtab.html + manifest.json).");

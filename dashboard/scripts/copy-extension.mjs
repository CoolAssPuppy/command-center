// Copy the built dashboard bundle (dist-extension) into the Safari web
// extension's Resources, so the appex ships the new tab page. index.html
// becomes newtab.html (the manifest's newtab override); the flat js/css assets
// sit beside it. The hand-authored manifest.json and background.js are kept.
// Run via "npm run build:extension" / "build:extension:demo".
import {
  copyFileSync,
  existsSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dashboard = join(here, "..");
const dist = join(dashboard, "dist-extension");
const resources = join(
  dashboard,
  "..",
  "native",
  "CommandCenterExtension",
  "Resources",
);

// Files in Resources that are hand-authored and must survive the sync.
const KEEP = new Set(["manifest.json", "background.js"]);

if (!existsSync(dist)) {
  console.error('No dist-extension. Run the extension vite build first.');
  process.exit(1);
}

// Remove previously generated resources (everything except the kept files).
for (const name of readdirSync(resources)) {
  if (!KEEP.has(name)) {
    rmSync(join(resources, name), { recursive: true, force: true });
  }
}

// Copy the built bundle. The extension build emits a flat directory, so a
// shallow copy is enough and keeps newtab.html / index.js at the Resources root.
for (const name of readdirSync(dist)) {
  const from = join(dist, name);
  const to = name === "index.html" ? join(resources, "newtab.html") : join(resources, name);
  copyFileSync(from, to);
}

console.log("Copied the dashboard bundle into the Safari extension Resources.");

// Copy the built dashboard bundle (dist-extension) into the Safari web
// extension's Resources/app directory, so the appex ships the new tab page.
// index.html becomes app/newtab.html (the manifest's newtab override) and the
// flat js/css assets sit beside it. The app/ directory is a folder reference in
// the Xcode project, so whatever is here at build time is bundled and signed,
// which is why an Xcode pre-build phase regenerates it on every native build.
// The hand-authored manifest.json and background.js live one level up and are
// untouched. Run via "npm run build:extension" / "build:extension:demo".
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dashboard = join(here, "..");
const dist = join(dashboard, "dist-extension");
const appDir = join(
  dashboard,
  "..",
  "native",
  "CommandCenterExtension",
  "Resources",
  "app",
);

// .gitkeep keeps the folder-referenced directory present on a clean checkout.
const KEEP = new Set([".gitkeep"]);

if (!existsSync(dist)) {
  console.error("No dist-extension. Run the extension vite build first.");
  process.exit(1);
}

mkdirSync(appDir, { recursive: true });

// Clear previously generated files, then copy the fresh bundle in.
for (const name of readdirSync(appDir)) {
  if (!KEEP.has(name)) rmSync(join(appDir, name), { recursive: true, force: true });
}

// The extension build emits a flat directory, so a shallow copy is enough and
// keeps newtab.html / index.js together in app/.
for (const name of readdirSync(dist)) {
  const from = join(dist, name);
  const to = name === "index.html" ? join(appDir, "newtab.html") : join(appDir, name);
  copyFileSync(from, to);
}

console.log("Embedded the dashboard bundle in the Safari extension (Resources/app).");

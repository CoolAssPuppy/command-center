// Build the Chrome Web Store upload zip from dist-extension.
//
// The store rejects a manifest that contains a "key" field, but local unpacked
// development needs it to keep a stable extension id (the one the Google OAuth
// redirect is registered against). So dist-extension keeps the key for dev, and
// this step copies it to dist-store, strips the key there, and zips that. The
// dev build is left untouched. Run via "npm run package".
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const dist = join(root, "dist-extension");
const store = join(root, "dist-store");
const zip = join(root, "command-center.zip");

if (!existsSync(join(dist, "manifest.json"))) {
  console.error("No dist-extension. Run build:extension first.");
  process.exit(1);
}

// Fresh copy, fresh zip, so a stale key can never linger in either.
rmSync(store, { recursive: true, force: true });
rmSync(zip, { force: true });
cpSync(dist, store, { recursive: true });

const manifestPath = join(store, "manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
delete manifest.key;
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

execFileSync("zip", ["-r", "-FS", "../command-center.zip", ".", "-x", ".DS_Store"], {
  cwd: store,
  stdio: "inherit",
});
rmSync(store, { recursive: true, force: true });

console.log("Wrote command-center.zip for the Chrome Web Store (no key field).");

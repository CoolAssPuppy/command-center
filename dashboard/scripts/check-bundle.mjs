// Enforce the gzipped JS bundle budget after a build. Keep BUDGET_BYTES in sync
// with BUNDLE_GZIP_BUDGET_BYTES in src/perf/perf.ts. A new tab page must stay
// small so it paints instantly. Run: npm run build && npm run size
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const ASSETS_DIR = "dist/assets";
const BUDGET_BYTES = 90 * 1024;

let files;
try {
  files = readdirSync(ASSETS_DIR).filter((name) => name.endsWith(".js"));
} catch {
  console.error(`No ${ASSETS_DIR}. Run "npm run build" first.`);
  process.exit(1);
}

let total = 0;
for (const name of files) {
  const gz = gzipSync(readFileSync(join(ASSETS_DIR, name))).length;
  total += gz;
  console.log(`  ${name}: ${(gz / 1024).toFixed(1)} KB gzipped`);
}

const budgetKb = (BUDGET_BYTES / 1024).toFixed(0);
console.log(`Total: ${(total / 1024).toFixed(1)} KB gzipped (budget ${budgetKb} KB)`);

if (total > BUDGET_BYTES) {
  console.error("Bundle exceeds the budget.");
  process.exit(1);
}
console.log("Within budget.");

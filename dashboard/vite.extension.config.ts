import { defineConfig } from "vite";

/**
 * Build config for the dashboard bundle that ships inside the Safari web
 * extension. It differs from the default build in three ways the extension
 * needs: a relative base (extension pages load from the extension origin, not
 * "/"), flat unhashed asset names (the appex Resources stay a flat directory,
 * so no subfolder structure can be lost when Xcode copies them), and no source
 * maps. Output goes to dist-extension so the gated default build (dist) is
 * untouched. Bridge selection is by the VITE_BRIDGE env var, read in main.ts:
 * unset auto-detects the native handler; "mock" forces the demo fixtures for an
 * unsigned visual test in Safari before signing wires up the App Group.
 */
export default defineConfig({
  base: "./",
  build: {
    target: "es2022",
    outDir: "dist-extension",
    sourcemap: false,
    rollupOptions: {
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "[name].js",
        assetFileNames: "[name][extname]",
      },
    },
  },
});

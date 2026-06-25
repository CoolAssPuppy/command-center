import { defineConfig } from "vitest/config";

export default defineConfig({
  server: {
    // Bind IPv4 loopback explicitly. Left to its default, Vite resolves
    // "localhost" to ::1 (IPv6) only, and Chrome reaches localhost over IPv4
    // 127.0.0.1, gets connection-refused, and the new tab never loads.
    host: "127.0.0.1",
    // Notion and Linear reject browser calls from a localhost origin (CORS).
    // Route them server-side in dev so the data path works without packaging
    // the extension. See src/integrations/devProxy.ts. Production never uses it.
    proxy: {
      "/__cc-proxy/notion": {
        target: "https://api.notion.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/__cc-proxy\/notion/, ""),
      },
      "/__cc-proxy/linear": {
        target: "https://api.linear.app",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/__cc-proxy\/linear/, ""),
      },
      "/__cc-proxy/github": {
        target: "https://api.github.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/__cc-proxy\/github/, ""),
      },
      "/__cc-proxy/finnhub": {
        target: "https://finnhub.io",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/__cc-proxy\/finnhub/, ""),
      },
      "/__cc-proxy/hackernews": {
        target: "https://hacker-news.firebaseio.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/__cc-proxy\/hackernews/, ""),
      },
      "/__cc-proxy/google": {
        target: "https://www.googleapis.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/__cc-proxy\/google/, ""),
      },
      "/__cc-proxy/unsplash": {
        target: "https://api.unsplash.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/__cc-proxy\/unsplash/, ""),
      },
    },
  },
  build: {
    target: "es2022",
    sourcemap: true,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/test/**"],
    },
  },
});

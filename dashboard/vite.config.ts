import { defineConfig } from "vitest/config";

export default defineConfig({
  server: {
    // Bind IPv4 loopback explicitly. Left to its default, Vite resolves
    // "localhost" to ::1 (IPv6) only, and Chrome reaches localhost over IPv4
    // 127.0.0.1, gets connection-refused, and the new tab never loads.
    host: "127.0.0.1",
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

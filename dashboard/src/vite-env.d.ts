/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Which data bridge the build uses. Unset (default) auto-detects: the native
   * handler inside the Safari extension, the mock fixtures in a plain browser.
   * "mock" forces the fixtures even inside the extension, for an unsigned demo.
   */
  readonly VITE_BRIDGE?: "mock";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

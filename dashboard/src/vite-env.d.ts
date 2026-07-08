/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Which data bridge the build uses. Unset (default) auto-detects: the native
   * handler inside the Safari extension, the mock fixtures in a plain browser.
   * "mock" forces the fixtures even inside the extension, for an unsigned demo.
   */
  readonly VITE_BRIDGE?: "mock";
  /**
   * Which browser the extension bundle targets. Unset means Chrome, whose
   * Google sign-in uses chrome.identity. "safari" enables the native-messaging
   * bridge to the container app (Safari has no chrome.identity). Chrome and
   * Safari both expose runtime.sendNativeMessage, so this build-time flag, not a
   * runtime check, decides which path compiles in; the other is tree-shaken out.
   */
  readonly VITE_TARGET?: "safari";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

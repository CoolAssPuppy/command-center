import type { DashboardBridge } from "./types";

/**
 * The slice of the WebExtension runtime the dashboard needs: a single native
 * message round trip to the app extension's SafariWebExtensionHandler.
 */
export interface NativeMessenger {
  sendNativeMessage(message: unknown): Promise<unknown>;
}

interface RuntimeHost {
  runtime?: Partial<NativeMessenger>;
}

interface ExtensionScope {
  browser?: RuntimeHost;
  chrome?: RuntimeHost;
}

/**
 * Resolve the extension runtime when the page runs inside the Safari (or
 * Chromium) web extension, else undefined (plain-browser local dev). The scope
 * is injectable so this is testable without a real extension global.
 */
export function getExtensionRuntime(
  scope: ExtensionScope = globalThis as unknown as ExtensionScope,
): NativeMessenger | undefined {
  const runtime = scope.browser?.runtime ?? scope.chrome?.runtime;
  if (runtime !== undefined && typeof runtime.sendNativeMessage === "function") {
    return runtime as NativeMessenger;
  }
  return undefined;
}

/**
 * Bridge that asks the native handler for the composed dashboard payload. The
 * handler validates and returns display data only, so this layer never sees a
 * token. The result is unknown and validated downstream before use.
 */
export function createNativeBridge(runtime: NativeMessenger): DashboardBridge {
  return {
    getDashboard: () => runtime.sendNativeMessage({ type: "getDashboard" }),
  };
}

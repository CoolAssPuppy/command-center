import { GoogleTokenSchema, type GoogleToken } from "../config/schema";
import type { GoogleAuthProvider } from "../integrations/googleAuth";
import type { AuthorizeOptions } from "../integrations/googleOAuth";

/**
 * The Safari bridge to the extension's native container app. Safari has no
 * chrome.identity, so Google sign-in runs in the signed macOS app that hosts the
 * extension: the app owns an OAuth client, keeps the refresh token in the
 * Keychain, and hands back only a short-lived access token. The dashboard reaches
 * it with one native-messaging round trip. No token, refresh token, or client
 * secret ever lives in the browser.
 *
 * This whole module compiles into the Safari build only. VITE_TARGET is replaced
 * with a literal at build time, so Chrome tree-shakes it away and never confuses
 * its own chrome.runtime.sendNativeMessage (a Native Messaging host API) for the
 * Safari in-process handler.
 */

/** One native round trip to the container app's SafariWebExtensionHandler. */
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
 * The message the extension sends to run Google sign-in. `interactive` shows the
 * account chooser and consent; a silent request (interactive false, pinned to
 * `loginHint`) renews an expired token with no UI. This shape is the contract the
 * Swift handler switches on; keep it in step with SafariWebExtensionHandler.swift.
 */
interface AuthorizeMessage {
  type: "google-authorize";
  interactive: boolean;
  loginHint?: string;
}

/**
 * Resolve the WebExtension runtime when the page runs inside the Safari (or
 * Chromium) extension, else undefined (plain-browser dev). The scope is
 * injectable so this is testable without a real extension global.
 */
export function getExtensionRuntime(
  scope: ExtensionScope = globalThis as unknown as ExtensionScope,
): NativeMessenger | undefined {
  const runtime = scope.browser?.runtime ?? scope.chrome?.runtime;
  return runtime !== undefined && typeof runtime.sendNativeMessage === "function"
    ? (runtime as NativeMessenger)
    : undefined;
}

/**
 * Validate a native authorize response into a token, or undefined on any
 * failure. The app is a separate process whose reply is untrusted input, so the
 * token is parsed against the real schema before it is ever used, exactly as a
 * network response would be.
 */
export function parseAuthorizeResponse(response: unknown): GoogleToken | undefined {
  if (typeof response !== "object" || response === null) return undefined;
  const record = response as { ok?: unknown; token?: unknown };
  if (record.ok !== true) return undefined;
  const parsed = GoogleTokenSchema.safeParse(record.token);
  return parsed.success ? parsed.data : undefined;
}

/**
 * Send the authorize message and return the resulting token, or undefined if the
 * flow did not complete. A rejected message (app not running, handler threw) is a
 * failed sign-in, handled the same as an explicit ok:false: the caller falls back
 * to an interactive connect or shows the account as needing auth.
 */
export async function authorizeViaNative(
  messenger: NativeMessenger,
  options: AuthorizeOptions,
): Promise<GoogleToken | undefined> {
  const message: AuthorizeMessage = {
    type: "google-authorize",
    interactive: options.interactive,
    ...(options.loginHint !== undefined && options.loginHint.length > 0
      ? { loginHint: options.loginHint }
      : {}),
  };
  try {
    return parseAuthorizeResponse(await messenger.sendNativeMessage(message));
  } catch {
    return undefined;
  }
}

/**
 * Safari's GoogleAuthProvider. Available only in the Safari build and only when
 * the container app's native-messaging runtime is present; otherwise sign-in
 * reports itself off and the connection row shows a hint.
 */
export const nativeGoogleAuth: GoogleAuthProvider = {
  isAvailable(): boolean {
    return import.meta.env.VITE_TARGET === "safari" && getExtensionRuntime() !== undefined;
  },
  authorize(options: AuthorizeOptions): Promise<GoogleToken | undefined> {
    const messenger = getExtensionRuntime();
    return messenger !== undefined
      ? authorizeViaNative(messenger, options)
      : Promise.resolve(undefined);
  },
};

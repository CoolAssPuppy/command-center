import type { GoogleToken } from "../config/schema";
import { nativeGoogleAuth } from "../bridge/native";
import { chromeIdentityGoogleAuth, type AuthorizeOptions } from "./googleOAuth";

/**
 * How the dashboard obtains Google tokens, abstracted over the host browser.
 * Chrome signs in with chrome.identity; Safari has no such API and instead asks
 * its native container app over native messaging. Both yield the same
 * short-lived GoogleToken, so everything downstream (token refresh, the connect
 * button, the calendar and tasks integrations) is identical across browsers.
 */
export interface GoogleAuthProvider {
  /** True when sign-in can run here: the host API exists and is configured. */
  isAvailable(): boolean;
  /**
   * Run the OAuth flow and resolve to a token, or undefined if it did not
   * complete (declined, unconfigured, or a silent refresh that needs consent).
   */
  authorize(options: AuthorizeOptions): Promise<GoogleToken | undefined>;
}

/**
 * The provider for the current host. Safari is preferred when its native bridge
 * is present, because inside a Safari extension chrome.identity is absent; Chrome
 * is used otherwise. When neither is available (plain-browser dev, or a Safari
 * build whose container app is not reachable), sign-in reports itself off and the
 * connection row shows a hint instead of a connect button.
 */
export function selectGoogleAuthProvider(): GoogleAuthProvider {
  if (nativeGoogleAuth.isAvailable()) return nativeGoogleAuth;
  return chromeIdentityGoogleAuth;
}

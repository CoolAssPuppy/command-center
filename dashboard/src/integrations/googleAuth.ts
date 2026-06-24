/**
 * Google OAuth with no server, via chrome.identity. getGoogleToken returns a
 * cached/refreshed token without a prompt (used for background loads);
 * connectGoogle prompts for consent the first time. Both resolve to undefined
 * outside the extension (dev, tests) or when the user hasn't connected, which
 * the calendar integration reports as needs_auth. The manifest's oauth2 block
 * (client_id + scopes) must be filled in for this to work; see the README.
 */
interface AuthTokenResult {
  token?: string;
}

interface ChromeIdentity {
  getAuthToken(details: {
    interactive: boolean;
  }): Promise<AuthTokenResult | string | undefined>;
}

interface ChromeLike {
  identity?: ChromeIdentity;
}

function getChromeIdentity(): ChromeIdentity | undefined {
  const chrome = (globalThis as { chrome?: ChromeLike }).chrome;
  const identity = chrome?.identity;
  return identity !== undefined && typeof identity.getAuthToken === "function"
    ? identity
    : undefined;
}

async function fetchToken(interactive: boolean): Promise<string | undefined> {
  const identity = getChromeIdentity();
  if (identity === undefined) return undefined;
  try {
    const result = await identity.getAuthToken({ interactive });
    if (typeof result === "string") return result;
    return result?.token;
  } catch (cause) {
    // Surface the real reason; a swallowed error here looks like "nothing
    // happened". Common: a bad client id (extension ID does not match the
    // OAuth client's Item ID), or no Google account signed into Chrome.
    if (interactive) {
      const message = cause instanceof Error ? cause.message : String(cause);
      console.warn(`Google sign-in failed: ${message}`);
    }
    return undefined;
  }
}

/** Whether chrome.identity exists, i.e. we are in the installed extension. */
export function isGoogleAuthAvailable(): boolean {
  return getChromeIdentity() !== undefined;
}

/** A token without prompting; undefined if the user hasn't connected yet. */
export function getGoogleToken(): Promise<string | undefined> {
  return fetchToken(false);
}

/** Prompt for consent; resolves to a token once the user approves. */
export function connectGoogle(): Promise<string | undefined> {
  return fetchToken(true);
}

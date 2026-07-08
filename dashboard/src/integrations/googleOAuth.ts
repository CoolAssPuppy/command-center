import type { GoogleToken } from "../config/schema";
import { GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_SCOPES } from "./googleOAuthConfig";

/**
 * Multi-account Google sign-in with no server, via chrome.identity. Unlike
 * getAuthToken (one token for the Chrome profile's account), launchWebAuthFlow
 * opens Google's account chooser, so each calendar connection can authorize a
 * different account. The implicit flow returns a short-lived access token in the
 * redirect fragment; there is no refresh token, so an expired token is renewed
 * by a silent re-auth (interactive: false) hinted at the same account. Resolves
 * to undefined outside the extension, when unconfigured, or when sign-in fails.
 */
const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v3/userinfo";

interface ChromeIdentityWeb {
  launchWebAuthFlow(details: {
    url: string;
    interactive: boolean;
  }): Promise<string | undefined>;
  getRedirectURL(path?: string): string;
}

interface ChromeLike {
  identity?: Partial<ChromeIdentityWeb>;
}

function getIdentity(): ChromeIdentityWeb | undefined {
  const identity = (globalThis as { chrome?: ChromeLike }).chrome?.identity;
  return identity !== undefined &&
    typeof identity.launchWebAuthFlow === "function" &&
    typeof identity.getRedirectURL === "function"
    ? (identity as ChromeIdentityWeb)
    : undefined;
}

/** True when sign-in can run: in the extension and a client id is configured. */
export function isGoogleOAuthAvailable(): boolean {
  return getIdentity() !== undefined && GOOGLE_OAUTH_CLIENT_ID.length > 0;
}

/** A random opaque value to tie the auth request to its redirect (CSRF guard). */
function randomState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function buildAuthUrl(
  redirectUri: string,
  interactive: boolean,
  state: string,
  loginHint?: string,
): string {
  const url = new URL(AUTH_ENDPOINT);
  url.searchParams.set("client_id", GOOGLE_OAUTH_CLIENT_ID);
  url.searchParams.set("response_type", "token");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", GOOGLE_OAUTH_SCOPES.join(" "));
  url.searchParams.set("state", state);
  // Interactive: let the user pick an account and grant consent. Silent: no UI,
  // pinned to the known account, so an expired token renews without a prompt.
  url.searchParams.set("prompt", interactive ? "select_account consent" : "none");
  if (loginHint !== undefined && loginHint.length > 0) {
    url.searchParams.set("login_hint", loginHint);
  }
  return url.toString();
}

/** Parse access_token, expires_in, and state from the redirect URL's fragment. */
function parseFragment(
  responseUrl: string,
): { accessToken: string; expiresInSec: number; state: string | null } | undefined {
  const hash = responseUrl.includes("#") ? responseUrl.slice(responseUrl.indexOf("#") + 1) : "";
  const params = new URLSearchParams(hash);
  const accessToken = params.get("access_token");
  if (accessToken === null || accessToken.length === 0) return undefined;
  const expiresInSec = Number(params.get("expires_in") ?? "3600");
  return {
    accessToken,
    expiresInSec: Number.isFinite(expiresInSec) ? expiresInSec : 3600,
    state: params.get("state"),
  };
}

async function fetchEmail(accessToken: string): Promise<string | undefined> {
  try {
    const response = await fetch(USERINFO_ENDPOINT, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return undefined;
    const body = (await response.json()) as { email?: unknown };
    return typeof body.email === "string" ? body.email : undefined;
  } catch {
    return undefined;
  }
}

export interface AuthorizeOptions {
  interactive: boolean;
  /** The account to reuse on a silent refresh, so it renews the right token. */
  loginHint?: string;
}

/**
 * Run the OAuth flow and return a token record, or undefined if it did not
 * complete. The email is looked up once (it labels the connection and hints the
 * silent refresh); when a refresh already knows the account, the caller passes
 * loginHint and can keep the prior email if this lookup is skipped.
 */
export async function authorizeGoogleAccount(
  options: AuthorizeOptions,
): Promise<GoogleToken | undefined> {
  const identity = getIdentity();
  if (identity === undefined || GOOGLE_OAUTH_CLIENT_ID.length === 0) return undefined;

  const redirectUri = identity.getRedirectURL();
  const state = randomState();
  const url = buildAuthUrl(redirectUri, options.interactive, state, options.loginHint);

  let responseUrl: string | undefined;
  try {
    responseUrl = await identity.launchWebAuthFlow({ url, interactive: options.interactive });
  } catch {
    // A silent attempt throws when consent or account selection is required;
    // that is expected and the caller falls back to an interactive connect.
    return undefined;
  }
  if (responseUrl === undefined) return undefined;

  const parsed = parseFragment(responseUrl);
  if (parsed === undefined) return undefined;
  // Reject a redirect that does not echo our state, so a forged callback cannot
  // inject a token.
  if (parsed.state !== state) return undefined;

  const token: GoogleToken = {
    accessToken: parsed.accessToken,
    expiresAt: Date.now() + parsed.expiresInSec * 1000,
  };
  const email = await fetchEmail(parsed.accessToken);
  if (email !== undefined) token.email = email;
  else if (options.loginHint !== undefined) token.email = options.loginHint;
  return token;
}

/**
 * The Chrome sign-in path as a GoogleAuthProvider. It is a thin binding over the
 * two functions above so run.ts can select a provider without knowing which host
 * it is on. Safari supplies its own provider from the native bridge instead.
 */
export const chromeIdentityGoogleAuth = {
  isAvailable: isGoogleOAuthAvailable,
  authorize: authorizeGoogleAccount,
};

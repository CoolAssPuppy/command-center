import type { Connection, GoogleToken, Secrets } from "../config/schema";
import type { AuthorizeOptions } from "./googleOAuth";

/**
 * Resolve a usable Google access token for each Google Calendar connection. A
 * token still comfortably in date is used as-is; an expired or missing one is
 * renewed by a silent re-auth pinned to its account. This is pure with respect
 * to its inputs: it never mutates the secrets it is handed, and never persists.
 * The caller decides whether and how to save the returned secrets.
 */
export interface GoogleTokenResolution {
  /** A usable access token per connection id, or undefined (reported as needs_auth). */
  tokens: Record<string, string | undefined>;
  /** Secrets with any renewals applied; the same object when nothing changed. */
  secrets: Secrets;
  /** Whether any token was renewed, so the caller knows to persist. */
  changed: boolean;
}

/** Grace period: a token within a minute of expiry is treated as expired. */
const EXPIRY_GRACE_MS = 60_000;

export async function resolveGoogleTokens(
  connections: readonly Connection[],
  secrets: Secrets,
  nowMs: number,
  authorize: (options: AuthorizeOptions) => Promise<GoogleToken | undefined>,
): Promise<GoogleTokenResolution> {
  const tokens: Record<string, string | undefined> = {};
  const googleTokens = { ...secrets.googleTokens };
  let changed = false;

  // Each connection's refresh is independent, so resolve them concurrently.
  await Promise.all(
    connections
      .filter((connection) => connection.service === "google-calendar")
      .map(async (connection) => {
        const stored = googleTokens[connection.id];
        if (stored !== undefined && stored.expiresAt - nowMs > EXPIRY_GRACE_MS) {
          tokens[connection.id] = stored.accessToken;
          return;
        }
        const refreshed = await authorize({
          interactive: false,
          ...(stored?.email !== undefined ? { loginHint: stored.email } : {}),
        });
        if (refreshed !== undefined) {
          const email = refreshed.email ?? stored?.email;
          const merged: GoogleToken = {
            accessToken: refreshed.accessToken,
            expiresAt: refreshed.expiresAt,
            ...(email !== undefined ? { email } : {}),
          };
          googleTokens[connection.id] = merged;
          tokens[connection.id] = merged.accessToken;
          changed = true;
        } else {
          tokens[connection.id] =
            stored !== undefined && stored.expiresAt > nowMs ? stored.accessToken : undefined;
        }
      }),
  );

  return { tokens, secrets: changed ? { ...secrets, googleTokens } : secrets, changed };
}

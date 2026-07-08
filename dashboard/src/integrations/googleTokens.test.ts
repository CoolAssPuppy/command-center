import { describe, expect, it, vi } from "vitest";

import type { Connection, GoogleToken, Secrets } from "../config/schema";
import { resolveGoogleTokens } from "./googleTokens";

const NOW = 1_000_000;
const calendar = (id: string): Connection => ({ id, name: id, service: "google-calendar" });

const secretsWith = (googleTokens: Record<string, GoogleToken>): Secrets => ({
  connectionSecrets: {},
  googleTokens,
});

describe("resolveGoogleTokens", () => {
  it("uses a token that is still comfortably in date without re-authing", async () => {
    const authorize = vi.fn();
    const secrets = secretsWith({
      c1: { accessToken: "tok", expiresAt: NOW + 10 * 60_000, email: "a@b.co" },
    });
    const result = await resolveGoogleTokens([calendar("c1")], secrets, NOW, authorize);
    expect(result.tokens).toEqual({ c1: "tok" });
    expect(result.changed).toBe(false);
    expect(authorize).not.toHaveBeenCalled();
    expect(result.secrets).toBe(secrets);
  });

  it("renews an expired token and returns new secrets without mutating the input", async () => {
    const authorize = vi.fn().mockResolvedValue({ accessToken: "fresh", expiresAt: NOW + 3_600_000 });
    const stored = { accessToken: "stale", expiresAt: NOW - 1, email: "a@b.co" };
    const secrets = secretsWith({ c1: stored });
    const result = await resolveGoogleTokens([calendar("c1")], secrets, NOW, authorize);
    expect(result.tokens).toEqual({ c1: "fresh" });
    expect(result.changed).toBe(true);
    // The refresh is pinned to the known account.
    expect(authorize).toHaveBeenCalledWith({ interactive: false, loginHint: "a@b.co" });
    // Input untouched; the renewed token carries the prior email.
    expect(secrets.googleTokens.c1).toBe(stored);
    expect(result.secrets.googleTokens.c1).toMatchObject({ accessToken: "fresh", email: "a@b.co" });
  });

  it("maps to undefined when a token cannot be obtained", async () => {
    const authorize = vi.fn().mockResolvedValue(undefined);
    const secrets = secretsWith({});
    const result = await resolveGoogleTokens([calendar("c1")], secrets, NOW, authorize);
    expect(result.tokens).toEqual({ c1: undefined });
    expect(result.changed).toBe(false);
  });

  it("ignores connections that are not Google Calendar", async () => {
    const authorize = vi.fn();
    const secrets = secretsWith({});
    const result = await resolveGoogleTokens(
      [{ id: "n1", name: "Notion", service: "notion" }],
      secrets,
      NOW,
      authorize,
    );
    expect(result.tokens).toEqual({});
    expect(authorize).not.toHaveBeenCalled();
  });
});

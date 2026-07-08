import { afterEach, describe, expect, it, vi } from "vitest";

import type { GoogleToken } from "../config/schema";
import {
  authorizeViaNative,
  getExtensionRuntime,
  nativeGoogleAuth,
  parseAuthorizeResponse,
  type NativeMessenger,
} from "./native";

const validToken: GoogleToken = {
  accessToken: "ya29.token",
  expiresAt: 1_720_003_600_000,
  email: "a@b.co",
};

const okResponse = (token: GoogleToken = validToken): { ok: true; token: GoogleToken } => ({
  ok: true,
  token,
});

describe("native Google auth bridge", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("runtime detection", () => {
    it("finds the runtime under either the browser or chrome global", () => {
      const runtime: NativeMessenger = { sendNativeMessage: () => Promise.resolve(null) };
      expect(getExtensionRuntime({ browser: { runtime } })).toBe(runtime);
      expect(getExtensionRuntime({ chrome: { runtime } })).toBe(runtime);
    });

    it("returns undefined outside the extension or without native messaging", () => {
      expect(getExtensionRuntime({})).toBeUndefined();
      expect(getExtensionRuntime({ browser: {} })).toBeUndefined();
      expect(getExtensionRuntime({ browser: { runtime: {} } })).toBeUndefined();
    });
  });

  describe("authorize", () => {
    it("sends the interactive contract and returns the validated token", async () => {
      const sendNativeMessage = vi.fn().mockResolvedValue(okResponse());

      const token = await authorizeViaNative({ sendNativeMessage }, { interactive: true });

      expect(sendNativeMessage).toHaveBeenCalledWith({
        type: "google-authorize",
        interactive: true,
      });
      expect(token).toEqual(validToken);
    });

    it("pins a silent refresh to the account via loginHint", async () => {
      const sendNativeMessage = vi.fn().mockResolvedValue(okResponse());

      await authorizeViaNative(
        { sendNativeMessage },
        { interactive: false, loginHint: "a@b.co" },
      );

      expect(sendNativeMessage).toHaveBeenCalledWith({
        type: "google-authorize",
        interactive: false,
        loginHint: "a@b.co",
      });
    });

    it("omits an empty loginHint rather than sending a blank account", async () => {
      const sendNativeMessage = vi.fn().mockResolvedValue(okResponse());

      await authorizeViaNative({ sendNativeMessage }, { interactive: false, loginHint: "" });

      expect(sendNativeMessage).toHaveBeenCalledWith({
        type: "google-authorize",
        interactive: false,
      });
    });

    it("treats a rejected native message as a failed sign-in", async () => {
      const sendNativeMessage = vi.fn().mockRejectedValue(new Error("app not running"));

      const token = await authorizeViaNative({ sendNativeMessage }, { interactive: true });

      expect(token).toBeUndefined();
    });
  });

  describe("response validation", () => {
    it("accepts a well-formed success payload", () => {
      expect(parseAuthorizeResponse(okResponse())).toEqual(validToken);
    });

    it("rejects an explicit failure", () => {
      expect(parseAuthorizeResponse({ ok: false, error: "consent_required" })).toBeUndefined();
    });

    it("rejects a malformed or hostile payload", () => {
      expect(parseAuthorizeResponse(undefined)).toBeUndefined();
      expect(parseAuthorizeResponse(null)).toBeUndefined();
      expect(parseAuthorizeResponse("token")).toBeUndefined();
      // ok:true but the token is not a real GoogleToken.
      expect(parseAuthorizeResponse({ ok: true, token: { accessToken: 42 } })).toBeUndefined();
      expect(parseAuthorizeResponse({ ok: true })).toBeUndefined();
    });
  });

  describe("provider availability", () => {
    it("is off unless the build targets Safari, even if a runtime exists", () => {
      const runtime: NativeMessenger = { sendNativeMessage: () => Promise.resolve(null) };
      const scope = globalThis as { browser?: { runtime: NativeMessenger } };
      scope.browser = { runtime };
      try {
        vi.stubEnv("VITE_TARGET", "");
        expect(nativeGoogleAuth.isAvailable()).toBe(false);

        vi.stubEnv("VITE_TARGET", "safari");
        expect(nativeGoogleAuth.isAvailable()).toBe(true);
      } finally {
        delete scope.browser;
      }
    });

    it("is off in a Safari build with no reachable container app", () => {
      vi.stubEnv("VITE_TARGET", "safari");
      expect(nativeGoogleAuth.isAvailable()).toBe(false);
    });
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

import { nativeGoogleAuth } from "../bridge/native";
import { selectGoogleAuthProvider } from "./googleAuth";
import { chromeIdentityGoogleAuth } from "./googleOAuth";

interface RuntimeScope {
  browser?: { runtime: { sendNativeMessage: () => Promise<unknown> } };
}

describe("selectGoogleAuthProvider", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    delete (globalThis as RuntimeScope).browser;
  });

  it("uses the native bridge inside a Safari build with a reachable app", () => {
    vi.stubEnv("VITE_TARGET", "safari");
    (globalThis as RuntimeScope).browser = {
      runtime: { sendNativeMessage: () => Promise.resolve(null) },
    };
    expect(selectGoogleAuthProvider()).toBe(nativeGoogleAuth);
  });

  it("falls back to chrome.identity when the native bridge is unavailable", () => {
    // A Chrome build: VITE_TARGET unset, so the native provider reports itself off.
    expect(selectGoogleAuthProvider()).toBe(chromeIdentityGoogleAuth);
  });
});

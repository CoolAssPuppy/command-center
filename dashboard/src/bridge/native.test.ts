import { describe, expect, it, vi } from "vitest";

import { createNativeBridge, getExtensionRuntime } from "./native";

describe("native bridge", () => {
  it("asks the native handler for the dashboard payload", async () => {
    const payload = { providers: [] };
    const sendNativeMessage = vi.fn().mockResolvedValue(payload);

    const result = await createNativeBridge({ sendNativeMessage }).getDashboard();

    // The handler switches on this exact message shape; it is the contract.
    expect(sendNativeMessage).toHaveBeenCalledWith({ type: "getDashboard" });
    expect(result).toBe(payload);
  });

  it("detects the extension runtime under either browser or chrome global", () => {
    const runtime = { sendNativeMessage: () => Promise.resolve(null) };

    expect(getExtensionRuntime({ browser: { runtime } })).toBe(runtime);
    expect(getExtensionRuntime({ chrome: { runtime } })).toBe(runtime);
  });

  it("returns undefined outside the extension or without native messaging", () => {
    expect(getExtensionRuntime({})).toBeUndefined();
    expect(getExtensionRuntime({ browser: {} })).toBeUndefined();
    expect(getExtensionRuntime({ browser: { runtime: {} } })).toBeUndefined();
  });
});

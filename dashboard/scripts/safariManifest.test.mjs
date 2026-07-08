import { describe, expect, it } from "vitest";

import { toSafariManifest } from "./safariManifest.mjs";

const chromeManifest = () => ({
  manifest_version: 3,
  key: "MIIBIjANBgkq...",
  name: "Command Center",
  chrome_url_overrides: { newtab: "newtab.html" },
  permissions: ["storage", "identity"],
  host_permissions: ["https://api.open-meteo.com/*"],
  content_security_policy: { extension_pages: "default-src 'self'" },
});

describe("toSafariManifest", () => {
  it("drops the Chrome-only key that Safari rejects", () => {
    expect(toSafariManifest(chromeManifest())).not.toHaveProperty("key");
  });

  it("removes the identity permission and grants nativeMessaging", () => {
    const { permissions } = toSafariManifest(chromeManifest());
    expect(permissions).toContain("storage");
    expect(permissions).toContain("nativeMessaging");
    expect(permissions).not.toContain("identity");
  });

  it("does not duplicate nativeMessaging if it is already present", () => {
    const manifest = { ...chromeManifest(), permissions: ["storage", "nativeMessaging"] };
    const { permissions } = toSafariManifest(manifest);
    expect(permissions.filter((p) => p === "nativeMessaging")).toHaveLength(1);
  });

  it("carries the shared fields through unchanged", () => {
    const safari = toSafariManifest(chromeManifest());
    expect(safari.manifest_version).toBe(3);
    expect(safari.chrome_url_overrides).toEqual({ newtab: "newtab.html" });
    expect(safari.host_permissions).toEqual(["https://api.open-meteo.com/*"]);
    expect(safari.content_security_policy).toEqual({ extension_pages: "default-src 'self'" });
  });

  it("does not mutate the input manifest", () => {
    const input = chromeManifest();
    toSafariManifest(input);
    expect(input.permissions).toEqual(["storage", "identity"]);
    expect(input).toHaveProperty("key");
  });

  it("tolerates a manifest with no permissions array", () => {
    const { permissions } = toSafariManifest({ manifest_version: 3, name: "X" });
    expect(permissions).toEqual(["nativeMessaging"]);
  });
});

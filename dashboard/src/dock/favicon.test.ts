import { describe, expect, it } from "vitest";

import { fallbackGlyph, faviconUrl } from "./favicon";

describe("faviconUrl", () => {
  it("prefers an explicit icon url", () => {
    expect(faviconUrl({ url: "https://x.com", iconUrl: "https://cdn/i.png" })).toBe(
      "https://cdn/i.png",
    );
  });

  it("builds a Google s2 url from the host", () => {
    const url = faviconUrl({ url: "https://github.com/foo" });
    expect(url).toContain("https://www.google.com/s2/favicons");
    expect(url).toContain("domain=github.com");
    expect(url).toContain("sz=64");
  });

  it("returns empty for an unparseable url", () => {
    expect(faviconUrl({ url: "not a url" })).toBe("");
  });
});

describe("fallbackGlyph", () => {
  it("returns the first letter uppercased", () => {
    expect(fallbackGlyph("github")).toBe("G");
  });

  it("falls back to ? when empty", () => {
    expect(fallbackGlyph("   ")).toBe("?");
  });
});

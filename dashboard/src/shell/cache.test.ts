import { afterEach, describe, expect, it } from "vitest";

import { clearCachedPayload, loadCachedPayload, saveCachedPayload } from "./cache";

afterEach(() => {
  clearCachedPayload();
});

describe("dashboard cache", () => {
  it("round-trips a saved payload", () => {
    saveCachedPayload({ providers: [], generatedAt: "2026-06-14T15:00:00Z" });

    expect(loadCachedPayload()).toEqual({
      providers: [],
      generatedAt: "2026-06-14T15:00:00Z",
    });
  });

  it("returns null when nothing is cached", () => {
    expect(loadCachedPayload()).toBeNull();
  });

  it("returns null rather than throwing on corrupt cache", () => {
    localStorage.setItem("cc.dashboard.cache.v1", "{not json");

    expect(loadCachedPayload()).toBeNull();
  });
});

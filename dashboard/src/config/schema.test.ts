import { describe, expect, it } from "vitest";

import {
  ConfigSchema,
  homeZone,
  otherZones,
  parseConfig,
  parseSecrets,
  type Config,
} from "./schema";

const baseConfig = (overrides?: Partial<Config>): Config =>
  ConfigSchema.parse({
    zones: [
      { id: "home", label: "Home", timeZone: "America/New_York", isHome: true },
      { id: "lisbon", label: "Lisbon", timeZone: "Europe/Lisbon" },
    ],
    ...overrides,
  });

describe("config parsing", () => {
  it("fills sensible defaults for an empty object", () => {
    const config = parseConfig({});
    expect(config.version).toBe(1);
    expect(config.zones).toEqual([]);
    expect(config.wallpaper.source).toBe("gradient");
    expect(config.appearance.hour12).toBe(true);
  });

  it("recovers to defaults when given non-config garbage", () => {
    expect(parseConfig("not a config").zones).toEqual([]);
    expect(parseConfig(42).links).toEqual([]);
  });

  it("rejects a dock link with an invalid url", () => {
    const result = ConfigSchema.safeParse({
      links: [{ id: "x", title: "Bad", url: "notaurl" }],
    });
    expect(result.success).toBe(false);
  });

  it("parses each stream content variant", () => {
    const config = parseConfig({
      streams: [
        { id: "a", title: "Notes", content: { type: "static", body: "hi" } },
        { id: "b", title: "Pins", content: { type: "links", linkIds: ["x"] } },
        {
          id: "c",
          title: "Notion",
          content: { type: "integration", integrationId: "notion", config: {} },
        },
      ],
    });
    expect(config.streams).toHaveLength(3);
    expect(config.streams[1]?.content.type).toBe("links");
  });

  it("defaults a stream to collapsed", () => {
    const config = parseConfig({
      streams: [{ id: "a", title: "Notes", content: { type: "static", body: "" } }],
    });
    expect(config.streams[0]?.collapsedByDefault).toBe(true);
  });
});

describe("zone selectors", () => {
  it("returns the flagged home zone", () => {
    expect(homeZone(baseConfig())?.id).toBe("home");
  });

  it("falls back to the first zone when none is flagged", () => {
    const config = baseConfig({
      zones: [
        { id: "first", label: "First", timeZone: "UTC" },
        { id: "second", label: "Second", timeZone: "Europe/Lisbon" },
      ],
    });
    expect(homeZone(config)?.id).toBe("first");
  });

  it("excludes the home zone from the others", () => {
    expect(otherZones(baseConfig()).map((z) => z.id)).toEqual(["lisbon"]);
  });
});

describe("secrets parsing", () => {
  it("returns an empty object for missing secrets", () => {
    expect(parseSecrets(undefined)).toEqual({});
  });

  it("keeps known secret fields", () => {
    expect(parseSecrets({ notionToken: "tok", extra: 1 })).toEqual({
      notionToken: "tok",
    });
  });
});

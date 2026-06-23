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

  it("parses connections and a stream that references one", () => {
    const config = parseConfig({
      connections: [
        { id: "c1", name: "Work Calendar", service: "google-calendar" },
        { id: "c2", name: "Roadmap", service: "notion", databaseId: "db1" },
      ],
      streams: [{ id: "s1", title: "Today", connectionId: "c1" }],
    });
    expect(config.connections).toHaveLength(2);
    expect(config.connections[1]?.service).toBe("notion");
    expect(config.streams[0]?.connectionId).toBe("c1");
  });

  it("rejects a connection with an unknown service", () => {
    const result = ConfigSchema.safeParse({
      connections: [{ id: "c1", name: "X", service: "slack" }],
    });
    expect(result.success).toBe(false);
  });

  it("defaults a stream to open", () => {
    const config = parseConfig({
      streams: [{ id: "s1", title: "Today", connectionId: "c1" }],
    });
    expect(config.streams[0]?.collapsedByDefault).toBe(false);
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
  it("defaults connectionSecrets for missing secrets", () => {
    expect(parseSecrets(undefined)).toEqual({ connectionSecrets: {} });
  });

  it("keeps known secret fields", () => {
    expect(
      parseSecrets({ unsplashAccessKey: "k", connectionSecrets: { c1: "tok" }, extra: 1 }),
    ).toEqual({ unsplashAccessKey: "k", connectionSecrets: { c1: "tok" } });
  });
});

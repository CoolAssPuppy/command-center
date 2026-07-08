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
    expect(config.version).toBe(2);
    expect(config.zones).toEqual([]);
    expect(config.wallpaper.source).toBe("gradient");
    expect(config.appearance.hour12).toBe(true);
    expect(config.appearance.showDock).toBe(true);
    expect(config.appearance.dockMagnification).toBe(true);
  });

  it("recovers to defaults when given non-config garbage", () => {
    expect(parseConfig("not a config").zones).toEqual([]);
    expect(parseConfig(42).links).toEqual([]);
  });

  it("defaults the news ticker off with Hacker News as the only source", () => {
    const config = parseConfig({});
    expect(config.tickers.news.enabled).toBe(false);
    expect(config.tickers.news.sources).toEqual(["hacker-news"]);
  });

  it("keeps an old news config (no sources field) working, defaulting to Hacker News", () => {
    const config = parseConfig({ tickers: { news: { enabled: true } } });
    expect(config.tickers.news.enabled).toBe(true);
    expect(config.tickers.news.sources).toEqual(["hacker-news"]);
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

  it("defaults a card to the right column and seeds its order from array position", () => {
    const config = parseConfig({
      streams: [
        { id: "s1", title: "One", connectionId: "c1" },
        { id: "s2", title: "Two", connectionId: "c1" },
        { id: "s3", title: "Three", connectionId: "c1" },
      ],
    });
    expect(config.streams.map((s) => s.column)).toEqual(["right", "right", "right"]);
    expect(config.streams.map((s) => s.order)).toEqual([0, 1, 2]);
  });

  it("round-trips an explicit left or right column", () => {
    const config = parseConfig({
      streams: [
        { id: "s1", title: "Lefty", connectionId: "c1", column: "left", order: 0 },
        { id: "s2", title: "Righty", connectionId: "c1", column: "right", order: 0 },
      ],
    });
    expect(config.streams[0]?.column).toBe("left");
    expect(config.streams[1]?.column).toBe("right");
  });

  it("keeps an existing order and stays idempotent across repeated parses", () => {
    const input = {
      streams: [
        { id: "s1", title: "One", connectionId: "c1", column: "left", order: 5 },
        { id: "s2", title: "Two", connectionId: "c1" },
      ],
    };
    const once = parseConfig(input);
    const twice = parseConfig(once);
    expect(once.streams[0]?.order).toBe(5);
    expect(once.streams[1]?.order).toBe(1);
    expect(twice).toEqual(once);
  });

  it("keeps a Combine card's calendar selection, qualified by account", () => {
    const config = parseConfig({
      streams: [
        {
          id: "s1",
          title: "All calendars",
          connectionId: "combined:google-calendar",
          combineCalendars: [
            { connectionId: "work", calendarId: "team@x" },
            { connectionId: "home", calendarId: "primary" },
          ],
        },
      ],
    });
    expect(config.streams[0]?.combineCalendars).toEqual([
      { connectionId: "work", calendarId: "team@x" },
      { connectionId: "home", calendarId: "primary" },
    ]);
  });

  it("leaves a Combine card's selection unset by default (meaning all calendars)", () => {
    const config = parseConfig({
      streams: [{ id: "s1", title: "All calendars", connectionId: "combined:google-calendar" }],
    });
    expect(config.streams[0]?.combineCalendars).toBeUndefined();
  });

  it("defaults weather to on for zones and off for the home clock", () => {
    const config = parseConfig({});
    expect(config.weather.showForZones).toBe(true);
    expect(config.weather.showForHome).toBe(false);
  });
});

describe("config parsing drops only the bad entries, never the whole config", () => {
  it("keeps the valid zones when one zone is malformed", () => {
    const config = parseConfig({
      zones: [
        { id: "home", label: "Home", timeZone: "America/New_York", isHome: true },
        { id: "bad", label: "Bad" }, // no timeZone
        { id: "tokyo", label: "Tokyo", timeZone: "Asia/Tokyo" },
      ],
    });
    expect(config.zones.map((zone) => zone.id)).toEqual(["home", "tokyo"]);
  });

  it("drops a zone whose time zone Intl cannot format", () => {
    const config = parseConfig({
      zones: [
        { id: "home", label: "Home", timeZone: "America/New_York", isHome: true },
        { id: "bogus", label: "Nowhere", timeZone: "Not/AZone" },
      ],
    });
    expect(config.zones.map((zone) => zone.id)).toEqual(["home"]);
  });

  it("drops a dock link with a javascript: scheme but keeps the safe ones", () => {
    const config = parseConfig({
      links: [
        { id: "ok", title: "Docs", url: "https://example.com" },
        { id: "evil", title: "Evil", url: "javascript:alert(1)" },
      ],
    });
    expect(config.links.map((link) => link.id)).toEqual(["ok"]);
  });

  it("drops a malformed custom theme while keeping zones and links", () => {
    const config = parseConfig({
      zones: [{ id: "home", label: "Home", timeZone: "Europe/Lisbon", isHome: true }],
      links: [{ id: "ok", title: "Docs", url: "https://example.com" }],
      customThemes: [{ meta: { themeId: "x" } }], // missing tokens
    });
    expect(config.zones).toHaveLength(1);
    expect(config.links).toHaveLength(1);
    expect(config.customThemes).toEqual([]);
  });

  it("falls back to the default for a malformed settings section, keeping the rest", () => {
    const config = parseConfig({
      zones: [{ id: "home", label: "Home", timeZone: "Europe/Lisbon", isHome: true }],
      weather: "not an object",
    });
    expect(config.zones).toHaveLength(1);
    expect(config.weather.showForZones).toBe(true);
  });
});

describe("config migration (connection config moves onto cards)", () => {
  it("moves per-card fields from an old connection onto the card that references it", () => {
    const config = parseConfig({
      connections: [
        {
          id: "c1",
          name: "Roadmap",
          service: "notion",
          databaseId: "db1",
          titleProperty: "Name",
          filter: "status=open",
          role: "reference",
          count: 9,
        },
      ],
      streams: [{ id: "s1", title: "Roadmap", connectionId: "c1" }],
    });

    // The connection is now identity only; card config is gone from it.
    const connection = config.connections[0] as Record<string, unknown>;
    expect(connection.databaseId).toBeUndefined();
    expect(connection.role).toBeUndefined();
    expect(connection.count).toBeUndefined();

    // The card carries it instead.
    const stream = config.streams[0];
    expect(stream?.databaseId).toBe("db1");
    expect(stream?.titleProperty).toBe("Name");
    expect(stream?.filter).toBe("status=open");
    expect(stream?.role).toBe("reference");
    expect(stream?.count).toBe(9);
  });

  it("moves GitHub query and Google calendars onto their cards", () => {
    const config = parseConfig({
      connections: [
        { id: "gh", name: "Reviews", service: "github", query: "is:open author:@me", count: 5 },
        { id: "cal", name: "Work", service: "google-calendar", calendarIds: ["a", "b"] },
      ],
      streams: [
        { id: "s-gh", title: "PRs", connectionId: "gh" },
        { id: "s-cal", title: "Today", connectionId: "cal" },
      ],
    });
    expect(config.streams.find((s) => s.id === "s-gh")?.query).toBe("is:open author:@me");
    expect(config.streams.find((s) => s.id === "s-gh")?.count).toBe(5);
    expect(config.streams.find((s) => s.id === "s-cal")?.calendarIds).toEqual(["a", "b"]);
  });

  it("does not overwrite a card field that the card already sets", () => {
    const config = parseConfig({
      connections: [{ id: "c1", name: "Roadmap", service: "notion", count: 3 }],
      streams: [{ id: "s1", title: "Roadmap", connectionId: "c1", count: 12 }],
    });
    expect(config.streams[0]?.count).toBe(12);
  });

  it("creates a card for a Linear inbox connection that has no stream", () => {
    const config = parseConfig({
      connections: [{ id: "lin", name: "My inbox", service: "linear", linearView: "inbox" }],
      streams: [],
    });
    const card = config.streams.find((s) => s.connectionId === "lin");
    expect(card).toBeDefined();
    expect(card?.title).toBe("My inbox");
    expect(card?.linearView).toBe("inbox");
    expect(card?.collapsedByDefault).toBe(false);
  });

  it("does not duplicate a Linear inbox connection that already has a card", () => {
    const config = parseConfig({
      connections: [{ id: "lin", name: "My inbox", service: "linear", linearView: "inbox" }],
      streams: [{ id: "s1", title: "Inbox", connectionId: "lin", linearView: "inbox" }],
    });
    expect(config.streams.filter((s) => s.connectionId === "lin")).toHaveLength(1);
  });

  it("renames the legacy projects+initiatives Linear view so old configs still load", () => {
    const config = parseConfig({
      connections: [{ id: "ln", name: "Linear", service: "linear" }],
      streams: [
        { id: "s1", title: "Mine", connectionId: "ln", linearView: "my-projects-initiatives" },
      ],
    });
    expect(config.streams[0]?.linearView).toBe("projects-initiatives");
  });

  it("drops a single malformed card instead of blanking the whole config", () => {
    const config = parseConfig({
      zones: [{ id: "home", label: "Lisbon", timeZone: "Europe/Lisbon", isHome: true }],
      links: [{ id: "gh", title: "GitHub", url: "https://github.com" }],
      connections: [{ id: "ln", name: "Linear", service: "linear" }],
      streams: [
        { id: "good", title: "Issues", connectionId: "ln" },
        { id: "bad", title: "Broken", connectionId: "ln", linearView: "from-a-newer-build" },
      ],
    });
    // Zones, links, and the valid card survive; only the unparseable card is gone.
    expect(config.zones).toHaveLength(1);
    expect(config.links).toHaveLength(1);
    expect(config.streams.map((s) => s.id)).toEqual(["good"]);
  });

  it("leaves a new-model config unchanged (idempotent)", () => {
    const input = {
      connections: [{ id: "c1", name: "Roadmap", service: "notion" }],
      streams: [
        {
          id: "s1",
          title: "Roadmap",
          connectionId: "c1",
          databaseId: "db1",
          count: 6,
          collapsedByDefault: false,
        },
      ],
    };
    const once = parseConfig(input);
    const twice = parseConfig(once);
    expect(twice.streams[0]?.databaseId).toBe("db1");
    expect(twice.streams[0]?.count).toBe(6);
    expect((twice.connections[0] as Record<string, unknown>).databaseId).toBeUndefined();
    expect(twice).toEqual(once);
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
    expect(parseSecrets(undefined)).toEqual({ connectionSecrets: {}, googleTokens: {} });
  });

  it("keeps known secret fields", () => {
    expect(
      parseSecrets({ unsplashAccessKey: "k", connectionSecrets: { c1: "tok" }, extra: 1 }),
    ).toEqual({ unsplashAccessKey: "k", connectionSecrets: { c1: "tok" }, googleTokens: {} });
  });
});

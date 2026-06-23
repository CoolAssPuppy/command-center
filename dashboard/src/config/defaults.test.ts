import { describe, expect, it } from "vitest";

import { defaultConfig, zoneLabel } from "./defaults";
import { homeZone, otherZones } from "./schema";

describe("defaultConfig", () => {
  it("makes the given time zone the home zone", () => {
    const config = defaultConfig({ timeZone: "America/Los_Angeles" });
    const home = homeZone(config);
    expect(home?.isHome).toBe(true);
    expect(home?.timeZone).toBe("America/Los_Angeles");
    expect(home?.label).toBe("Los Angeles");
  });

  it("includes the bundled cities as the timezone row", () => {
    const config = defaultConfig({ timeZone: "America/Los_Angeles" });
    expect(otherZones(config).map((z) => z.label)).toContain("Lisbon");
    expect(otherZones(config).map((z) => z.label)).toContain("Tokyo");
  });

  it("does not duplicate a city that equals the home zone", () => {
    const config = defaultConfig({ timeZone: "America/New_York" });
    const newYorkZones = config.zones.filter(
      (z) => z.timeZone === "America/New_York",
    );
    expect(newYorkZones).toHaveLength(1);
    expect(newYorkZones[0]?.isHome).toBe(true);
  });

  it("seeds starter links; connections and streams start empty", () => {
    const config = defaultConfig({ timeZone: "UTC" });
    expect(config.links.map((link) => link.title)).toContain("GitHub");
    expect(config.connections).toEqual([]);
    expect(config.streams).toEqual([]);
    expect(config.wallpaper.source).toBe("gradient");
  });
});

describe("zoneLabel", () => {
  it("turns an IANA zone into a readable place name", () => {
    expect(zoneLabel("America/New_York")).toBe("New York");
    expect(zoneLabel("Europe/Lisbon")).toBe("Lisbon");
    expect(zoneLabel("UTC")).toBe("UTC");
  });
});

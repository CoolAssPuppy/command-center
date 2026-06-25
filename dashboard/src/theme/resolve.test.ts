import { describe, expect, it } from "vitest";

import { ConfigSchema, type Config } from "../config/schema";
import { aurora } from "./aurora";
import { AUTO_THEME, isDaytime, resolveActiveTheme } from "./resolve";

const config = (theme?: string): Config =>
  ConfigSchema.parse({
    zones: [{ id: "home", label: "Home", timeZone: "America/New_York", isHome: true }],
    appearance: theme !== undefined ? { theme, hour12: true } : { hour12: true },
  });

// 16:00 UTC on 2026-06-15 is 12:00 (day) in New York; 04:00 UTC is 00:00 (night).
const dayInstant = new Date(Date.UTC(2026, 5, 15, 16, 0, 0));
const nightInstant = new Date(Date.UTC(2026, 5, 16, 4, 0, 0));

describe("resolveActiveTheme", () => {
  it("honors an explicit theme id", () => {
    expect(resolveActiveTheme(config("com.strategicnerds.mono"), dayInstant).meta.themeId).toBe(
      "com.strategicnerds.mono",
    );
  });

  it("auto: Mineral during the home zone's day", () => {
    expect(resolveActiveTheme(config(AUTO_THEME), dayInstant).meta.themeId).toBe(
      "com.strategicnerds.mineral",
    );
  });

  it("auto: Twilight during the home zone's night", () => {
    expect(resolveActiveTheme(config(AUTO_THEME), nightInstant).meta.themeId).toBe(
      "com.strategicnerds.twilight",
    );
  });

  it("treats an unset theme as auto", () => {
    expect(resolveActiveTheme(config(), nightInstant).meta.themeId).toBe(
      "com.strategicnerds.twilight",
    );
  });

  it("resolves a custom imported theme by id", () => {
    const customId = "custom.user.midnight";
    const custom = {
      meta: { ...aurora.meta, themeId: customId, name: "Midnight" },
      tokens: aurora.tokens,
    };
    const cfg = ConfigSchema.parse({
      zones: [{ id: "home", label: "Home", timeZone: "America/New_York", isHome: true }],
      appearance: { theme: customId, hour12: true },
      customThemes: [custom],
    });
    expect(resolveActiveTheme(cfg, dayInstant).meta.themeId).toBe(customId);
  });
});

describe("isDaytime", () => {
  it("is true at the home zone's noon and false at midnight", () => {
    expect(isDaytime(config(), dayInstant)).toBe(true);
    expect(isDaytime(config(), nightInstant)).toBe(false);
  });
});

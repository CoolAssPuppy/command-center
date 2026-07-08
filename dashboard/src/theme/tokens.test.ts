import { describe, expect, it } from "vitest";

import { aurora } from "./aurora";
import { applyTokens, parseTheme, ThemeTokensSchema, tokensToCssVars } from "./tokens";

describe("ThemeTokensSchema", () => {
  it("accepts the Aurora tokens", () => {
    expect(ThemeTokensSchema.safeParse(aurora.tokens).success).toBe(true);
  });

  it("rejects a non-positive font scale", () => {
    const broken = { ...aurora.tokens, type: { ...aurora.tokens.type, scale: 0 } };
    expect(ThemeTokensSchema.safeParse(broken).success).toBe(false);
  });

  it("rejects a color value that smuggles a url() or markup", () => {
    for (const evil of ["url(https://tracker.example/pixel)", "red;<script>", "javascript:1"]) {
      const broken = { ...aurora.tokens, color: { ...aurora.tokens.color, accent: evil } };
      expect(ThemeTokensSchema.safeParse(broken).success).toBe(false);
    }
  });

  it("rejects an unknown background mode", () => {
    const broken = {
      ...aurora.tokens,
      background: { ...aurora.tokens.background, mode: "hologram" },
    };
    expect(ThemeTokensSchema.safeParse(broken).success).toBe(false);
  });
});

describe("parseTheme", () => {
  it("accepts a whole valid theme", () => {
    const theme = parseTheme(JSON.parse(JSON.stringify(aurora)));
    expect(theme?.meta.themeId).toBe(aurora.meta.themeId);
  });

  it("rejects JSON missing tokens or meta", () => {
    expect(parseTheme({ meta: aurora.meta })).toBeUndefined();
    expect(parseTheme({ tokens: aurora.tokens })).toBeUndefined();
    expect(parseTheme({ meta: { name: "x" }, tokens: aurora.tokens })).toBeUndefined();
  });
});

describe("tokensToCssVars", () => {
  it("maps colors, sizes with units, and flags to CSS variables", () => {
    const vars = tokensToCssVars(aurora.tokens);

    expect(vars["--cc-color-bg"]).toBe(aurora.tokens.color.bg);
    expect(vars["--cc-color-urgent"]).toBe(aurora.tokens.color.urgent);
    expect(vars["--cc-space-unit"]).toBe("4px");
    expect(vars["--cc-card-radius"]).toBe("16px");
    expect(vars["--cc-numeric"]).toBe("tabular-nums");
    expect(vars["--cc-motion-speed"]).toBe("1");
  });
});

describe("applyTokens", () => {
  it("sets the theme variables on an element", () => {
    const root = document.createElement("div");

    applyTokens(root, aurora.tokens);

    expect(root.style.getPropertyValue("--cc-color-accent")).toBe(
      aurora.tokens.color.accent,
    );
    expect(root.style.getPropertyValue("--cc-bg")).toBe(aurora.tokens.background.value);
  });

  it("forces motion speed to zero when reduced motion is requested", () => {
    const root = document.createElement("div");

    applyTokens(root, aurora.tokens, { reducedMotion: true });

    expect(root.style.getPropertyValue("--cc-motion-speed")).toBe("0");
  });
});


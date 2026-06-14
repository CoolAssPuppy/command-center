import { describe, expect, it } from "vitest";

import { DEFAULT_THEME, SHIPPED_THEMES, themeById } from "./registry";
import { ThemeTokensSchema } from "./tokens";

describe("shipped themes", () => {
  it("ships Aurora, Paper, and Mono", () => {
    expect(SHIPPED_THEMES.map((theme) => theme.meta.name)).toEqual(
      expect.arrayContaining(["Aurora", "Paper", "Mono"]),
    );
  });

  it("gives every theme valid tokens and a unique id", () => {
    const ids = new Set<string>();
    for (const theme of SHIPPED_THEMES) {
      expect(ThemeTokensSchema.safeParse(theme.tokens).success).toBe(true);
      expect(ids.has(theme.meta.themeId)).toBe(false);
      ids.add(theme.meta.themeId);
    }
  });
});

describe("themeById", () => {
  it("finds a theme by its id", () => {
    expect(themeById("com.strategicnerds.paper").meta.name).toBe("Paper");
    expect(themeById("com.strategicnerds.mono").meta.name).toBe("Mono");
  });

  it("falls back to the default for an unknown or absent id", () => {
    expect(themeById("does.not.exist")).toBe(DEFAULT_THEME);
    expect(themeById(undefined)).toBe(DEFAULT_THEME);
  });

  it("accepts a custom fallback", () => {
    const paper = themeById("com.strategicnerds.paper");
    expect(themeById("nope", paper)).toBe(paper);
  });
});

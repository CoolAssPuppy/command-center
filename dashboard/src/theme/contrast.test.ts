import { describe, expect, it } from "vitest";

import { worstContrastAgainstBackground } from "./contrast";
import { SHIPPED_THEMES } from "./registry";

/**
 * Legibility guard. Every shipped theme must keep its text readable against the
 * worst point of its background (the flat bg token and every gradient stop),
 * since borderless text overlays the whole gradient. Body text aims for WCAG AAA
 * (7:1); muted text and the clock for AA (4.5:1). A failure names the theme and
 * token so the offending color is obvious.
 */
const TEXT_MIN = 7;
const MUTED_MIN = 4.5;
const PRIMARY_MIN = 4.5;

describe("theme contrast", () => {
  for (const theme of SHIPPED_THEMES) {
    const { color, background } = theme.tokens;
    const worst = (hex: string): number =>
      worstContrastAgainstBackground(hex, color.bg, background.value);

    it(`${theme.meta.name}: body text is at least ${String(TEXT_MIN)}:1`, () => {
      const ratio = worst(color.text);
      expect(
        ratio,
        `${theme.meta.name} text ${color.text} only ${ratio.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(TEXT_MIN);
    });

    it(`${theme.meta.name}: muted text is at least ${String(MUTED_MIN)}:1`, () => {
      const ratio = worst(color.muted);
      expect(
        ratio,
        `${theme.meta.name} muted ${color.muted} only ${ratio.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(MUTED_MIN);
    });

    it(`${theme.meta.name}: clock (primary) is at least ${String(PRIMARY_MIN)}:1`, () => {
      const ratio = worst(color.primary);
      expect(
        ratio,
        `${theme.meta.name} primary ${color.primary} only ${ratio.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(PRIMARY_MIN);
    });
  }
});

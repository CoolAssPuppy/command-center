import type { Theme } from "./tokens";

/**
 * Aurora: the showpiece dark-glass theme with a living gradient background and
 * soft motion. Shipped by default. See docs/14-themes.md. This file is the token
 * layer; render-theme behavior (custom chart styling, ambient background) comes
 * with the theme system in Phase 6.
 */
export const aurora: Theme = {
  meta: {
    themeId: "com.strategicnerds.aurora",
    name: "Aurora",
    author: "Strategic Nerds",
    tier: "render",
  },
  tokens: {
    color: {
      bg: "#0B0F1A",
      surface: "#121826",
      text: "#E6EAF2",
      muted: "#9AA4B2",
      accent: "#7C8CFF",
      positive: "#34D399",
      urgent: "#F87171",
    },
    type: {
      fontFamily: "Inter, system-ui, -apple-system, sans-serif",
      scale: 1.0,
      numericTabular: true,
    },
    space: {
      unit: 4,
      cardPadding: 16,
      cardRadius: 16,
    },
    motion: {
      enabled: true,
      speed: 1.0,
    },
    background: {
      mode: "gradient",
      value:
        "radial-gradient(120% 120% at 20% 0%, #1B2340 0%, #0B0F1A 55%, #070A12 100%)",
      imageOfDay: false,
    },
  },
};

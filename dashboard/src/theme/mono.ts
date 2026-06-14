import type { Theme } from "./tokens";

/**
 * Mono: a dense, high-information theme. Near-black ground, monospaced tabular
 * type, a single bright accent. For people who want maximum signal per pixel.
 * A token theme. See docs/14-themes.md.
 */
export const mono: Theme = {
  meta: {
    themeId: "com.strategicnerds.mono",
    name: "Mono",
    author: "Strategic Nerds",
    tier: "token",
  },
  tokens: {
    color: {
      bg: "#0A0A0A",
      surface: "#111111",
      text: "#E8E8E8",
      muted: "#8A8A8A",
      accent: "#5EE6A8",
      positive: "#5EE6A8",
      urgent: "#FF6B6B",
      primary: "#5EE6A8",
      secondary: "#E8E8E8",
      accent1: "#5EE6A8",
      accent2: "#FFB454",
      accent3: "#6AA6FF",
    },
    type: {
      fontFamily: "'SF Mono', ui-monospace, 'JetBrains Mono', monospace",
      scale: 0.95,
      numericTabular: true,
    },
    space: {
      unit: 4,
      cardPadding: 12,
      cardRadius: 8,
    },
    motion: {
      enabled: true,
      speed: 1.0,
    },
    background: {
      mode: "solid",
      value: "#0A0A0A",
      imageOfDay: false,
    },
  },
};

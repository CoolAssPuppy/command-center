import type { Theme } from "./tokens";

/**
 * Paper: a calm, light, editorial theme. Generous serif type, quiet ink accent,
 * a warm off-white ground. A token theme, safe by construction.
 * See docs/14-themes.md.
 */
export const paper: Theme = {
  meta: {
    themeId: "com.strategicnerds.paper",
    name: "Paper",
    author: "Strategic Nerds",
    tier: "token",
  },
  tokens: {
    color: {
      bg: "#FBFAF7",
      surface: "#FFFFFF",
      text: "#1C1B19",
      muted: "#6B6862",
      accent: "#2A6F97",
      positive: "#1E7D4F",
      urgent: "#B4231F",
    },
    type: {
      fontFamily: "'Iowan Old Style', Georgia, 'Times New Roman', serif",
      scale: 1.0,
      numericTabular: true,
    },
    space: {
      unit: 4,
      cardPadding: 18,
      cardRadius: 12,
    },
    motion: {
      enabled: true,
      speed: 0.85,
    },
    background: {
      mode: "solid",
      value: "#FBFAF7",
      imageOfDay: false,
    },
  },
};

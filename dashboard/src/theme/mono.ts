import type { Theme } from "./tokens";

/**
 * Mono: an amber-phosphor terminal. A warm near-black ground glowing with the
 * single amber of an old monochrome monitor, monospaced and dense, where a
 * hotter amber marks what is urgent. Maximum signal, one color, no chrome.
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
      bg: "#100B04",
      surface: "#1A1206",
      text: "#F5B642",
      muted: "#A87A2C",
      accent: "#FFB000",
      positive: "#D69A2E",
      urgent: "#FF7A1A",
      primary: "#FFB000",
      secondary: "#C98A1A",
      accent1: "#FFB000",
      accent2: "#FF8C00",
      accent3: "#B36B00",
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
      mode: "gradient",
      value: "linear-gradient(176deg, #0C0803 0%, #100B04 60%, #1A1206 100%)",
      imageOfDay: false,
    },
  },
};

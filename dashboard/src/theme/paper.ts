import type { Theme } from "./tokens";

/**
 * Paper: stark black ink on white, nothing else. A pure monochrome editorial
 * theme where type and contrast carry all the meaning, no hue anywhere, not even
 * for positive or urgent. Generous serif over a faint paper sheen.
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
      bg: "#FFFFFF",
      surface: "#F4F4F2",
      text: "#0B0B0B",
      muted: "#6B6B6B",
      accent: "#111111",
      // Grayscale through and through: weight and darkness signal state, not hue.
      positive: "#5A5A5A",
      urgent: "#0A0A0A",
      primary: "#0B0B0B",
      secondary: "#6B6B6B",
      accent1: "#2E2E2E",
      accent2: "#8A8A8A",
      accent3: "#545454",
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
      mode: "gradient",
      value: "linear-gradient(176deg, #FFFFFF 0%, #FAFAF9 55%, #F1F1EF 100%)",
      imageOfDay: false,
    },
  },
};

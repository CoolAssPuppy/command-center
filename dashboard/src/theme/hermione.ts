import type { Theme } from "./tokens";

/**
 * Hermione: bookish and scholarly. Aged parchment ground, sepia ink, and a
 * Gryffindor-burgundy accent with an antique-gold secondary, like a library at
 * candlelight. A light token theme.
 */
export const hermione: Theme = {
  meta: {
    themeId: "com.strategicnerds.hermione",
    name: "Hermione",
    author: "Strategic Nerds",
    tier: "token",
  },
  tokens: {
    color: {
      bg: "#F1E9D6",
      surface: "#FBF6EA",
      text: "#2C241B",
      muted: "#7C6E59",
      accent: "#9A3B2E",
      positive: "#4E7A53",
      urgent: "#9A3B2E",
      primary: "#2C241B",
      secondary: "#7C6E59",
      accent1: "#9A3B2E",
      accent2: "#B98A3C",
      accent3: "#5E4A33",
    },
    type: {
      fontFamily: "'Archivo Variable', Archivo, system-ui, -apple-system, sans-serif",
      scale: 1.0,
      numericTabular: true,
    },
    space: { unit: 4, cardPadding: 16, cardRadius: 14 },
    motion: { enabled: true, speed: 1.0 },
    background: {
      mode: "gradient",
      value: "linear-gradient(176deg, #F4ECDB 0%, #EFE6CF 50%, #E7DABF 100%)",
      imageOfDay: false,
    },
  },
};

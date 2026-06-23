import type { Theme } from "./tokens";

/**
 * Hermione: the world of Harry Potter. An aged Hogwarts-letter parchment under
 * dark ink, with Gryffindor scarlet as the accent and antique house-gold beside
 * it, like a spellbook read by candlelight. A light token theme.
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
      bg: "#EADEC2",
      surface: "#F6EDD6",
      text: "#2A201A",
      muted: "#7A6A52",
      accent: "#7E1510",
      positive: "#4E7A53",
      urgent: "#7E1510",
      primary: "#2A201A",
      secondary: "#7A6A52",
      accent1: "#7E1510",
      accent2: "#C9A227",
      accent3: "#5A4326",
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
      value:
        "linear-gradient(176deg, #F0E6CC 0%, #E8DBBA 48%, #DFCEA4 80%, #D6C394 100%)",
      imageOfDay: false,
    },
  },
};

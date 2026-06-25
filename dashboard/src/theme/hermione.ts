import type { Theme } from "./tokens";

/**
 * Hermione: Hogwarts after dark. A midnight-castle ground of aubergine stone
 * under warm parchment-and-candlelight text, with a candle-gold clock and the
 * four house colors woven through the accents (Gryffindor scarlet, Ravenclaw
 * sapphire, Slytherin emerald, Hufflepuff gold). The background is the Great
 * Hall's enchanted ceiling melting into candle glow at the floor.
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
      bg: "#0C0A12",
      surface: "#17131F",
      text: "#ECE1C4",
      muted: "#9A8C6F",
      accent: "#E3B53A",
      positive: "#2A623D",
      urgent: "#AE0001",
      primary: "#E3B53A",
      secondary: "#9A8C6F",
      accent1: "#AE0001",
      accent2: "#2A3C6E",
      accent3: "#2A623D",
    },
    type: {
      fontFamily: "'Iowan Old Style', Georgia, 'Times New Roman', serif",
      scale: 1.0,
      numericTabular: true,
    },
    space: { unit: 4, cardPadding: 16, cardRadius: 14 },
    motion: { enabled: true, speed: 1.0 },
    background: {
      mode: "gradient",
      value:
        "linear-gradient(176deg, #0A0913 0%, #12101D 40%, #1B1626 70%, #2A1F1A 88%, #3A2A18 100%)",
      imageOfDay: false,
    },
  },
};

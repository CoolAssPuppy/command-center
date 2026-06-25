import type { Theme } from "./tokens";

/**
 * Kirk: 1960s Star Trek. The black of deep space under bright optimistic type,
 * the command-gold tunic glowing on the clock, and the sciences-blue and
 * operations-red of the other crew shirts beside it. A dark token theme.
 */
export const kirk: Theme = {
  meta: {
    themeId: "com.strategicnerds.kirk",
    name: "Kirk",
    author: "Strategic Nerds",
    tier: "token",
  },
  tokens: {
    color: {
      bg: "#07080D",
      surface: "#15171F",
      text: "#F4F1E6",
      muted: "#9A968A",
      accent: "#E8B23A",
      positive: "#56B98A",
      urgent: "#D6402F",
      primary: "#E8B23A",
      secondary: "#9A968A",
      accent1: "#E8B23A",
      accent2: "#3E8FD0",
      accent3: "#D6402F",
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
        "linear-gradient(176deg, #040507 0%, #0A0B12 40%, #11101E 72%, #1A1330 100%)",
      imageOfDay: false,
    },
  },
};

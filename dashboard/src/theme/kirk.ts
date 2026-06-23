import type { Theme } from "./tokens";

/**
 * Kirk: 1960s Star Trek. The black of space under bright optimistic type, with
 * the command-gold tunic as the accent and the sciences-blue and operations-red
 * of the other crew shirts beside it. A dark token theme.
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
      bg: "#08090E",
      surface: "#15171F",
      text: "#F2EFE6",
      muted: "#8E8C81",
      accent: "#E8B23A",
      positive: "#56B98A",
      urgent: "#CC4436",
      primary: "#F2EFE6",
      secondary: "#8E8C81",
      accent1: "#E8B23A",
      accent2: "#3E8FD0",
      accent3: "#CC4436",
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
        "linear-gradient(176deg, #050608 0%, #0A0B12 45%, #10121C 80%, #161526 100%)",
      imageOfDay: false,
    },
  },
};

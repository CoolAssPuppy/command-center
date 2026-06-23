import type { Theme } from "./tokens";

/**
 * Kirk: the bridge of a starship. Deep-space indigo-black under bright type,
 * with command-gold as the accent and a science-blue secondary. A dark token
 * theme.
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
      bg: "#0A0E18",
      surface: "#17223A",
      text: "#ECEFF6",
      muted: "#8B95AC",
      accent: "#E7B53C",
      positive: "#54B98A",
      urgent: "#D6584B",
      primary: "#ECEFF6",
      secondary: "#8B95AC",
      accent1: "#E7B53C",
      accent2: "#5AA9E6",
      accent3: "#D6584B",
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
        "linear-gradient(176deg, #070B14 0%, #0C1424 45%, #122039 78%, #1A2A4A 100%)",
      imageOfDay: false,
    },
  },
};

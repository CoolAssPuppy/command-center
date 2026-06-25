import type { Theme } from "./tokens";

/**
 * Solar: the Solarized dark palette, the developer's old friend. A deep teal-ink
 * base under measured base-tone text, with the signature yellow on the clock and
 * cyan, blue, and magenta accents at their precise Solarized values.
 */
export const solar: Theme = {
  meta: {
    themeId: "com.strategicnerds.solar",
    name: "Solar",
    author: "Strategic Nerds",
    tier: "token",
  },
  tokens: {
    color: {
      bg: "#002B36",
      surface: "#073642",
      text: "#C6D0D0",
      muted: "#6E8285",
      accent: "#2AA198",
      positive: "#859900",
      urgent: "#DC322F",
      primary: "#B58900",
      secondary: "#6E8285",
      accent1: "#2AA198",
      accent2: "#268BD2",
      accent3: "#D33682",
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
        "linear-gradient(176deg, #00232C 0%, #002B36 55%, #05323E 100%)",
      imageOfDay: false,
    },
  },
};

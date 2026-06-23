import type { Theme } from "./tokens";

/**
 * Twilight: the night scheme. A blue-hour terminator sky (inky indigo melting
 * into a warm amber horizon) under bone text and one warm-amber accent, the
 * "golden hours" when distant teammates overlap. The day counterpart is Mineral;
 * the dashboard auto-switches between them by the home zone's local time.
 */
export const twilight: Theme = {
  meta: {
    themeId: "com.strategicnerds.twilight",
    name: "Twilight",
    author: "Strategic Nerds",
    tier: "token",
  },
  tokens: {
    color: {
      bg: "#0E1424",
      surface: "#1A2440",
      text: "#F4F1EA",
      muted: "#9FAABE",
      accent: "#E9A85C",
      positive: "#6FB394",
      urgent: "#E08A5C",
      primary: "#F4F1EA",
      secondary: "#9FAABE",
      accent1: "#E9A85C",
      accent2: "#6E83A8",
      accent3: "#D9764E",
    },
    type: {
      fontFamily: "'Archivo Variable', Archivo, system-ui, -apple-system, sans-serif",
      scale: 1.0,
      numericTabular: true,
    },
    space: {
      unit: 4,
      cardPadding: 16,
      cardRadius: 14,
    },
    motion: {
      enabled: true,
      speed: 1.0,
    },
    background: {
      mode: "gradient",
      value:
        "linear-gradient(176deg, #0A0F1E 0%, #111A30 32%, #1B2944 54%, #2B3150 72%, #4E4350 88%, #6E5346 100%)",
      imageOfDay: false,
    },
  },
};

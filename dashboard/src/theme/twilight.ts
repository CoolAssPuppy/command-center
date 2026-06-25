import type { Theme } from "./tokens";

/**
 * Twilight: the night scheme. A blue-hour terminator sky, inky indigo melting
 * down into a warm amber horizon, under bone text and one warm-amber accent, the
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
      bg: "#0C1222",
      surface: "#18223E",
      text: "#F5F2EB",
      muted: "#BAC3D4",
      accent: "#F0AE5E",
      positive: "#6FB394",
      urgent: "#E27B4C",
      primary: "#F5F2EB",
      secondary: "#9FAABE",
      accent1: "#F0AE5E",
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
        "linear-gradient(176deg, #080D1C 0%, #101A33 30%, #1C2C48 52%, #2A2942 70%, #3C3340 86%, #5E3A24 100%)",
      imageOfDay: false,
    },
  },
};

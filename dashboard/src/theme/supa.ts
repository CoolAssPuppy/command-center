import type { Theme } from "./tokens";

/**
 * Supa: terminal-dark with one bright phosphor-green accent, a nod to Supabase.
 * Near-black with a faint green tint under clean type. A dark token theme.
 */
export const supa: Theme = {
  meta: {
    themeId: "com.strategicnerds.supa",
    name: "Supa",
    author: "Strategic Nerds",
    tier: "token",
  },
  tokens: {
    color: {
      bg: "#0C0F11",
      surface: "#18211C",
      text: "#ECEDED",
      muted: "#83918A",
      accent: "#3ECF8E",
      positive: "#3ECF8E",
      urgent: "#E05A4F",
      primary: "#ECEDED",
      secondary: "#83918A",
      accent1: "#3ECF8E",
      accent2: "#2B9E6E",
      accent3: "#E0B341",
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
        "linear-gradient(176deg, #090C0B 0%, #0E1512 50%, #122019 82%, #14271C 100%)",
      imageOfDay: false,
    },
  },
};

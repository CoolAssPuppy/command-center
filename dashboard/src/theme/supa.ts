import type { Theme } from "./tokens";

/**
 * Supa: Supabase's dashboard. Neutral charcoal greys, not tinted, under clean
 * white type, with the one Supabase phosphor-green (#3ECF8E) as the accent and
 * a faint green glow at the foot of the page. A dark token theme.
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
      bg: "#1C1C1C",
      surface: "#2A2A2A",
      text: "#EDEDED",
      muted: "#8B8B8B",
      accent: "#3ECF8E",
      positive: "#3ECF8E",
      urgent: "#F25C54",
      primary: "#EDEDED",
      secondary: "#8B8B8B",
      accent1: "#3ECF8E",
      accent2: "#2A9D6E",
      accent3: "#A0A0A0",
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
        "linear-gradient(176deg, #1B1B1B 0%, #1C1C1C 55%, #1B201D 85%, #19241E 100%)",
      imageOfDay: false,
    },
  },
};

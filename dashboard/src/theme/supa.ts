import type { Theme } from "./tokens";

/**
 * Supa: Supabase's dashboard, sharpened. Crisp neutral charcoal greys under
 * clean white type, the one Supabase phosphor-green carried all the way to the
 * clock, and a deepening green glow at the foot of the page. A dark token theme.
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
      bg: "#161616",
      surface: "#232323",
      text: "#FAFAFA",
      muted: "#969696",
      accent: "#3ECF8E",
      positive: "#3ECF8E",
      urgent: "#F25C54",
      primary: "#3ECF8E",
      secondary: "#A8A8A8",
      accent1: "#3ECF8E",
      accent2: "#249361",
      accent3: "#6B6B6B",
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
        "linear-gradient(176deg, #141414 0%, #161616 50%, #15201A 82%, #112A1E 100%)",
      imageOfDay: false,
    },
  },
};

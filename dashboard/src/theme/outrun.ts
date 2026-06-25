import type { Theme } from "./tokens";

/**
 * Outrun: 1984 at 88 miles an hour. A purple-black night cut by hot-magenta and
 * cyan neon, with a chrome-sunset gradient burning from violet up top to molten
 * orange at the horizon. The clock glows magenta. A dark token theme.
 */
export const outrun: Theme = {
  meta: {
    themeId: "com.strategicnerds.outrun",
    name: "Outrun",
    author: "Strategic Nerds",
    tier: "token",
  },
  tokens: {
    color: {
      bg: "#0E0420",
      surface: "#1B0B33",
      text: "#F5E6FF",
      muted: "#9B7BB8",
      accent: "#FF2E97",
      positive: "#2DE2E6",
      urgent: "#FF3864",
      primary: "#FF2E97",
      secondary: "#2DE2E6",
      accent1: "#FF2E97",
      accent2: "#2DE2E6",
      accent3: "#FEC700",
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
        "linear-gradient(176deg, #16092F 0%, #260E47 28%, #5A1A5E 56%, #B0286C 78%, #FF5B5B 100%)",
      imageOfDay: false,
    },
  },
};

import type { Theme } from "./tokens";

/**
 * Mineral: the editorial day default. A sunlit limestone ground, deep slate ink,
 * and one oxidized-copper accent with brass and rust beside it, built to carry
 * desaturated skyline photography. Rust appears only for overdue / at-risk
 * states. The night counterpart is Twilight; "auto" switches between them.
 */
export const mineral: Theme = {
  meta: {
    themeId: "com.strategicnerds.mineral",
    name: "Mineral",
    author: "Strategic Nerds",
    tier: "token",
  },
  tokens: {
    color: {
      bg: "#EBE6DB",
      surface: "#F9F7F2",
      text: "#1E222A",
      muted: "#6A6E76",
      accent: "#2E7D6E",
      positive: "#3E7C5A",
      urgent: "#A4503C",
      primary: "#1E222A",
      secondary: "#6A6E76",
      accent1: "#2E7D6E",
      accent2: "#C39A57",
      accent3: "#A4503C",
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
        "linear-gradient(176deg, #F4EFE5 0%, #ECE6DA 42%, #E2D9C9 76%, #D8CCB8 100%)",
      imageOfDay: false,
    },
  },
};

import type { Theme } from "./tokens";

/**
 * Mineral: the editorial default. A limestone ground, slate ink, and a single
 * oxidized-copper accent, built to carry desaturated black-and-white skyline
 * photography. Rust appears only for overdue / at-risk states. A token theme.
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
      bg: "#ECE8E0",
      surface: "#F8F6F1",
      text: "#21242A",
      muted: "#6A6E76",
      accent: "#2F7A6F",
      positive: "#3E7C5A",
      urgent: "#A4503C",
      primary: "#21242A",
      secondary: "#6A6E76",
      accent1: "#2F7A6F",
      accent2: "#C9A267",
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
      mode: "solid",
      value: "#ECE8E0",
      imageOfDay: false,
    },
  },
};

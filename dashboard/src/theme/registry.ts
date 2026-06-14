import { aurora } from "./aurora";
import { mono } from "./mono";
import { paper } from "./paper";
import type { Theme } from "./tokens";

/**
 * The shipped themes and a lookup. The dashboard resolves the active theme from
 * settings.appearance.theme by id, falling back to the default. Third-party
 * themes (a future registry) would join SHIPPED_THEMES.
 */
export const SHIPPED_THEMES: Theme[] = [aurora, paper, mono];

export const DEFAULT_THEME = aurora;

export function themeById(
  id: string | undefined,
  fallback: Theme = DEFAULT_THEME,
): Theme {
  if (id === undefined) return fallback;
  return SHIPPED_THEMES.find((theme) => theme.meta.themeId === id) ?? fallback;
}

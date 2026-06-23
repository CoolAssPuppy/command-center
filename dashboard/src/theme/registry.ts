import { aurora } from "./aurora";
import { mineral } from "./mineral";
import { mono } from "./mono";
import { paper } from "./paper";
import type { Theme } from "./tokens";
import { twilight } from "./twilight";

/**
 * The shipped themes and a lookup. The dashboard resolves the active theme from
 * settings.appearance.theme by id, falling back to the default. Mineral (day)
 * and Twilight (night) are a matched pair the "auto" setting switches between;
 * see resolveActiveTheme. Third-party themes (a future registry) would join here.
 */
export const SHIPPED_THEMES: Theme[] = [mineral, twilight, aurora, paper, mono];

export const DEFAULT_THEME = mineral;

export function themeById(
  id: string | undefined,
  fallback: Theme = DEFAULT_THEME,
): Theme {
  if (id === undefined) return fallback;
  return SHIPPED_THEMES.find((theme) => theme.meta.themeId === id) ?? fallback;
}

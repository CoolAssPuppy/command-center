import { aurora } from "./aurora";
import { hermione } from "./hermione";
import { kirk } from "./kirk";
import { mineral } from "./mineral";
import { mono } from "./mono";
import { outrun } from "./outrun";
import { paper } from "./paper";
import { solar } from "./solar";
import { supa } from "./supa";
import type { Theme } from "./tokens";
import { twilight } from "./twilight";

/**
 * The shipped themes and a lookup. The dashboard resolves the active theme from
 * settings.appearance.theme by id, falling back to the default. Mineral (day)
 * and Twilight (night) are a matched pair the "auto" setting switches between;
 * see resolveActiveTheme. Custom themes (imported by the user) are merged in by
 * the appearance picker and resolveActiveTheme.
 */
export const SHIPPED_THEMES: Theme[] = [
  mineral,
  twilight,
  hermione,
  kirk,
  supa,
  aurora,
  outrun,
  solar,
  paper,
  mono,
];

export const DEFAULT_THEME = mineral;

/**
 * Find a theme by id among the shipped themes plus any extra (custom) themes,
 * falling back to the default. Extras win ties, so a custom theme can override a
 * shipped one sharing its id.
 */
export function themeById(
  id: string | undefined,
  fallback: Theme = DEFAULT_THEME,
  extra: Theme[] = [],
): Theme {
  if (id === undefined) return fallback;
  const all = [...SHIPPED_THEMES, ...extra];
  return all.find((theme) => theme.meta.themeId === id) ?? fallback;
}

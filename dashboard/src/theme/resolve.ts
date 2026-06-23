import { homeZone, type Config } from "../config/schema";
import { zonedTime } from "../time/clock";
import { mineral } from "./mineral";
import { SHIPPED_THEMES } from "./registry";
import type { Theme } from "./tokens";
import { twilight } from "./twilight";

/** The theme setting meaning "follow the home zone's day/night". */
export const AUTO_THEME = "auto";

function localTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** Whether the home zone is in daytime (06:00–18:00 local) at this instant. */
export function isDaytime(config: Config, now: Date): boolean {
  const home = homeZone(config);
  const timeZone = home?.timeZone ?? localTimeZone();
  const { hour } = zonedTime(now, timeZone);
  return hour >= 6 && hour < 18;
}

/**
 * The active theme. An explicit, known theme id wins. Otherwise ("auto" or
 * unset) the theme follows the home zone's clock: Mineral by day, Twilight by
 * night. This is what makes the new tab feel like the time of day.
 */
export function resolveActiveTheme(config: Config, now: Date): Theme {
  const id = config.appearance.theme;
  if (id !== undefined && id !== AUTO_THEME) {
    const explicit = SHIPPED_THEMES.find((theme) => theme.meta.themeId === id);
    if (explicit !== undefined) return explicit;
  }
  return isDaytime(config, now) ? mineral : twilight;
}

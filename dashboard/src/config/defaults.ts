import { CITIES } from "../cities/cities";
import { ConfigSchema, type Config, type Zone } from "./schema";

/**
 * The seed config for a first run. The home zone is the viewer's own local zone
 * (centered, prominent); the bundled cities follow as the timezone row. Links,
 * streams, and wallpaper start empty/off so the page is calm out of the box and
 * the user opts into each piece from the edit pane.
 */

function resolveLocalTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** A readable place name from an IANA zone, e.g. "America/New_York" -> "New York". */
export function zoneLabel(timeZone: string): string {
  const tail = timeZone.split("/").pop() ?? timeZone;
  return tail.replace(/_/g, " ");
}

export interface DefaultConfigOptions {
  /** Override the detected home time zone (used by tests for determinism). */
  timeZone?: string;
}

export function defaultConfig(options: DefaultConfigOptions = {}): Config {
  const homeTimeZone = options.timeZone ?? resolveLocalTimeZone();

  const home: Zone = {
    id: "home",
    label: zoneLabel(homeTimeZone),
    timeZone: homeTimeZone,
    isHome: true,
  };

  // The bundled cities become the timezone row, minus any that duplicate home.
  const others: Zone[] = CITIES.filter((city) => city.timeZone !== homeTimeZone).map(
    (city) => ({
      id: city.id,
      label: city.label,
      timeZone: city.timeZone,
      lat: city.lat,
      lon: city.lon,
    }),
  );

  return ConfigSchema.parse({
    version: 1,
    zones: [home, ...others],
    links: [
      { id: "gmail", title: "Gmail", url: "https://mail.google.com" },
      { id: "calendar", title: "Calendar", url: "https://calendar.google.com" },
      { id: "github", title: "GitHub", url: "https://github.com" },
    ],
    streams: [
      {
        id: "today",
        title: "Today",
        collapsedByDefault: false,
        content: { type: "integration", integrationId: "google-calendar", config: {} },
      },
      {
        id: "inbox",
        title: "Inbox",
        collapsedByDefault: false,
        content: { type: "integration", integrationId: "linear", config: {} },
      },
      {
        id: "docs",
        title: "Docs",
        collapsedByDefault: false,
        content: {
          type: "integration",
          integrationId: "notion",
          config: { databaseId: "", pageSize: 8 },
        },
      },
    ],
  });
}

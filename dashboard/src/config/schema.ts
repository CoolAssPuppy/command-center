import { z } from "zod";

import { ThemeSchema } from "../theme/tokens";

/**
 * The single source of truth for everything the new tab shows. The whole app is
 * config-driven: this object lives in chrome.storage (synced), is validated on
 * every load, and the shell renders straight from it. Secrets (API tokens) are
 * deliberately kept out of here and stored separately in chrome.storage.local;
 * see SecretsSchema and the config store.
 */

/** A clock the dashboard tracks. The home zone is centered and prominent. */
export const ZoneSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  /** IANA time zone, e.g. "America/New_York". */
  timeZone: z.string().min(1),
  /** Latitude/longitude, when known, power the day/night tint and weather. */
  lat: z.number().optional(),
  lon: z.number().optional(),
  /** Exactly one zone should be the home zone; the first is used if none is. */
  isHome: z.boolean().optional(),
});
export type Zone = z.infer<typeof ZoneSchema>;

/** A dock link, rendered as an icon-sized favicon. */
export const DockLinkSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  url: z.string().url(),
  /** Optional explicit icon; otherwise a favicon is resolved from the url. */
  iconUrl: z.string().url().optional(),
});
export type DockLink = z.infer<typeof DockLinkSchema>;

/**
 * The services a connection can be an instance of.
 */
export const SERVICES = [
  "google-calendar",
  "linear",
  "notion",
  "github",
  "todoist",
  "google-tasks",
] as const;
export const ServiceSchema = z.enum(SERVICES);
export type Service = z.infer<typeof ServiceSchema>;

/**
 * A virtual connection id for a Work stream that merges every Google Calendar
 * connection into one. It is not a real connection; the app fans out to all
 * calendar connections and combines their events.
 */
export const COMBINED_CALENDARS_ID = "combined:google-calendar";

/**
 * A connection is identity only: a label, the service, and (kept separately in
 * Secrets) its credential or OAuth token. All presentation is on the Data Card
 * (Stream) that picks this connection as its base.
 */
export const ConnectionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  service: ServiceSchema,
});
export type Connection = z.infer<typeof ConnectionSchema>;

/**
 * Per-card customization of a base connection. Every field is optional and lives
 * on the Data Card, not the connection, so one connection can back several cards.
 */
export const CardConfigSchema = z.object({
  /** Google Calendar: which calendar (default "primary"). */
  calendarId: z.string().optional(),
  /** Google Calendar: the calendars to read, by id or share link. */
  calendarIds: z.array(z.string()).optional(),
  /** Notion: which database, and how to read it. */
  databaseId: z.string().optional(),
  titleProperty: z.string().optional(),
  filter: z.unknown().optional(),
  /** GitHub: a search query, e.g. "is:open is:pr review-requested:@me". */
  query: z.string().optional(),
  /**
   * Where the card's items belong. "reference" (the default) shows only as a
   * right-column data card; "tasks" also surfaces in the left lane's Tasks
   * section. Applies to task-capable sources (Notion, Todoist, Google Tasks).
   */
  role: z.enum(["reference", "tasks"]).optional(),
  /**
   * Linear: which pre-defined view to read. "assigned" (the default) lists open
   * issues you created or own; the rest are other viewer-scoped issue lists, the
   * notification inbox, projects, or initiatives.
   */
  linearView: z
    .enum([
      "assigned",
      "created",
      "in-progress",
      "due",
      "recent",
      "inbox",
      "projects",
      "initiatives",
    ])
    .optional(),
  /** How many items to show. */
  count: z.number().int().positive().max(50).optional(),
});
export type SourceConfig = z.infer<typeof CardConfigSchema>;

/** A connection merged with a card's per-source config, as integrations read it. */
export type IntegrationSource = Connection & SourceConfig;

/**
 * A Data Card: a titled panel that picks a base connection and customizes it. The
 * card carries all per-source presentation (which calendar, which Linear view,
 * the GitHub query, the Notion database, the role, the item count).
 */
export const StreamSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    connectionId: z.string().min(1),
    collapsedByDefault: z.boolean().default(false),
  })
  .merge(CardConfigSchema);
export type Stream = z.infer<typeof StreamSchema>;

/** The card-config fields, used by the migration and the per-card fetch. */
export const CARD_CONFIG_KEYS = [
  "calendarId",
  "calendarIds",
  "databaseId",
  "titleProperty",
  "filter",
  "query",
  "role",
  "linearView",
  "count",
] as const;

/**
 * The background. "gradient" uses the active theme's gradient (the default);
 * "unsplash" pulls a photo by search terms; "custom" uses a supplied image URL.
 * A photo sits over the gradient under a readability scrim.
 */
export const WallpaperSchema = z.object({
  source: z.enum(["gradient", "fluid", "unsplash", "custom"]).default("gradient"),
  /** How often a new photo is picked (Unsplash). */
  frequency: z.enum(["never", "newtab", "hourly", "daily"]).default("daily"),
  /** Unsplash search terms, one image per day/tab, e.g. ["San Francisco"]. */
  terms: z.array(z.string()).default([]),
  /** A direct image URL for the "custom" source. */
  customUrl: z.string().optional(),
  /** 0 = no darkening, 1 = black. A readability scrim over the photo. */
  scrim: z.number().min(0).max(1).default(0.4),
});
export type Wallpaper = z.infer<typeof WallpaperSchema>;

export const AppearanceSchema = z.object({
  /** Theme id from the registry; falls back to the default theme. */
  theme: z.string().optional(),
  /** 12-hour clock when true, 24-hour when false. */
  hour12: z.boolean().default(true),
  /** Show the meeting-overlap window beside the home clock. */
  showMeetingWindow: z.boolean().default(true),
  /** Show the dock of links along the bottom. */
  showDock: z.boolean().default(true),
  /** Magnify dock icons on hover by proximity; off keeps them a fixed size. */
  dockMagnification: z.boolean().default(true),
});
export type Appearance = z.infer<typeof AppearanceSchema>;

export const ProfileSchema = z.object({
  name: z.string().optional(),
});
export type Profile = z.infer<typeof ProfileSchema>;

export const WeatherSettingsSchema = z.object({
  /** Show the current temperature on the home clock. */
  showForHome: z.boolean().default(false),
  /** Show the current temperature on the other timezone cards. */
  showForZones: z.boolean().default(true),
  /** Temperature unit for every weather reading. */
  unit: z.enum(["fahrenheit", "celsius"]).default("fahrenheit"),
});
export type WeatherSettings = z.infer<typeof WeatherSettingsSchema>;

/**
 * The ambient ticker strips in the orientation band. Stocks need a free Finnhub
 * key (kept in Secrets); news reads Hacker News top stories with no key. Both
 * are off by default and render nothing until enabled and configured.
 */
export const TickerSettingsSchema = z.object({
  stocks: z
    .object({
      enabled: z.boolean().default(false),
      /** Ticker symbols, e.g. ["AAPL", "MSFT", "NVDA"]. */
      symbols: z.array(z.string()).default([]),
    })
    .default({ enabled: false, symbols: [] }),
  news: z
    .object({
      enabled: z.boolean().default(false),
      /** Active feed ids; old configs without this field default to Hacker News. */
      sources: z.array(z.string()).default(["hacker-news"]),
    })
    .default({ enabled: false, sources: ["hacker-news"] }),
});
export type TickerSettings = z.infer<typeof TickerSettingsSchema>;

export const ConfigSchema = z.object({
  /** Schema version, for future migrations. */
  version: z.number().int().positive().default(2),
  profile: ProfileSchema.default({}),
  zones: z.array(ZoneSchema).default([]),
  links: z.array(DockLinkSchema).default([]),
  connections: z.array(ConnectionSchema).default([]),
  streams: z.array(StreamSchema).default([]),
  wallpaper: WallpaperSchema.default({
    source: "gradient",
    frequency: "daily",
    terms: [],
    scrim: 0.4,
  }),
  appearance: AppearanceSchema.default({ hour12: true }),
  weather: WeatherSettingsSchema.default({
    showForHome: false,
    showForZones: true,
    unit: "fahrenheit",
  }),
  tickers: TickerSettingsSchema.default({
    stocks: { enabled: false, symbols: [] },
    news: { enabled: false },
  }),
  /** User-imported themes, selectable alongside the shipped ones. */
  customThemes: z.array(ThemeSchema).default([]),
});
export type Config = z.infer<typeof ConfigSchema>;

/**
 * A Google OAuth access token for one calendar connection, obtained per account
 * via chrome.identity.launchWebAuthFlow. Implicit-flow tokens are short-lived
 * (about an hour), so expiresAt drives a silent re-auth; email identifies the
 * account, both to show on the connection and as the login hint when refreshing.
 */
export const GoogleTokenSchema = z.object({
  accessToken: z.string(),
  /** Epoch milliseconds when the access token expires. */
  expiresAt: z.number(),
  email: z.string().optional(),
});
export type GoogleToken = z.infer<typeof GoogleTokenSchema>;

/** Secrets live in chrome.storage.local and are never synced. */
export const SecretsSchema = z.object({
  unsplashAccessKey: z.string().optional(),
  /** Per-connection credential (Linear key / Notion token), keyed by connection id. */
  connectionSecrets: z.record(z.string()).default({}),
  /** Per-connection Google access token, keyed by connection id. */
  googleTokens: z.record(GoogleTokenSchema).default({}),
  /** Free Finnhub API key for the stock ticker. */
  finnhubKey: z.string().optional(),
});
export type Secrets = z.infer<typeof SecretsSchema>;

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

/**
 * Migrate an old config (per-card config carried on connections) to the new
 * model (config on the cards). It runs before validation, since the slimmed
 * ConnectionSchema would otherwise strip the old fields before we can move them.
 * For each card, copy any missing card-config field from its base connection; for
 * a Linear inbox connection with no card, create one so it keeps showing. Pure
 * and idempotent: a new-model config passes through unchanged.
 */
export function migrateConfig(raw: unknown): unknown {
  const root = asRecord(raw);
  if (root === undefined) return raw;
  const connections = Array.isArray(root.connections) ? root.connections : undefined;
  const streams = Array.isArray(root.streams) ? root.streams : undefined;
  if (connections === undefined || streams === undefined) return raw;

  const connectionById = new Map<string, Record<string, unknown>>();
  for (const entry of connections) {
    const connection = asRecord(entry);
    if (connection !== undefined && typeof connection.id === "string") {
      connectionById.set(connection.id, connection);
    }
  }

  const nextStreams = streams.map((entry): unknown => {
    const stream = asRecord(entry);
    if (stream === undefined) return entry;
    const connection = typeof stream.connectionId === "string"
      ? connectionById.get(stream.connectionId)
      : undefined;
    if (connection === undefined) return stream;
    const merged = { ...stream };
    for (const key of CARD_CONFIG_KEYS) {
      if (merged[key] === undefined && connection[key] !== undefined) {
        merged[key] = connection[key];
      }
    }
    return merged;
  });

  // A Linear inbox connection used to feed the lane with no card of its own.
  const referenced = new Set(
    nextStreams
      .map((entry) => asRecord(entry)?.connectionId)
      .filter((id): id is string => typeof id === "string"),
  );
  for (const connection of connectionById.values()) {
    if (
      connection.service === "linear" &&
      connection.linearView === "inbox" &&
      !referenced.has(connection.id as string)
    ) {
      nextStreams.push({
        id: `card:${String(connection.id)}`,
        title: typeof connection.name === "string" ? connection.name : "Linear inbox",
        connectionId: connection.id,
        linearView: "inbox",
        collapsedByDefault: false,
      });
    }
  }

  return { ...root, streams: nextStreams };
}

/** Parse unknown storage data into a Config, falling back to defaults per field. */
export function parseConfig(raw: unknown): Config {
  const result = ConfigSchema.safeParse(migrateConfig(raw ?? {}));
  return result.success ? result.data : ConfigSchema.parse({});
}

export function parseSecrets(raw: unknown): Secrets {
  const result = SecretsSchema.safeParse(raw ?? {});
  return result.success ? result.data : SecretsSchema.parse({});
}

/** The home zone: the one flagged isHome, else the first, else undefined. */
export function homeZone(config: Config): Zone | undefined {
  return config.zones.find((zone) => zone.isHome === true) ?? config.zones[0];
}

/** Every zone except the home zone, in declared order. */
export function otherZones(config: Config): Zone[] {
  const home = homeZone(config);
  return config.zones.filter((zone) => zone.id !== home?.id);
}

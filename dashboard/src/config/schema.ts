import { z } from "zod";

import { isSafeUrl } from "../security/url";
import { ThemeSchema } from "../theme/tokens";

/** True when a string is a time zone Intl can format, so the render path (which
 *  calls Intl.DateTimeFormat with it) never throws on a typo'd or hostile zone. */
function isUsableTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}

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
  /** IANA time zone, e.g. "America/New_York". Rejected if Intl cannot format it,
   *  so a bad zone is dropped at parse rather than throwing during render. */
  timeZone: z.string().min(1).refine(isUsableTimeZone, { message: "unknown time zone" }),
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
  /** Scheme is checked here, at the storage boundary: a javascript:/data: link
   *  never reaches storage, not just the render/navigate guards downstream. */
  url: z.string().url().refine((value) => isSafeUrl(value), { message: "unsafe URL" }),
  /** Optional explicit icon; otherwise a favicon is resolved from the url. */
  iconUrl: z
    .string()
    .url()
    .refine((value) => isSafeUrl(value), { message: "unsafe URL" })
    .optional(),
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
   * notification inbox, projects, or initiatives. "projects-initiatives" merges
   * the projects and initiatives you created into one list; "favorites" lists
   * the items you have starred.
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
      "projects-initiatives",
      "favorites",
    ])
    .optional(),
  /** How many items to show. */
  count: z.number().int().positive().max(50).optional(),
});
export type SourceConfig = z.infer<typeof CardConfigSchema>;

/** A connection merged with a card's per-source config, as integrations read it. */
export type IntegrationSource = Connection & SourceConfig;

/**
 * One calendar chosen for a "Combine all calendars" card, qualified by the
 * account it lives in so calendars from different accounts never collide.
 */
export const CombineCalendarRefSchema = z.object({
  connectionId: z.string().min(1),
  calendarId: z.string().min(1),
});
export type CombineCalendarRef = z.infer<typeof CombineCalendarRefSchema>;

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
    /**
     * Which work-area column the card sits in. Layout, not source config, so it
     * stays on the stream and off IntegrationSource. Defaults to "right" so
     * existing configs keep today's layout (cards on the right, lane on the left)
     * after upgrade; the user drags a card to "left" to flow it under the lane.
     */
    column: z.enum(["left", "right"]).default("right"),
    /**
     * Position within the card's column on the new-tab surface. Set only by
     * on-surface drag; the Customize pane never touches it. Seeded from the
     * config order on upgrade (see migrateConfig) so layouts do not move.
     */
    order: z.number().int().nonnegative().default(0),
    /**
     * Combine card only (connectionId is the combined virtual id): the calendars
     * to merge, each qualified by its account. Empty or unset means every
     * calendar from every connected Google account, so the card works before the
     * user narrows it and keeps following accounts as they add calendars.
     */
    combineCalendars: z.array(CombineCalendarRefSchema).optional(),
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
  /** Informational schema version. Migration is driven by the data's shape (see
   *  migrateConfig), not by this number, so it is a marker, not a gate. */
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
 * Migrate an old config to the new model. It runs before validation, since the
 * slimmed ConnectionSchema would otherwise strip old fields before we can move
 * them. Two steps: (1) move per-card config off connections onto the cards, and
 * create a card for a Linear inbox connection that has none; (2) seed each card's
 * surface `order` from its config position so today's layout is preserved on
 * upgrade. Pure and idempotent: a new-model config passes through unchanged.
 */
export function migrateConfig(raw: unknown): unknown {
  const root = asRecord(raw);
  if (root === undefined) return raw;
  const streams = Array.isArray(root.streams) ? root.streams : undefined;
  if (streams === undefined) return raw;

  let nextStreams: unknown[] = streams;

  const connections = Array.isArray(root.connections) ? root.connections : undefined;
  if (connections !== undefined) {
    const connectionById = new Map<string, Record<string, unknown>>();
    for (const entry of connections) {
      const connection = asRecord(entry);
      if (connection !== undefined && typeof connection.id === "string") {
        connectionById.set(connection.id, connection);
      }
    }

    nextStreams = streams.map((entry): unknown => {
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
  }

  // Seed surface order from the array position when a card has none, so the
  // current arrangement carries over, and rename any legacy Linear view value so
  // configs saved before a rename keep validating. Existing orders are untouched.
  const seeded = nextStreams.map((entry, index): unknown => {
    const stream = asRecord(entry);
    if (stream === undefined) return entry;
    const next = { ...stream };
    // The merged projects + initiatives view was briefly "my-projects-initiatives".
    if (next.linearView === "my-projects-initiatives") {
      next.linearView = "projects-initiatives";
    }
    if (typeof next.order !== "number") next.order = index;
    return next;
  });

  return { ...root, streams: seeded };
}

/** Array sections whose bad entries are dropped individually. */
const ARRAY_SECTIONS: ReadonlyArray<readonly [string, z.ZodTypeAny]> = [
  ["zones", ZoneSchema],
  ["links", DockLinkSchema],
  ["connections", ConnectionSchema],
  ["streams", StreamSchema],
  ["customThemes", ThemeSchema],
];

/** Defaulted object sections whose whole value is dropped (so the schema default
 *  applies) rather than failing the parse. */
const OBJECT_SECTIONS: ReadonlyArray<readonly [string, z.ZodTypeAny]> = [
  ["profile", ProfileSchema],
  ["wallpaper", WallpaperSchema],
  ["appearance", AppearanceSchema],
  ["weather", WeatherSettingsSchema],
  ["tickers", TickerSettingsSchema],
];

/**
 * Drop only the entries that fail to validate, keeping everything else, so one
 * malformed zone, link, connection, card, custom theme, or settings block cannot
 * blank the whole dashboard. Bad array entries are filtered out; a bad defaulted
 * object section is removed so its default takes over.
 */
function pruneInvalidEntries(migrated: unknown): unknown {
  const root = asRecord(migrated);
  if (root === undefined) return migrated;
  const next = { ...root };
  for (const [key, schema] of ARRAY_SECTIONS) {
    const value = next[key];
    if (Array.isArray(value)) {
      next[key] = value.filter((entry) => schema.safeParse(entry).success);
    }
  }
  for (const [key, schema] of OBJECT_SECTIONS) {
    if (next[key] !== undefined && !schema.safeParse(next[key]).success) {
      delete next[key];
    }
  }
  if (next.version !== undefined && !z.number().int().positive().safeParse(next.version).success) {
    delete next.version;
  }
  return next;
}

/**
 * Parse unknown storage data into a Config, failing gracefully. A clean parse
 * wins; otherwise each malformed entry is dropped and the rest is kept, so a bad
 * zone, link, card, theme, or a field from a newer build never wipes a working
 * dashboard. A wholly unreadable blob falls back to the empty defaults.
 */
export function parseConfig(raw: unknown): Config {
  const migrated = migrateConfig(raw ?? {});
  const result = ConfigSchema.safeParse(migrated);
  if (result.success) return result.data;
  const retry = ConfigSchema.safeParse(pruneInvalidEntries(migrated));
  return retry.success ? retry.data : ConfigSchema.parse({});
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

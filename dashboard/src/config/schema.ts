import { z } from "zod";

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
 * What a work stream shows. Static text and a links group ship now; the
 * integration variant (Notion and friends) plugs in later without touching the
 * stream shell.
 */
export const StreamContentSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("static"), body: z.string().default("") }),
  z.object({ type: z.literal("links"), linkIds: z.array(z.string()).default([]) }),
  z.object({
    type: z.literal("integration"),
    integrationId: z.string().min(1),
    config: z.record(z.unknown()).default({}),
  }),
]);
export type StreamContent = z.infer<typeof StreamContentSchema>;

/** A collapsible titled section, collapsed by default. */
export const StreamSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  collapsedByDefault: z.boolean().default(true),
  content: StreamContentSchema,
});
export type Stream = z.infer<typeof StreamSchema>;

/** Background wallpaper sourced from Unsplash by search terms. */
export const WallpaperSchema = z.object({
  enabled: z.boolean().default(false),
  /** Search terms, one image picked per day/tab, e.g. ["San Francisco", "Lisbon"]. */
  terms: z.array(z.string()).default([]),
  /** 0 = no darkening, 1 = black. A readability scrim over the photo. */
  scrim: z.number().min(0).max(1).default(0.4),
});
export type Wallpaper = z.infer<typeof WallpaperSchema>;

export const AppearanceSchema = z.object({
  /** Theme id from the registry; falls back to the default theme. */
  theme: z.string().optional(),
  /** 12-hour clock when true, 24-hour when false. */
  hour12: z.boolean().default(true),
});
export type Appearance = z.infer<typeof AppearanceSchema>;

export const ProfileSchema = z.object({
  name: z.string().optional(),
});
export type Profile = z.infer<typeof ProfileSchema>;

export const ConfigSchema = z.object({
  /** Schema version, for future migrations. */
  version: z.number().int().positive().default(1),
  profile: ProfileSchema.default({}),
  zones: z.array(ZoneSchema).default([]),
  links: z.array(DockLinkSchema).default([]),
  streams: z.array(StreamSchema).default([]),
  wallpaper: WallpaperSchema.default({ enabled: false, terms: [], scrim: 0.4 }),
  appearance: AppearanceSchema.default({ hour12: true }),
});
export type Config = z.infer<typeof ConfigSchema>;

/** Secrets live in chrome.storage.local and are never synced. */
export const SecretsSchema = z.object({
  unsplashAccessKey: z.string().optional(),
  notionToken: z.string().optional(),
  linearApiKey: z.string().optional(),
});
export type Secrets = z.infer<typeof SecretsSchema>;

/** Parse unknown storage data into a Config, falling back to defaults per field. */
export function parseConfig(raw: unknown): Config {
  const result = ConfigSchema.safeParse(raw ?? {});
  return result.success ? result.data : ConfigSchema.parse({});
}

export function parseSecrets(raw: unknown): Secrets {
  const result = SecretsSchema.safeParse(raw ?? {});
  return result.success ? result.data : {};
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

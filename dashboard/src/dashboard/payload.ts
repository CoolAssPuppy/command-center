import { z } from "zod";

import { ManifestActionSchema } from "../domain/actions";
import { FeedEnvelopeSchema } from "../domain/feed";
import { IsoInstantSchema } from "../domain/primitives";

/**
 * The shapes the native handler returns from getDashboard. See
 * docs/05-native-app.md. A provider is a manifest plus the feeds it has
 * published. The dashboard renders entirely from this payload and never reaches
 * into the file system or holds a token.
 */

const ManifestFeedSchema = z.object({
  kind: z.string().min(1),
  path: z.string().optional(),
  refreshIntervalSeconds: z.number().int().nonnegative().optional(),
  title: z.string().optional(),
});

export const ManifestSchema = z.object({
  schemaVersion: z.number().int().positive(),
  providerId: z.string().min(1),
  displayName: z.string().min(1),
  bundleId: z.string().min(1),
  appVersion: z.string().optional(),
  icon: z.string().optional(),
  accentColorHex: z.string().optional(),
  updatedAt: IsoInstantSchema.optional(),
  feeds: z.array(ManifestFeedSchema),
  actions: z.array(ManifestActionSchema).optional(),
});
export type Manifest = z.infer<typeof ManifestSchema>;

export const ProviderEntrySchema = z.object({
  manifest: ManifestSchema,
  feeds: z.array(FeedEnvelopeSchema),
});
export type ProviderEntry = z.infer<typeof ProviderEntrySchema>;

/** Settings the composer reads. The full settings live in docs/08. */
export const SettingsSchema = z
  .object({
    schemaVersion: z.number().int().positive().optional(),
    profile: z.object({ name: z.string() }).optional(),
    layout: z
      .object({
        cardOrder: z.array(z.string()).optional(),
        hidden: z.array(z.string()).optional(),
      })
      .optional(),
    worldClock: z
      .object({
        baseTimeZone: z.string().optional(),
        cities: z.array(z.object({ label: z.string(), timeZone: z.string() })),
      })
      .optional(),
    weather: z
      .object({
        location: z.object({
          label: z.string(),
          lat: z.number(),
          lon: z.number(),
        }),
        units: z.enum(["fahrenheit", "celsius"]),
      })
      .optional(),
    // platform -> browser bundle id or "system"
    browserRouting: z.record(z.string(), z.string()).optional(),
  })
  .passthrough();
export type Settings = z.infer<typeof SettingsSchema>;

export const DashboardPayloadSchema = z.object({
  settings: SettingsSchema.optional(),
  providers: z.array(ProviderEntrySchema),
  generatedAt: IsoInstantSchema.optional(),
});
export type DashboardPayload = z.infer<typeof DashboardPayloadSchema>;

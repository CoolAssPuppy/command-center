import { z } from "zod";

import { GlanceSchema, IsoInstantSchema, StatusSchema } from "./primitives";

/**
 * The feed envelope every provider writes, regardless of transport. See
 * docs/03-provider-contract.md. Only `data` changes shape per kind. The
 * `glance` line is required on every feed.
 */

export const CURRENT_SCHEMA_VERSION = 1;

export const ProducedBySchema = z.object({
  bundleId: z.string().min(1),
  appVersion: z.string().min(1),
});

export const FeedEnvelopeSchema = z.object({
  schemaVersion: z.number().int().positive(),
  providerId: z.string().min(1),
  kind: z.string().min(1),
  producedBy: ProducedBySchema.optional(),
  updatedAt: IsoInstantSchema,
  ttlSeconds: z.number().int().nonnegative().optional(),
  status: StatusSchema,
  glance: GlanceSchema,
  // `data` is validated per-kind by the convenience-kind schemas or the card
  // schema, not here. The envelope stays kind-agnostic.
  data: z.unknown(),
});
export type FeedEnvelope = z.infer<typeof FeedEnvelopeSchema>;

/**
 * Parse an unknown value as a feed envelope. Returns a discriminated result so
 * callers handle failure explicitly rather than throwing. A feed whose
 * schemaVersion is newer than this build understands is rejected, so a future
 * provider never renders as if it were current.
 */
export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export function parseFeedEnvelope(input: unknown): ParseResult<FeedEnvelope> {
  const parsed = FeedEnvelopeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid feed" };
  }
  if (parsed.data.schemaVersion > CURRENT_SCHEMA_VERSION) {
    return {
      ok: false,
      error: `unsupported schemaVersion ${parsed.data.schemaVersion}`,
    };
  }
  return { ok: true, value: parsed.data };
}

/**
 * Whether a feed's data should be treated as fresh, based on updatedAt and
 * ttlSeconds. A stale feed is still rendered, with an age note.
 */
export function isFeedFresh(envelope: FeedEnvelope, now: Date): boolean {
  if (envelope.ttlSeconds === undefined) return true;
  const updated = Date.parse(envelope.updatedAt);
  const ageSeconds = (now.getTime() - updated) / 1000;
  return ageSeconds <= envelope.ttlSeconds;
}

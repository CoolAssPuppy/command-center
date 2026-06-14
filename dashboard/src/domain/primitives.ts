import { z } from "zod";

/**
 * Shared low-level value types used across the contract. These mirror the
 * vocabulary in docs/13-representation-model.md and the envelope in
 * docs/03-provider-contract.md. Everything here is validated at runtime so a
 * malformed feed from a provider is rejected, not rendered.
 */

/** Semantic emphasis. The theme maps each tone to a concrete color. */
export const ToneSchema = z.enum(["neutral", "positive", "urgent"]);
export type Tone = z.infer<typeof ToneSchema>;

/** Direction of change for a metric or glance. */
export const TrendSchema = z.enum(["up", "down", "flat"]);
export type Trend = z.infer<typeof TrendSchema>;

/**
 * Feed freshness and auth state. Drives how a card is rendered:
 * `ok` shows data, `stale` shows data with an age note, `needs_auth` prompts a
 * reconnect, `error` shows a quiet error, `disabled` hides the card.
 */
export const StatusSchema = z.enum([
  "ok",
  "stale",
  "needs_auth",
  "error",
  "disabled",
]);
export type Status = z.infer<typeof StatusSchema>;

/** Preferred card footprint. The attention model has the final say. */
export const SizeSchema = z.enum(["small", "medium", "large"]);
export type Size = z.infer<typeof SizeSchema>;

/**
 * The one-line summary every feed must carry. It is what the platform shows
 * when a card is collapsed, demoted, or in a dense layout.
 */
export const GlanceSchema = z.object({
  value: z.string().min(1),
  label: z.string(),
  tone: ToneSchema.optional(),
  trend: TrendSchema.optional(),
});
export type Glance = z.infer<typeof GlanceSchema>;

/** ISO 8601 instant. Validated as a parseable date, kept as a string. */
export const IsoInstantSchema = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "must be an ISO 8601 date-time",
  });

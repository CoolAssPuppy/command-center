import { z } from "zod";

/**
 * A discriminated result so callers handle failure explicitly rather than
 * throwing. Shared by the network clients (weather, integrations) and any other
 * parse that can fail. See the weather client and the integration platform.
 */
export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

/** The first Zod issue message, or a fallback. Shared by all schema parsers. */
export function firstIssue(error: z.ZodError, fallback: string): string {
  return error.issues[0]?.message ?? fallback;
}

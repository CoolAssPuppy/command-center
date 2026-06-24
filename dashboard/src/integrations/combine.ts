import type { Connection } from "../config/schema";
import type { IntegrationResult } from "./types";

/**
 * Merge several Google Calendar connections' results into one, for the "Combine
 * all calendars" Work stream. Events from every connected calendar are pooled
 * and sorted by start time. Status is optimistic: if any calendar loaded, the
 * merged stream is ok; otherwise it reflects loading, then needs-auth, then an
 * error, so one disconnected calendar never blanks the rest.
 */
export function combineCalendars(
  calendars: Connection[],
  results: Record<string, IntegrationResult>,
): IntegrationResult {
  const present = calendars
    .map((calendar) => results[calendar.id])
    .filter((result): result is IntegrationResult => result !== undefined);

  if (present.some((result) => result.status === "ok")) {
    const items = present
      .filter((result) => result.status === "ok")
      .flatMap((result) => result.items ?? [])
      .sort((a, b) => (a.sortKey ?? "").localeCompare(b.sortKey ?? ""));
    return { status: "ok", items };
  }
  if (present.some((result) => result.status === "loading")) {
    return { status: "loading" };
  }
  if (present.length === 0 || present.some((result) => result.status === "needs_auth")) {
    return { status: "needs_auth" };
  }
  return { status: "error", error: "Could not load calendars" };
}

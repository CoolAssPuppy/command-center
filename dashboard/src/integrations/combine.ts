import type { IntegrationResult } from "./types";

/**
 * Merge several Google Calendar results into one, for the "Combine all calendars"
 * Data Card. Events from every connected calendar are pooled and sorted by start
 * time. Status is optimistic: if any calendar loaded, the merged card is ok;
 * otherwise it reflects loading, then needs-auth, then an error, so one
 * disconnected calendar never blanks the rest.
 */
export function combineCalendars(
  results: ReadonlyArray<IntegrationResult | undefined>,
): IntegrationResult {
  const present = results.filter(
    (result): result is IntegrationResult => result !== undefined,
  );

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

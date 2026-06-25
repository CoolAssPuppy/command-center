import type { CombineCalendarRef } from "../config/schema";
import type { IntegrationResult } from "./types";

/** One account's calendars to fetch for a combined view, after resolution. */
export interface CombineTarget {
  connectionId: string;
  calendarIds: string[];
}

/**
 * Group a Combine card's stored (connection, calendar) selection into one fetch
 * per account. Entries whose connection is no longer present are dropped and each
 * account's ids are deduped. Output order follows connectionOrder so the merged
 * card is stable across renders.
 */
export function groupCombineSelection(
  selection: ReadonlyArray<CombineCalendarRef>,
  connectionOrder: ReadonlyArray<string>,
): CombineTarget[] {
  const order = new Map(connectionOrder.map((id, index) => [id, index]));
  const byConnection = new Map<string, string[]>();
  for (const { connectionId, calendarId } of selection) {
    if (!order.has(connectionId)) continue;
    const ids = byConnection.get(connectionId) ?? [];
    if (!ids.includes(calendarId)) ids.push(calendarId);
    byConnection.set(connectionId, ids);
  }
  return [...byConnection.entries()]
    .sort((a, b) => (order.get(a[0]) ?? 0) - (order.get(b[0]) ?? 0))
    .map(([connectionId, calendarIds]) => ({ connectionId, calendarIds }));
}

/**
 * Decide which calendars a Combine card should fetch. A stored selection is
 * authoritative (grouped per account). With no selection the default is every
 * calendar from every account, discovered via listCalendars; an account whose
 * list cannot be read still contributes its primary so it is never silently lost.
 */
export async function resolveCombineTargets(
  selection: ReadonlyArray<CombineCalendarRef>,
  connectionIds: ReadonlyArray<string>,
  listCalendars: (connectionId: string) => Promise<string[] | undefined>,
): Promise<CombineTarget[]> {
  if (selection.length > 0) {
    return groupCombineSelection(selection, connectionIds);
  }
  return Promise.all(
    connectionIds.map(async (connectionId) => {
      const ids = await listCalendars(connectionId);
      return {
        connectionId,
        calendarIds: ids !== undefined && ids.length > 0 ? ids : ["primary"],
      };
    }),
  );
}

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

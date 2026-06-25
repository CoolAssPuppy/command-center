import type { HttpFetch } from "./types";

/** One entry from a Google account's calendar list. */
export interface CalendarListEntry {
  id: string;
  summary?: string;
}

const CALENDAR_LIST_URL = "https://www.googleapis.com/calendar/v3/users/me/calendarList";

/**
 * Fetch one Google account's calendar list with its own access token. Returns
 * undefined on any failure (missing scope, network error, unexpected shape) so a
 * single unreachable account never blanks a picker or a combined card.
 */
export async function fetchGoogleCalendarList(
  fetch: HttpFetch,
  accessToken: string,
): Promise<CalendarListEntry[] | undefined> {
  try {
    const response = await fetch({
      url: CALENDAR_LIST_URL,
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return undefined;
    const body = (await response.json()) as { items?: unknown };
    if (!Array.isArray(body.items)) return undefined;
    const entries: CalendarListEntry[] = [];
    for (const raw of body.items) {
      if (typeof raw !== "object" || raw === null) continue;
      const item = raw as { id?: unknown; summary?: unknown };
      if (typeof item.id !== "string") continue;
      entries.push(
        typeof item.summary === "string"
          ? { id: item.id, summary: item.summary }
          : { id: item.id },
      );
    }
    return entries;
  } catch {
    return undefined;
  }
}

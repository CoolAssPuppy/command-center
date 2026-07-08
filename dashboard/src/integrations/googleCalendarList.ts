import { z } from "zod";

import type { HttpFetch } from "./types";

/** One entry from a Google account's calendar list. */
export interface CalendarListEntry {
  id: string;
  summary?: string;
}

const CALENDAR_LIST_URL = "https://www.googleapis.com/calendar/v3/users/me/calendarList";

// Validate the response like every other integration, rather than hand-rolling
// `as` casts. Entries are validated one at a time so a single malformed calendar
// is dropped rather than discarding the whole list.
const CalendarListSchema = z.object({ items: z.array(z.unknown()).optional() });
const EntrySchema = z.object({
  id: z.string(),
  summary: z.string().optional().catch(undefined),
});

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
    const parsed = CalendarListSchema.safeParse(await response.json());
    if (!parsed.success) return undefined;
    return (parsed.data.items ?? []).flatMap((raw) => {
      const entry = EntrySchema.safeParse(raw);
      if (!entry.success) return [];
      const { id, summary } = entry.data;
      return [summary !== undefined ? { id, summary } : { id }];
    });
  } catch {
    return undefined;
  }
}

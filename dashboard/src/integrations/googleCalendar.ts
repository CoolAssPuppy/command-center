import { z } from "zod";

import type { Connection } from "../config/schema";
import { firstIssue, type ParseResult } from "../domain/result";
import {
  NEEDS_AUTH,
  type Integration,
  type IntegrationContext,
  type NormalizedItem,
} from "./types";

/**
 * The Google Calendar integration. Google supports OAuth from an extension with
 * no server via chrome.identity, so the platform supplies a token through
 * ctx.getAuthToken("google") and the connection's secret is unused. It lists
 * upcoming events from the connection's calendar and normalizes each.
 */
const API_BASE = "https://www.googleapis.com/calendar/v3/calendars";

const EventSchema = z.object({
  id: z.string(),
  summary: z.string().optional(),
  htmlLink: z.string().optional(),
  location: z.string().optional(),
  start: z
    .object({ dateTime: z.string().optional(), date: z.string().optional() })
    .optional(),
});

const ResponseSchema = z.object({ items: z.array(EventSchema).optional() });

/** Local calendar date as YYYY-MM-DD, for comparing an event's day to today. */
function localDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA").format(date);
}

/**
 * A short day prefix for events that are not today, so an event two weeks out
 * never looks like it is happening now. Undefined when the event is today.
 * Weekday within the coming week, then month and day beyond it.
 */
function dayPrefix(eventDate: Date, now: Date): string | undefined {
  const eventKey = localDateKey(eventDate);
  if (eventKey === localDateKey(now)) return undefined;
  const dayMs = 86_400_000;
  const eventMidnight = new Date(`${eventKey}T00:00:00`).getTime();
  const todayMidnight = new Date(`${localDateKey(now)}T00:00:00`).getTime();
  const diffDays = Math.round((eventMidnight - todayMidnight) / dayMs);
  const options: Intl.DateTimeFormatOptions =
    diffDays >= 1 && diffDays <= 6
      ? { weekday: "short" }
      : { month: "short", day: "numeric" };
  return new Intl.DateTimeFormat(undefined, options).format(eventDate);
}

function formatWhen(
  start: z.infer<typeof EventSchema>["start"],
  now: Date,
): string | undefined {
  if (start === undefined) return undefined;
  if (start.dateTime !== undefined) {
    const date = new Date(start.dateTime);
    if (Number.isNaN(date.getTime())) return undefined;
    const time = new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
    const prefix = dayPrefix(date, now);
    return prefix !== undefined ? `${prefix}, ${time}` : time;
  }
  if (start.date !== undefined) {
    // start.date is a bare calendar date; noon avoids time-zone day drift.
    const prefix = dayPrefix(new Date(`${start.date}T12:00:00`), now);
    return prefix !== undefined ? `${prefix}, all day` : "All day";
  }
  return undefined;
}

/** Midnight at the start of the viewer's local day, as an absolute instant. */
function startOfLocalDay(now: Date): Date {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return start;
}

function buildUrl(connection: Connection, now: Date): string {
  const calendarId = connection.calendarId ?? "primary";
  const url = new URL(`${API_BASE}/${encodeURIComponent(calendarId)}/events`);
  // Start at the top of today, not the current moment, so events earlier today
  // still show instead of being skipped in favor of ones days or weeks out.
  url.searchParams.set("timeMin", startOfLocalDay(now).toISOString());
  url.searchParams.set("maxResults", String(connection.count ?? 6));
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  return url.toString();
}

export const googleCalendarIntegration: Integration = {
  id: "google-calendar",
  displayName: "Google Calendar",

  async fetch(
    connection: Connection,
    _secret: string | undefined,
    ctx: IntegrationContext,
  ): Promise<ParseResult<NormalizedItem[]>> {
    const token = await ctx.getAuthToken?.("google");
    if (token === undefined || token.length === 0) {
      return { ok: false, error: NEEDS_AUTH };
    }

    let payload: unknown;
    try {
      const response = await ctx.fetch({
        url: buildUrl(connection, ctx.now),
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.status === 401 || response.status === 403) {
        return { ok: false, error: NEEDS_AUTH };
      }
      if (!response.ok) {
        return { ok: false, error: `Calendar request failed (${response.status})` };
      }
      payload = await response.json();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Calendar request failed";
      return { ok: false, error: message };
    }

    const result = ResponseSchema.safeParse(payload);
    if (!result.success) {
      return { ok: false, error: firstIssue(result.error, "invalid calendar response") };
    }

    const items: NormalizedItem[] = (result.data.items ?? []).map((event) => {
      const item: NormalizedItem = {
        id: event.id,
        title: event.summary ?? "(no title)",
      };
      const when = formatWhen(event.start, ctx.now);
      if (when !== undefined) item.subtitle = when;
      if (event.htmlLink !== undefined) item.url = event.htmlLink;
      if (event.location !== undefined) item.meta = event.location;
      const startKey = event.start?.dateTime ?? event.start?.date;
      if (startKey !== undefined) item.sortKey = startKey;
      return item;
    });
    return { ok: true, value: items };
  },
};

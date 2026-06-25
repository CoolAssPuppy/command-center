import { z } from "zod";

import type { Connection } from "../config/schema";
import { firstIssue, type ParseResult } from "../domain/result";
import { detectConference } from "./conference";
import { parseGoogleCalendarIds } from "./googleCalendarLink";
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
 * today's events from the connection's calendar, plus any extra calendars added
 * by share link, merged and sorted by start time.
 */
const API_BASE = "https://www.googleapis.com/calendar/v3/calendars";

const EventSchema = z.object({
  id: z.string(),
  summary: z.string().optional(),
  htmlLink: z.string().optional(),
  location: z.string().optional(),
  description: z.string().optional(),
  hangoutLink: z.string().optional(),
  conferenceData: z
    .object({
      entryPoints: z
        .array(z.object({ entryPointType: z.string().optional(), uri: z.string().optional() }))
        .optional(),
    })
    .optional(),
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
  if (diffDays === 1) return "Tomorrow";
  const options: Intl.DateTimeFormatOptions =
    diffDays >= 2 && diffDays <= 6
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

const ROLLOVER_HOUR = 17;

/**
 * The exclusive end of the window: tomorrow's midnight, so the card covers all
 * of today. Once it is past 5pm the day is winding down, so it extends through
 * tomorrow as well rather than leaving a near-empty card.
 */
function windowEnd(now: Date): Date {
  const end = startOfLocalDay(now);
  const daysAhead = now.getHours() >= ROLLOVER_HOUR ? 2 : 1;
  end.setDate(end.getDate() + daysAhead);
  return end;
}

function buildUrl(calendarId: string, connection: Connection, now: Date): string {
  const url = new URL(`${API_BASE}/${encodeURIComponent(calendarId)}/events`);
  // Start at the top of today, not the current moment, so events earlier today
  // still show. Cap the window at today (and tomorrow after 5pm) so the card
  // never reaches days or weeks ahead just to fill its item count.
  url.searchParams.set("timeMin", startOfLocalDay(now).toISOString());
  url.searchParams.set("timeMax", windowEnd(now).toISOString());
  url.searchParams.set("maxResults", String(connection.count ?? 6));
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  return url.toString();
}

/**
 * The calendars this connection reads. The multi-select is authoritative: when
 * calendarIds is set, read exactly those (deduped). Only when it is empty do we
 * fall back to the single calendarId, or "primary".
 */
function calendarIdsFor(connection: Connection): string[] {
  const chosen = (connection.calendarIds ?? []).flatMap(parseGoogleCalendarIds);
  if (chosen.length > 0) return [...new Set(chosen)];
  const main = connection.calendarId?.trim();
  return [main !== undefined && main.length > 0 ? main : "primary"];
}

type CalendarFetch =
  | { kind: "ok"; items: NormalizedItem[] }
  | { kind: "auth" }
  | { kind: "error"; error: string };

function toItem(event: z.infer<typeof EventSchema>, now: Date): NormalizedItem {
  const item: NormalizedItem = {
    id: event.id,
    title: event.summary ?? "(no title)",
  };
  const when = formatWhen(event.start, now);
  if (when !== undefined) item.subtitle = when;
  if (event.htmlLink !== undefined) item.url = event.htmlLink;
  if (event.location !== undefined) item.meta = event.location;
  const startKey = event.start?.dateTime ?? event.start?.date;
  if (startKey !== undefined) item.sortKey = startKey;
  // A timed event about to start (or just started) is the most pressing thing
  // on the calendar, so lift it into the "needs you" lane and carry its exact
  // start for a live countdown.
  if (event.start?.dateTime !== undefined) {
    const startMs = Date.parse(event.start.dateTime);
    if (!Number.isNaN(startMs)) {
      item.startMs = startMs;
      const minutesAway = (startMs - now.getTime()) / 60_000;
      if (minutesAway >= -5 && minutesAway <= 30) item.tone = "urgent";
    }
  }

  const videoUris = (event.conferenceData?.entryPoints ?? [])
    .filter((point) => point.entryPointType === "video" && point.uri !== undefined)
    .map((point) => point.uri ?? "");
  const conference = detectConference({
    ...(event.hangoutLink !== undefined ? { hangoutLink: event.hangoutLink } : {}),
    entryPointUris: videoUris,
    texts: [event.location, event.description].filter((text): text is string => text !== undefined),
  });
  if (conference !== undefined) {
    item.joinUrl = conference.joinUrl;
    item.conferenceProvider = conference.provider;
  }
  return item;
}

async function fetchCalendar(
  calendarId: string,
  token: string,
  connection: Connection,
  ctx: IntegrationContext,
): Promise<CalendarFetch> {
  let payload: unknown;
  try {
    const response = await ctx.fetch({
      url: buildUrl(calendarId, connection, ctx.now),
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.status === 401 || response.status === 403) return { kind: "auth" };
    if (!response.ok) {
      return { kind: "error", error: `Calendar request failed (${response.status})` };
    }
    payload = await response.json();
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Calendar request failed";
    return { kind: "error", error: message };
  }

  const result = ResponseSchema.safeParse(payload);
  if (!result.success) {
    return { kind: "error", error: firstIssue(result.error, "invalid calendar response") };
  }
  return { kind: "ok", items: (result.data.items ?? []).map((event) => toItem(event, ctx.now)) };
}

export const googleCalendarIntegration: Integration = {
  id: "google-calendar",
  displayName: "Google Calendar",

  async fetch(
    connection: Connection,
    _secret: string | undefined,
    ctx: IntegrationContext,
  ): Promise<ParseResult<NormalizedItem[]>> {
    const token = await ctx.getAuthToken?.("google", connection.id);
    if (token === undefined || token.length === 0) {
      return { ok: false, error: NEEDS_AUTH };
    }

    const fetched = await Promise.all(
      calendarIdsFor(connection).map((calendarId) =>
        fetchCalendar(calendarId, token, connection, ctx),
      ),
    );

    // Optimistic merge: as long as one calendar loaded, show it. A calendar the
    // account cannot read (a bad link) is skipped rather than blanking the card.
    if (fetched.some((result) => result.kind === "ok")) {
      const items = fetched
        .flatMap((result) => (result.kind === "ok" ? result.items : []))
        .sort((a, b) => (a.sortKey ?? "").localeCompare(b.sortKey ?? ""))
        .slice(0, connection.count ?? 6);
      return { ok: true, value: items };
    }
    if (fetched.some((result) => result.kind === "auth")) {
      return { ok: false, error: NEEDS_AUTH };
    }
    const failure = fetched.find((result) => result.kind === "error");
    return {
      ok: false,
      error: failure?.kind === "error" ? failure.error : "Calendar request failed",
    };
  },
};

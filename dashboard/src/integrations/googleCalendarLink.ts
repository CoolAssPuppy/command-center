/**
 * Turn whatever a user pastes for a Google Calendar into calendar id(s) the
 * Calendar API understands. Google's "Integrate calendar" panel offers three
 * shapes, and people also paste a bare id or email:
 *
 *   - Public URL:  https://calendar.google.com/calendar/u/0?cid=<base64 id>
 *   - Embed code:  https://calendar.google.com/calendar/embed?src=<id>&src=<id>
 *   - iCal feed:   https://calendar.google.com/calendar/ical/<id>/private-x/basic.ics
 *   - Bare id:     en.usa#holiday@group.v.calendar.google.com  (or your email)
 *
 * An embed link can carry several calendars, so this returns a list.
 */

/** Decode a `cid` value (base64/base64url of the calendar id), if it decodes. */
function decodeCid(cid: string): string | undefined {
  let base64 = cid.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 !== 0) base64 += "=";
  try {
    const decoded = atob(base64);
    // A real calendar id is an address; if it doesn't look like one, the cid
    // was not base64 after all, so let the caller fall back to the raw value.
    return decoded.includes("@") ? decoded : undefined;
  } catch {
    return undefined;
  }
}

export function parseGoogleCalendarIds(input: string): string[] {
  const raw = input.trim();
  if (raw.length === 0) return [];
  if (!/^https?:\/\//i.test(raw)) return [raw];

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return [raw];
  }

  const sources = url.searchParams.getAll("src").filter((value) => value.length > 0);
  if (sources.length > 0) return sources;

  const cid = url.searchParams.get("cid");
  if (cid !== null && cid.length > 0) return [decodeCid(cid) ?? cid];

  const ical = url.pathname.match(/\/calendar\/ical\/([^/]+)\//);
  if (ical !== null && ical[1] !== undefined) return [decodeURIComponent(ical[1])];

  return [raw];
}

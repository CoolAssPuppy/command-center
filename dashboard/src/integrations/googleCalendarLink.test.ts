import { describe, expect, it } from "vitest";

import { parseGoogleCalendarIds } from "./googleCalendarLink";

describe("parseGoogleCalendarIds", () => {
  it("passes a bare id or email through unchanged", () => {
    expect(parseGoogleCalendarIds("team@group.calendar.google.com")).toEqual([
      "team@group.calendar.google.com",
    ]);
    expect(parseGoogleCalendarIds("primary")).toEqual(["primary"]);
  });

  it("trims whitespace and ignores empty input", () => {
    expect(parseGoogleCalendarIds("  primary  ")).toEqual(["primary"]);
    expect(parseGoogleCalendarIds("   ")).toEqual([]);
  });

  it("reads the src of an embed link, including several calendars", () => {
    const link =
      "https://calendar.google.com/calendar/embed?src=a%40group.calendar.google.com&src=b%40group.calendar.google.com";
    expect(parseGoogleCalendarIds(link)).toEqual([
      "a@group.calendar.google.com",
      "b@group.calendar.google.com",
    ]);
  });

  it("decodes the cid of a public url", () => {
    const id = "en.usa#holiday@group.v.calendar.google.com";
    const cid = btoa(id);
    const link = `https://calendar.google.com/calendar/u/0?cid=${cid}`;
    expect(parseGoogleCalendarIds(link)).toEqual([id]);
  });

  it("reads the id out of an iCal feed url", () => {
    const link =
      "https://calendar.google.com/calendar/ical/team%40group.calendar.google.com/private-abc/basic.ics";
    expect(parseGoogleCalendarIds(link)).toEqual(["team@group.calendar.google.com"]);
  });
});

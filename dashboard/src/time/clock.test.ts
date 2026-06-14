import { describe, expect, it } from "vitest";

import {
  cityClock,
  dateOffsetDays,
  dayNight,
  formatClock,
  relativeOffsetMinutes,
  tzOffsetMinutes,
  zonedTime,
} from "./clock";

// A fixed instant. June, so the US and UK are on summer time.
const T1 = new Date("2026-06-14T16:41:00Z");
// Late UTC, so zones east of the date line have rolled to the next day.
const T2 = new Date("2026-06-14T23:30:00Z");

const LA = "America/Los_Angeles";
const LONDON = "Europe/London";
const KOLKATA = "Asia/Kolkata";

describe("zonedTime", () => {
  it("reads the wall clock in a given zone for a fixed instant", () => {
    expect(zonedTime(T1, LA)).toEqual({
      hour: 9,
      minute: 41,
      isoDate: "2026-06-14",
    });
  });

  it("handles a half-hour offset zone", () => {
    expect(zonedTime(T1, KOLKATA)).toEqual({
      hour: 22,
      minute: 11,
      isoDate: "2026-06-14",
    });
  });
});

describe("tzOffsetMinutes", () => {
  it("returns minutes east of UTC, negative for the Americas", () => {
    expect(tzOffsetMinutes(T1, LA)).toBe(-420); // PDT, UTC-7
    expect(tzOffsetMinutes(T1, LONDON)).toBe(60); // BST, UTC+1
    expect(tzOffsetMinutes(T1, KOLKATA)).toBe(330); // UTC+5:30
  });
});

describe("relativeOffsetMinutes", () => {
  it("is the difference between a city and the base zone", () => {
    expect(relativeOffsetMinutes(T1, LONDON, LA)).toBe(480); // 8 hours ahead
    expect(relativeOffsetMinutes(T1, LA, LA)).toBe(0);
  });
});

describe("dateOffsetDays", () => {
  it("is zero when both zones share a calendar date", () => {
    expect(dateOffsetDays(T1, KOLKATA, LA)).toBe(0);
  });

  it("is plus one when the city has rolled into the next day", () => {
    expect(dateOffsetDays(T2, KOLKATA, LA)).toBe(1);
  });

  it("is minus one in the opposite direction", () => {
    expect(dateOffsetDays(T2, LA, KOLKATA)).toBe(-1);
  });
});

describe("dayNight", () => {
  it("uses default bands of 6 to 18", () => {
    expect(dayNight(T1, LA)).toBe("day"); // 09:41
    expect(dayNight(T1, KOLKATA)).toBe("night"); // 22:11
  });

  it("honors custom sunrise and sunset hours", () => {
    expect(dayNight(T1, KOLKATA, { sunsetHour: 23 })).toBe("day"); // 22 < 23
  });

  it("treats the sunset hour as the start of night", () => {
    expect(dayNight(T1, KOLKATA, { sunriseHour: 6, sunsetHour: 22 })).toBe(
      "night",
    ); // 22 is not before 22
  });
});

describe("formatClock", () => {
  it("formats a readable local time", () => {
    const formatted = formatClock(T1, LA);
    expect(formatted).toMatch(/9:41/);
    expect(formatted).toMatch(/AM/);
  });
});

describe("cityClock", () => {
  it("composes the full per-city view used by the world clock", () => {
    const clock = cityClock(T1, KOLKATA, LA, { label: "Bengaluru" });

    expect(clock).toEqual({
      timeZone: KOLKATA,
      label: "Bengaluru",
      hour: 22,
      minute: 11,
      dayNight: "night",
      dateOffsetDays: 0,
      relativeOffsetMinutes: 750, // +5:30 minus -7:00 = 12:30 = 750 min
    });
  });

  it("omits the label when none is given", () => {
    const clock = cityClock(T1, LA, LA);
    expect(clock.label).toBeUndefined();
    expect(clock.relativeOffsetMinutes).toBe(0);
  });
});

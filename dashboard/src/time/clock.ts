/**
 * The time engine for the world clock. Every function takes an explicit instant
 * (a Date) so it is pure and deterministic: the same instant and zone always
 * give the same result, which makes the world clock fully testable. Nothing
 * here reads the system clock. See docs/07-dashboard-ui.md.
 */

export type DayNight = "day" | "night";

export interface ZonedTime {
  /** Hour in the zone, 0 to 23. */
  hour: number;
  /** Minute in the zone, 0 to 59. */
  minute: number;
  /** Local calendar date in the zone, YYYY-MM-DD. */
  isoDate: string;
}

export interface DayNightOptions {
  /** Hour the day begins, inclusive. Default 6. */
  sunriseHour?: number;
  /** Hour night begins, exclusive of day. Default 18. */
  sunsetHour?: number;
}

export interface CityClock {
  timeZone: string;
  label?: string;
  hour: number;
  minute: number;
  dayNight: DayNight;
  /** Calendar-day difference from the base zone: +1, 0, -1, and so on. */
  dateOffsetDays: number;
  /** Minutes this city is ahead of the base zone at this instant. */
  relativeOffsetMinutes: number;
}

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function zonedParts(instant: Date, timeZone: string): ZonedParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const values: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = {};
  for (const part of formatter.formatToParts(instant)) {
    if (part.type !== "literal") values[part.type] = part.value;
  }

  const num = (key: Intl.DateTimeFormatPartTypes): number => {
    const raw = values[key];
    if (raw === undefined) {
      throw new Error(`time zone ${timeZone} produced no ${key}`);
    }
    return Number(raw);
  };

  return {
    year: num("year"),
    month: num("month"),
    day: num("day"),
    hour: num("hour"),
    minute: num("minute"),
    second: num("second"),
  };
}

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

export function zonedTime(instant: Date, timeZone: string): ZonedTime {
  const parts = zonedParts(instant, timeZone);
  return {
    hour: parts.hour,
    minute: parts.minute,
    isoDate: `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`,
  };
}

/** Minutes the zone is offset from UTC at this instant. East is positive. */
export function tzOffsetMinutes(instant: Date, timeZone: string): number {
  const parts = zonedParts(instant, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return Math.round((asUtc - instant.getTime()) / 60_000);
}

export function relativeOffsetMinutes(
  instant: Date,
  timeZone: string,
  baseTimeZone: string,
): number {
  return tzOffsetMinutes(instant, timeZone) - tzOffsetMinutes(instant, baseTimeZone);
}

export function dateOffsetDays(
  instant: Date,
  timeZone: string,
  baseTimeZone: string,
): number {
  const cityDate = zonedTime(instant, timeZone).isoDate;
  const baseDate = zonedTime(instant, baseTimeZone).isoDate;
  const cityMs = Date.parse(`${cityDate}T00:00:00Z`);
  const baseMs = Date.parse(`${baseDate}T00:00:00Z`);
  return Math.round((cityMs - baseMs) / 86_400_000);
}

export function dayNight(
  instant: Date,
  timeZone: string,
  options: DayNightOptions = {},
): DayNight {
  const sunriseHour = options.sunriseHour ?? 6;
  const sunsetHour = options.sunsetHour ?? 18;
  const { hour } = zonedTime(instant, timeZone);
  return hour >= sunriseHour && hour < sunsetHour ? "day" : "night";
}

export function formatClock(
  instant: Date,
  timeZone: string,
  options: { hour12?: boolean } = {},
): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: options.hour12 ?? true,
  }).format(instant);
}

export function cityClock(
  instant: Date,
  timeZone: string,
  baseTimeZone: string,
  options: { label?: string } & DayNightOptions = {},
): CityClock {
  const { hour, minute } = zonedTime(instant, timeZone);
  const clock: CityClock = {
    timeZone,
    hour,
    minute,
    dayNight: dayNight(instant, timeZone, options),
    dateOffsetDays: dateOffsetDays(instant, timeZone, baseTimeZone),
    relativeOffsetMinutes: relativeOffsetMinutes(instant, timeZone, baseTimeZone),
  };
  if (options.label !== undefined) clock.label = options.label;
  return clock;
}

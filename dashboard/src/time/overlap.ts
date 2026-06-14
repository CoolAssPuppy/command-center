import type { City } from "../cities/cities";

import { relativeOffsetMinutes, zonedTime } from "./clock";

/**
 * The maths behind the overlap timeline. Everything is expressed as fractions of
 * a 24-hour day on a shared reference axis (the viewer's local zone), so a city
 * whose working day wraps past midnight on that axis simply yields two segments.
 * The shared overlap is where every city is simultaneously at work, which is the
 * answer to "when can we all meet". All functions are pure and instant-driven.
 */

export interface Band {
  /** Left edge as a 0..1 fraction of the 24h axis. */
  left: number;
  /** Width as a 0..1 fraction of the 24h axis. */
  width: number;
}

/** A city's working hours projected onto the reference axis, split if it wraps. */
export function workingBands(now: Date, city: City, referenceTimeZone: string): Band[] {
  const offsetHours =
    relativeOffsetMinutes(now, city.timeZone, referenceTimeZone) / 60;
  const length = city.workingHours.end - city.workingHours.start;
  let start = (((city.workingHours.start - offsetHours) % 24) + 24) % 24;

  const bands: Band[] = [];
  let remaining = length;
  while (remaining > 0.0001) {
    const segment = Math.min(remaining, 24 - start);
    bands.push({ left: start / 24, width: segment / 24 });
    remaining -= segment;
    start = 0;
  }
  return bands;
}

/** The current time as a 0..1 fraction of the reference axis. */
export function nowFraction(now: Date, referenceTimeZone: string): number {
  const { hour, minute } = zonedTime(now, referenceTimeZone);
  return (hour + minute / 60) / 24;
}

function isWorkingAt(
  referenceHour: number,
  city: City,
  now: Date,
  referenceTimeZone: string,
): boolean {
  const offsetHours =
    relativeOffsetMinutes(now, city.timeZone, referenceTimeZone) / 60;
  const cityHour = (((referenceHour + offsetHours) % 24) + 24) % 24;
  return cityHour >= city.workingHours.start && cityHour < city.workingHours.end;
}

/**
 * The window(s) where every city is at work, sampled across the day and grouped
 * into contiguous bands. Empty when there is no time that suits everyone.
 */
export function overlapBands(
  now: Date,
  cities: readonly City[],
  referenceTimeZone: string,
  slotsPerDay = 96,
): Band[] {
  const bands: Band[] = [];
  let runStart: number | null = null;

  for (let slot = 0; slot < slotsPerDay; slot += 1) {
    const referenceHour = ((slot + 0.5) / slotsPerDay) * 24;
    const everyone =
      cities.length > 0 &&
      cities.every((city) => isWorkingAt(referenceHour, city, now, referenceTimeZone));

    if (everyone && runStart === null) {
      runStart = slot;
    } else if (!everyone && runStart !== null) {
      bands.push({ left: runStart / slotsPerDay, width: (slot - runStart) / slotsPerDay });
      runStart = null;
    }
  }
  if (runStart !== null) {
    bands.push({ left: runStart / slotsPerDay, width: (slotsPerDay - runStart) / slotsPerDay });
  }
  return bands;
}

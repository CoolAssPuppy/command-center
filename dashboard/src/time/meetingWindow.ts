import type { Zone } from "../config/schema";
import { relativeOffsetMinutes } from "./clock";

/**
 * The compact meeting-window maths over the configured zones. Across enough
 * zones there is usually no hour when everyone is working, so instead of the
 * strict all-zones overlap we find the PEAK: the longest window where the most
 * zones are simultaneously at work, and how many that is. Working hours default
 * to 09:00–18:00 local. Everything is projected onto the home zone's 24h axis.
 */
const WORK_START = 9;
const WORK_END = 18;

export interface Band {
  /** Left edge as a 0..1 fraction of the 24h axis. */
  left: number;
  /** Width as a 0..1 fraction of the 24h axis. */
  width: number;
}

/** A zone's working hours projected onto the reference axis, split if it wraps. */
export function workingBands(
  now: Date,
  zone: Zone,
  referenceTimeZone: string,
): Band[] {
  const offsetHours = relativeOffsetMinutes(now, zone.timeZone, referenceTimeZone) / 60;
  const length = WORK_END - WORK_START;
  let start = (((WORK_START - offsetHours) % 24) + 24) % 24;

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

function isWorkingAt(
  referenceHour: number,
  zone: Zone,
  now: Date,
  referenceTimeZone: string,
): boolean {
  const offsetHours = relativeOffsetMinutes(now, zone.timeZone, referenceTimeZone) / 60;
  const zoneHour = (((referenceHour + offsetHours) % 24) + 24) % 24;
  return zoneHour >= WORK_START && zoneHour < WORK_END;
}

export interface MeetingWindow {
  /** The peak overlap band on the home 24h axis. */
  left: number;
  width: number;
  /** Hours on the reference axis, 0..24. */
  startHour: number;
  endHour: number;
  /** How many zones are working through the peak window, of how many total. */
  count: number;
  total: number;
  /** Whether the peak catches every zone. */
  everyone: boolean;
}

export function computeMeetingWindow(
  now: Date,
  zones: Zone[],
  referenceTimeZone: string,
  slots = 96,
): MeetingWindow | undefined {
  if (zones.length === 0) return undefined;

  const coverage = Array.from({ length: slots }, (_value, slot) => {
    const referenceHour = ((slot + 0.5) / slots) * 24;
    return zones.reduce(
      (sum, zone) =>
        isWorkingAt(referenceHour, zone, now, referenceTimeZone) ? sum + 1 : sum,
      0,
    );
  });

  const peak = Math.max(...coverage);
  let bestStart = -1;
  let bestLen = 0;
  let runStart = -1;
  let runLen = 0;
  for (let slot = 0; slot < slots; slot += 1) {
    if (coverage[slot] === peak) {
      if (runStart < 0) runStart = slot;
      runLen += 1;
      if (runLen > bestLen) {
        bestLen = runLen;
        bestStart = runStart;
      }
    } else {
      runStart = -1;
      runLen = 0;
    }
  }

  const left = bestStart / slots;
  const width = bestLen / slots;
  return {
    left,
    width,
    startHour: left * 24,
    endHour: (left + width) * 24,
    count: peak,
    total: zones.length,
    everyone: peak === zones.length,
  };
}

/** Format a reference-axis hour (0..24) as "HH:00". */
export function formatAxisHour(hour: number): string {
  const h = Math.round(hour) % 24;
  return `${String(h).padStart(2, "0")}:00`;
}

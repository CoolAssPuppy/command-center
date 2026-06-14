/**
 * A small solar-position model so the city row can paint the live daylight
 * state with no network call. Given an instant and a location it returns the
 * sun's elevation, from which a day / dawn / dusk / night state follows. It is
 * approximate (within a fraction of a degree) but deterministic and
 * dependency-free, which keeps the hero row instant and fully testable.
 */

const DEG = Math.PI / 180;

export type DaylightState = "day" | "dawn" | "dusk" | "night";

function fractionalUtcHours(instant: Date): number {
  return (
    instant.getUTCHours() +
    instant.getUTCMinutes() / 60 +
    instant.getUTCSeconds() / 3600
  );
}

function dayOfYear(instant: Date): number {
  const yearStart = Date.UTC(instant.getUTCFullYear(), 0, 0);
  return Math.floor((instant.getTime() - yearStart) / 86_400_000);
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}

/** The sun's elevation in degrees above the horizon at an instant and place. */
export function solarElevation(instant: Date, lat: number, lon: number): number {
  // Cooper's approximation for the solar declination.
  const declination = 23.44 * Math.sin(DEG * (360 / 365) * (dayOfYear(instant) - 81));
  // Local solar time follows from UTC plus four minutes per degree of longitude.
  const solarTime = fractionalUtcHours(instant) + lon / 15;
  const hourAngle = 15 * (solarTime - 12);
  const sinElevation =
    Math.sin(DEG * lat) * Math.sin(DEG * declination) +
    Math.cos(DEG * lat) * Math.cos(DEG * declination) * Math.cos(DEG * hourAngle);
  return Math.asin(clamp(sinElevation, -1, 1)) / DEG;
}

/** Whether the sun is in the rising half of the day (before solar noon). */
export function isMorning(instant: Date, lon: number): boolean {
  const solarTime = (((fractionalUtcHours(instant) + lon / 15) % 24) + 24) % 24;
  return solarTime < 12;
}

/**
 * Day above the horizon, night well below it, and the civil-twilight band in
 * between split into dawn (sun rising) and dusk (sun setting).
 */
export function daylightState(instant: Date, lat: number, lon: number): DaylightState {
  const elevation = solarElevation(instant, lat, lon);
  if (elevation >= 0) return "day";
  if (elevation >= -6) return isMorning(instant, lon) ? "dawn" : "dusk";
  return "night";
}

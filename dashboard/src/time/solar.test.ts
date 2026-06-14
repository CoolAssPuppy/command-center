import { describe, expect, it } from "vitest";

import { daylightState, isMorning, solarElevation } from "./solar";

// June solstice keeps the sun high in the north; the equator/prime-meridian
// reference makes solar time equal to UTC, so these instants are easy to reason
// about without depending on the system clock.
const SOLSTICE_NOON = new Date(Date.UTC(2026, 5, 21, 12, 0, 0));
const SOLSTICE_MIDNIGHT = new Date(Date.UTC(2026, 5, 21, 0, 0, 0));

describe("solar position", () => {
  it("puts the sun high at local solar noon and below the horizon at midnight", () => {
    expect(solarElevation(SOLSTICE_NOON, 0, 0)).toBeGreaterThan(60);
    expect(solarElevation(SOLSTICE_MIDNIGHT, 0, 0)).toBeLessThan(-60);
  });

  it("classifies day and night from the elevation", () => {
    expect(daylightState(SOLSTICE_NOON, 0, 0)).toBe("day");
    expect(daylightState(SOLSTICE_MIDNIGHT, 0, 0)).toBe("night");
  });

  it("distinguishes dawn from dusk by whether the sun is rising", () => {
    // At the equator on the solstice the sun crosses the horizon near 6h/18h
    // solar time; just inside those gives a low sun in the twilight band.
    const earlyMorning = new Date(Date.UTC(2026, 5, 21, 5, 42, 0));
    const lateEvening = new Date(Date.UTC(2026, 5, 21, 18, 18, 0));

    expect(daylightState(earlyMorning, 0, 0)).toBe("dawn");
    expect(daylightState(lateEvening, 0, 0)).toBe("dusk");
  });

  it("knows morning from afternoon at a longitude", () => {
    // At lon -74, 14:00 UTC is ~09:04 solar time (morning); noon UTC at lon 0
    // is exactly solar noon (afternoon side).
    const morning = new Date(Date.UTC(2026, 5, 21, 14, 0, 0));
    expect(isMorning(morning, -74)).toBe(true);
    expect(isMorning(SOLSTICE_MIDNIGHT, 0)).toBe(true);
    expect(isMorning(SOLSTICE_NOON, 0)).toBe(false);
  });
});

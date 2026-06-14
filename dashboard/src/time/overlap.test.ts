import { describe, expect, it } from "vitest";

import type { City } from "../cities/cities";

import { nowFraction, overlapBands, workingBands } from "./overlap";

const makeCity = (overrides?: Partial<City>): City => ({
  id: "c",
  label: "C",
  timeZone: "UTC",
  lat: 0,
  lon: 0,
  workingHours: { start: 9, end: 18 },
  skyline: "",
  ...overrides,
});

const NOON_UTC = new Date(Date.UTC(2026, 5, 15, 12, 0, 0));

describe("overlap timeline maths", () => {
  it("places a same-zone working day where it belongs on the axis", () => {
    const bands = workingBands(NOON_UTC, makeCity(), "UTC");
    expect(bands).toHaveLength(1);
    expect(bands[0]?.left).toBeCloseTo(9 / 24, 5);
    expect(bands[0]?.width).toBeCloseTo(9 / 24, 5);
  });

  it("splits a working day that wraps past midnight on the reference axis", () => {
    // Tokyo (UTC+9) 09:00-18:00 maps to 00:00-09:00 UTC: a single unbroken band
    // here, but a late zone wraps. Use UTC+14 to force a wrap.
    const farEast = makeCity({ timeZone: "Pacific/Kiritimati" }); // UTC+14
    const bands = workingBands(NOON_UTC, farEast, "UTC");
    expect(bands.length).toBeGreaterThanOrEqual(2);
    const total = bands.reduce((sum, b) => sum + b.width, 0);
    expect(total).toBeCloseTo(9 / 24, 4);
  });

  it("finds the window where all cities overlap, and none when they cannot", () => {
    const sameZone = [makeCity({ id: "a" }), makeCity({ id: "b" })];
    const overlap = overlapBands(NOON_UTC, sameZone, "UTC");
    expect(overlap).toHaveLength(1);
    expect(overlap[0]?.left).toBeCloseTo(9 / 24, 1);

    const opposite = [
      makeCity({ id: "a", timeZone: "UTC" }),
      makeCity({ id: "b", timeZone: "Pacific/Kiritimati" }), // +14h, no shared hour
    ];
    expect(overlapBands(NOON_UTC, opposite, "UTC")).toHaveLength(0);
  });

  it("expresses the current time as a fraction of the axis", () => {
    expect(nowFraction(NOON_UTC, "UTC")).toBeCloseTo(0.5, 5);
  });
});

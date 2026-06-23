import { describe, expect, it } from "vitest";

import type { Zone } from "../config/schema";
import { computeMeetingWindow, formatAxisHour, workingBands } from "./meetingWindow";

const zone = (id: string, timeZone: string): Zone => ({ id, label: id, timeZone });
const now = new Date(Date.UTC(2026, 5, 15, 12, 0, 0));

describe("workingBands", () => {
  it("projects a UTC zone's 09:00–18:00 onto the UTC axis", () => {
    const bands = workingBands(now, zone("a", "UTC"), "UTC");
    expect(bands).toHaveLength(1);
    expect(bands[0]?.left).toBeCloseTo(9 / 24, 5);
    expect(bands[0]?.width).toBeCloseTo(9 / 24, 5);
  });

  it("splits a zone whose working day wraps past midnight on the axis", () => {
    // Auckland (+12h) works 21:00–06:00 on the UTC axis → two segments.
    const bands = workingBands(now, zone("nz", "Pacific/Auckland"), "UTC");
    expect(bands.length).toBe(2);
  });
});

describe("computeMeetingWindow", () => {
  it("returns undefined for no zones", () => {
    expect(computeMeetingWindow(now, [], "UTC")).toBeUndefined();
  });

  it("a single zone overlaps itself entirely", () => {
    const result = computeMeetingWindow(now, [zone("a", "UTC")], "UTC");
    expect(result?.everyone).toBe(true);
    expect(result?.count).toBe(1);
    expect(result?.total).toBe(1);
  });

  it("reports the peak, not an empty all-zones overlap", () => {
    const result = computeMeetingWindow(
      now,
      [zone("utc", "UTC"), zone("nz", "Pacific/Auckland")],
      "UTC",
    );
    expect(result).toBeDefined();
    if (result === undefined) return;
    expect(result.total).toBe(2);
    expect(result.everyone).toBe(false);
    expect(result.count).toBe(1);
  });
});

describe("formatAxisHour", () => {
  it("formats the axis hour", () => {
    expect(formatAxisHour(9)).toBe("09:00");
    expect(formatAxisHour(18)).toBe("18:00");
    expect(formatAxisHour(24)).toBe("00:00");
  });
});

import { describe, expect, it, vi } from "vitest";

import {
  FIRST_PAINT_BUDGET_MS,
  measureFirstPaint,
  prefersReducedMotion,
} from "./perf";

describe("prefersReducedMotion", () => {
  it("is true when the media query matches", () => {
    expect(prefersReducedMotion(() => ({ matches: true }))).toBe(true);
  });

  it("is false when it does not match", () => {
    expect(prefersReducedMotion(() => ({ matches: false }))).toBe(false);
  });

  it("is false when no matcher is available", () => {
    expect(prefersReducedMotion(undefined)).toBe(false);
  });

  it("is false rather than throwing when the matcher throws", () => {
    expect(
      prefersReducedMotion(() => {
        throw new Error("no matchMedia");
      }),
    ).toBe(false);
  });
});

describe("measureFirstPaint", () => {
  it("times the render and flags within budget", () => {
    const render = vi.fn();
    const clock = vi.fn<() => number>().mockReturnValueOnce(0).mockReturnValueOnce(30);

    const result = measureFirstPaint(render, clock);

    expect(render).toHaveBeenCalledOnce();
    expect(result.elapsedMs).toBe(30);
    expect(result.withinBudget).toBe(true);
  });

  it("flags a render that exceeds the first-paint budget", () => {
    const clock = vi
      .fn<() => number>()
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(FIRST_PAINT_BUDGET_MS + 50);

    expect(measureFirstPaint(() => undefined, clock).withinBudget).toBe(false);
  });
});

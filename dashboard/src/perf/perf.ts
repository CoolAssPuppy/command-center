/**
 * Performance helpers. A new tab page must paint fast, so the dashboard times
 * its first paint and respects reduced motion. The budgets here are also
 * enforced at build time by scripts/check-bundle.mjs.
 */

/** Target for first paint from cache, in milliseconds. */
export const FIRST_PAINT_BUDGET_MS = 100;

export type MediaMatcher = (query: string) => { matches: boolean };

function defaultMatcher(): MediaMatcher | undefined {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return undefined;
  }
  return window.matchMedia.bind(window);
}

/** Whether the user asked for reduced motion. False when it cannot be read. */
export function prefersReducedMotion(
  matcher: MediaMatcher | undefined = defaultMatcher(),
): boolean {
  if (matcher === undefined) return false;
  try {
    return matcher("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export interface PaintMeasurement {
  elapsedMs: number;
  withinBudget: boolean;
}

/** Time a render callback and report whether it met the first-paint budget. */
export function measureFirstPaint(
  render: () => void,
  clock: () => number = () => performance.now(),
): PaintMeasurement {
  const start = clock();
  render();
  const elapsedMs = clock() - start;
  return { elapsedMs, withinBudget: elapsedMs <= FIRST_PAINT_BUDGET_MS };
}

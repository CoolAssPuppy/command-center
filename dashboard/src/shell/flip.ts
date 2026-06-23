/**
 * FLIP reflow for the dashboard widgets. The dashboard repaints by rebuilding
 * its whole subtree, so widgets are fresh nodes each paint. To animate a
 * layout change (a deleted zone or stream, a re-centred stage) we match the
 * old and new nodes by a stable data-flip-id, then play the survivors from
 * their previous box to their new one.
 *
 * Only transform is animated, never a layout property, so the work stays on the
 * compositor. First-Last-Invert-Play: capture the old rect, let the new layout
 * settle, set an inverse transform with no transition, then transition it away.
 */
const FLIP_DURATION_MS = 320;
const FLIP_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

/** Read the current box of every keyed widget, before the repaint. */
export function captureFlipRects(root: HTMLElement): Map<string, DOMRect> {
  const rects = new Map<string, DOMRect>();
  for (const node of root.querySelectorAll<HTMLElement>("[data-flip-id]")) {
    const id = node.dataset.flipId;
    if (id !== undefined) rects.set(id, node.getBoundingClientRect());
  }
  return rects;
}

export interface FlipOptions {
  /** Skip all motion (prefers-reduced-motion or the theme's motion off). */
  reducedMotion: boolean;
}

/**
 * Animate every keyed widget that existed before from its old box to its new
 * one. Widgets new this paint (no prior rect) are left alone, so adds don't
 * slide in from nowhere; only survivors move. A no-op under reduced motion or
 * when nothing actually shifted.
 */
export function playFlip(
  root: HTMLElement,
  previous: Map<string, DOMRect>,
  options: FlipOptions,
): void {
  if (options.reducedMotion || previous.size === 0) return;

  const moved: HTMLElement[] = [];
  for (const node of root.querySelectorAll<HTMLElement>("[data-flip-id]")) {
    const id = node.dataset.flipId;
    if (id === undefined) continue;
    const old = previous.get(id);
    if (old === undefined) continue;

    const next = node.getBoundingClientRect();
    const dx = old.left - next.left;
    const dy = old.top - next.top;
    const sx = next.width > 0 ? old.width / next.width : 1;
    const sy = next.height > 0 ? old.height / next.height : 1;
    const shifted = Math.abs(dx) > 1 || Math.abs(dy) > 1;
    const resized = Math.abs(sx - 1) > 0.01 || Math.abs(sy - 1) > 0.01;
    if (!shifted && !resized) continue;

    // Scale distorts nested text mid-flight, so only widgets that opt in
    // (data-flip-scale) tween their size; the rest translate and snap size.
    const scale = node.dataset.flipScale === "true" ? `scale(${sx}, ${sy})` : "";
    node.style.transformOrigin = "top left";
    node.style.transition = "none";
    node.style.transform = `translate(${dx}px, ${dy}px) ${scale}`.trim();
    moved.push(node);
  }
  if (moved.length === 0) return;

  // Commit the inverted transforms before playing them out.
  void root.offsetWidth;
  requestAnimationFrame(() => {
    for (const node of moved) {
      node.style.transition = `transform ${String(FLIP_DURATION_MS)}ms ${FLIP_EASING}`;
      node.style.transform = "";
    }
  });

  for (const node of moved) {
    const cleanup = (event: TransitionEvent): void => {
      if (event.propertyName !== "transform") return;
      node.style.removeProperty("transition");
      node.style.removeProperty("transform");
      node.style.removeProperty("transform-origin");
      node.removeEventListener("transitionend", cleanup);
    };
    node.addEventListener("transitionend", cleanup);
  }
}

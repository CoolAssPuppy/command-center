import type { City } from "../cities/cities";
import { el } from "../render/helpers";
import { nowFraction, overlapBands, workingBands } from "../time/overlap";

/**
 * The 24-hour overlap strip. Each city's working hours are drawn as a band on a
 * shared axis (the viewer's local day); the highlighted column is where every
 * city is at work at once, and the vertical cursor is now. At a glance it shows
 * when everyone can meet.
 */
export interface OverlapTimelineModel {
  now: Date;
  cities: readonly City[];
  referenceTimeZone: string;
}

const TICK_HOURS = [0, 6, 12, 18, 24];

function percent(fraction: number): string {
  return `${String(fraction * 100)}%`;
}

export function renderOverlapTimeline(
  host: HTMLElement,
  model: OverlapTimelineModel,
): HTMLElement {
  const root = el("div", "cc-timeline-panel");
  const head = el("div", "cc-timeline-panel__head");
  head.appendChild(el("div", "cc-timeline-panel__title", "Meeting window"));
  head.appendChild(
    el(
      "div",
      "cc-timeline-panel__hint",
      "Working hours across all five cities, on your local clock",
    ),
  );
  root.appendChild(head);

  const chart = el("div", "cc-overlap");

  const grid = el("div", "cc-overlap__grid");
  for (const city of model.cities) {
    grid.appendChild(el("div", "cc-overlap__label", city.label));
    const track = el("div", "cc-overlap__track");
    for (const band of workingBands(model.now, city, model.referenceTimeZone)) {
      const segment = el("div", "cc-overlap__band");
      segment.style.left = percent(band.left);
      segment.style.width = percent(band.width);
      track.appendChild(segment);
    }
    grid.appendChild(track);
  }
  chart.appendChild(grid);

  // Overlay sits over the track column (after the fixed label column) so the
  // shared-window highlight and the now cursor line up with every row's bands.
  const overlay = el("div", "cc-overlap__overlay");
  for (const window of overlapBands(model.now, model.cities, model.referenceTimeZone)) {
    const highlight = el("div", "cc-overlap__window");
    highlight.style.left = percent(window.left);
    highlight.style.width = percent(window.width);
    overlay.appendChild(highlight);
  }
  const cursor = el("div", "cc-overlap__now");
  cursor.style.left = percent(nowFraction(model.now, model.referenceTimeZone));
  overlay.appendChild(cursor);
  chart.appendChild(overlay);

  root.appendChild(chart);

  const axis = el("div", "cc-overlap__axis");
  for (const hour of TICK_HOURS) {
    const tick = el("span", "cc-overlap__tick", hour === 24 ? "24" : String(hour).padStart(2, "0"));
    tick.style.left = percent(hour / 24);
    axis.appendChild(tick);
  }
  root.appendChild(axis);

  host.appendChild(root);
  return root;
}

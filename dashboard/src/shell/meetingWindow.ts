import type { Zone } from "../config/schema";
import { el } from "../render/helpers";
import { zonedTime } from "../time/clock";
import {
  computeMeetingWindow,
  formatAxisHour,
  workingBands,
} from "../time/meetingWindow";

/**
 * The compact meeting-window widget. It leads with the honest verdict (usually
 * "no single hour reaches all N") and the tightest overlap, then shows a small
 * 24h timeline: a working-hours bar per zone, the peak-overlap band, and a now
 * cursor. Working hours default to 09:00–18:00 local; the axis is the home zone.
 */
export interface MeetingWindowModel {
  now: Date;
  zones: Zone[];
  homeZone: Zone;
  hour12?: boolean;
}

function shortCode(label: string): string {
  return label.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "?";
}

function nowFraction(now: Date, timeZone: string): number {
  const { hour, minute } = zonedTime(now, timeZone);
  return (hour + minute / 60) / 24;
}

export function renderMeetingWindow(
  host: HTMLElement,
  model: MeetingWindowModel,
): HTMLElement {
  const referenceTimeZone = model.homeZone.timeZone;
  const root = el("div", "cc-mw");
  root.dataset.flipId = "meeting-window";

  const header = el("div", "cc-mw__header");
  header.appendChild(el("span", "cc-mw__eyebrow", "MEETING WINDOW"));
  root.appendChild(header);

  const window = computeMeetingWindow(model.now, model.zones, referenceTimeZone);
  const verdict = el("div", "cc-mw__verdict");
  if (window === undefined) {
    verdict.appendChild(el("div", "cc-mw__headline", "Add zones to see overlap."));
  } else if (window.everyone) {
    verdict.appendChild(
      el(
        "div",
        "cc-mw__headline",
        `All ${String(window.total)} overlap ${formatAxisHour(window.startHour)}–${formatAxisHour(window.endHour)}.`,
      ),
    );
  } else {
    verdict.appendChild(
      el("div", "cc-mw__headline", `No single hour reaches all ${String(window.total)}.`),
    );
    const sub = el("div", "cc-mw__sub");
    sub.appendChild(el("span", "cc-mw__sub-label", "Best overlap"));
    sub.appendChild(
      el(
        "span",
        "cc-mw__sub-time",
        `${formatAxisHour(window.startHour)}–${formatAxisHour(window.endHour)}`,
      ),
    );
    sub.appendChild(el("span", "cc-mw__sub-count", `· ${String(window.count)} of ${String(window.total)}`));
    verdict.appendChild(sub);
  }
  root.appendChild(verdict);

  const grid = el("div", "cc-mw__grid");
  const labels = el("div", "cc-mw__labels");
  const tracks = el("div", "cc-mw__tracks");

  for (const zone of model.zones) {
    const isHome = zone.id === model.homeZone.id;
    const label = el(
      "span",
      `cc-mw__label${isHome ? " is-home" : ""}`,
      shortCode(zone.label),
    );
    labels.appendChild(label);

    const track = el("div", "cc-mw__track");
    for (const band of workingBands(model.now, zone, referenceTimeZone)) {
      const bar = el("div", `cc-mw__bar${isHome ? " is-home" : ""}`);
      bar.style.left = `${String(band.left * 100)}%`;
      bar.style.width = `${String(band.width * 100)}%`;
      track.appendChild(bar);
    }
    tracks.appendChild(track);
  }

  if (window !== undefined && window.width > 0) {
    const band = el("div", "cc-mw__window");
    band.style.left = `${String(window.left * 100)}%`;
    band.style.width = `${String(window.width * 100)}%`;
    tracks.appendChild(band);
  }
  const cursor = el("div", "cc-mw__cursor");
  cursor.style.left = `${String(nowFraction(model.now, referenceTimeZone) * 100)}%`;
  cursor.appendChild(el("div", "cc-mw__cursor-dot"));
  tracks.appendChild(cursor);

  grid.appendChild(labels);
  grid.appendChild(tracks);
  root.appendChild(grid);

  const axis = el("div", "cc-mw__axis");
  for (const tick of ["00", "06", "12", "18", "24"]) {
    axis.appendChild(el("span", undefined, tick));
  }
  root.appendChild(axis);

  host.appendChild(root);
  return root;
}

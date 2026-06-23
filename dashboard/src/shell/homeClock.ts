import type { Zone } from "../config/schema";
import { el } from "../render/helpers";
import { formatClock, zonedTime } from "../time/clock";
import { phaseLabel } from "../time/solar";

/**
 * The centered, prominent home clock: a greeting, the big current time for the
 * home zone, and the date plus place beneath it. Pure and deterministic; the
 * instant is always passed in so the same moment renders the same way.
 */
export interface HomeClockModel {
  now: Date;
  zone: Zone;
  name?: string;
  hour12?: boolean;
}

function greetingFor(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function formatDate(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(now);
}

export function renderHomeClock(host: HTMLElement, model: HomeClockModel): HTMLElement {
  const root = el("div", "cc-home");
  const { hour } = zonedTime(model.now, model.zone.timeZone);

  const greeting =
    model.name !== undefined && model.name.length > 0
      ? `${greetingFor(hour)}, ${model.name}.`
      : `${greetingFor(hour)}.`;
  root.appendChild(el("div", "cc-home__greeting", greeting));

  const time = el(
    "div",
    "cc-home__time",
    formatClock(model.now, model.zone.timeZone, { hour12: model.hour12 ?? true }),
  );
  time.setAttribute("data-phase", phaseLabel(hour).toLowerCase());
  root.appendChild(time);

  const meta = el("div", "cc-home__meta");
  meta.appendChild(el("span", "cc-home__date", formatDate(model.now, model.zone.timeZone)));
  meta.appendChild(el("span", "cc-home__dot", "·"));
  meta.appendChild(el("span", "cc-home__place", model.zone.label));
  root.appendChild(meta);

  host.appendChild(root);
  return root;
}

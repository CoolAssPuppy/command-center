import { el } from "../render/helpers";
import { formatClock, zonedTime } from "../time/clock";

export interface HeaderModel {
  now: Date;
  timeZone: string;
  name?: string;
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

export function renderHeader(host: HTMLElement, model: HeaderModel): HTMLElement {
  const root = el("div", "cc-header");

  const clock = el("div", "cc-header__clock");
  clock.appendChild(el("span", "cc-header__time", formatClock(model.now, model.timeZone)));
  clock.appendChild(el("span", "cc-header__date", formatDate(model.now, model.timeZone)));
  root.appendChild(clock);

  const { hour } = zonedTime(model.now, model.timeZone);
  const greeting =
    model.name !== undefined && model.name.length > 0
      ? `${greetingFor(hour)}, ${model.name}`
      : greetingFor(hour);
  root.appendChild(el("div", "cc-header__greeting", greeting));

  host.appendChild(root);
  return root;
}

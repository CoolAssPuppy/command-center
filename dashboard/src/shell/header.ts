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

/** A readable place name from an IANA zone, e.g. "America/New_York" -> "New York". */
function zoneLabel(timeZone: string): string {
  const tail = timeZone.split("/").pop() ?? timeZone;
  return tail.replace(/_/g, " ");
}

export function renderHeader(host: HTMLElement, model: HeaderModel): HTMLElement {
  const root = el("div", "cc-header");

  const left = el("div", "cc-header__left");
  left.appendChild(el("div", "cc-header__eyebrow", "COMMAND CENTER"));
  const { hour } = zonedTime(model.now, model.timeZone);
  const greeting =
    model.name !== undefined && model.name.length > 0
      ? `${greetingFor(hour)}, ${model.name}.`
      : `${greetingFor(hour)}.`;
  left.appendChild(el("div", "cc-header__greeting", greeting));
  root.appendChild(left);

  const right = el("div", "cc-header__right");
  right.appendChild(el("span", "cc-header__time", formatClock(model.now, model.timeZone)));
  right.appendChild(
    el(
      "span",
      "cc-header__date",
      `${formatDate(model.now, model.timeZone)}  ·  ${zoneLabel(model.timeZone)}`,
    ),
  );
  root.appendChild(right);

  host.appendChild(root);
  return root;
}

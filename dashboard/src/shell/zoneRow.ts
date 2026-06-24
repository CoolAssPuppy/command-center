import type { Zone } from "../config/schema";
import { el, svgEl } from "../render/helpers";
import { cityClock, formatClock } from "../time/clock";
import type { Weather } from "../weather/openMeteo";
import { makeDashboardReorderable, type ReorderHandler } from "./dashboardReorder";

/** A small sun (day) or crescent moon (night) for a zone card's corner. */
function dayNightIcon(isNight: boolean): SVGElement {
  const svg = svgEl("svg", {
    viewBox: "0 0 24 24",
    width: "14",
    height: "14",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "1.7",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  });
  if (isNight) {
    svg.appendChild(svgEl("path", { d: "M20 14.4A8 8 0 0 1 9.6 4 7 7 0 1 0 20 14.4z" }));
    return svg;
  }
  svg.appendChild(svgEl("circle", { cx: "12", cy: "12", r: "4" }));
  for (const [x1, y1, x2, y2] of [
    [12, 2, 12, 4], [12, 20, 12, 22], [2, 12, 4, 12], [20, 12, 22, 12],
    [5, 5, 6.4, 6.4], [17.6, 17.6, 19, 19], [5, 19, 6.4, 17.6], [17.6, 6.4, 19, 5],
  ] as const) {
    svg.appendChild(
      svgEl("line", { x1: String(x1), y1: String(y1), x2: String(x2), y2: String(y2) }),
    );
  }
  return svg;
}

/**
 * The row of other timezones beneath the home clock. Each card shows the zone's
 * local time, how far it is offset from home, its day/night state, and (when the
 * zone has coordinates) the current temperature once weather lands.
 */
export interface ZoneRowModel {
  now: Date;
  homeZone: Zone;
  zones: Zone[];
  hour12?: boolean;
  weatherByZone?: Record<string, Weather>;
  /** Reorder timezone cards by dragging one onto another. */
  onReorder?: ReorderHandler;
}

/** A compact "+5h 30m" / "-3h" / "same time" label for the offset from home. */
export function offsetLabel(minutes: number): string {
  if (minutes === 0) return "same time";
  const sign = minutes > 0 ? "+" : "−";
  const abs = Math.abs(minutes);
  const hours = Math.floor(abs / 60);
  const mins = abs % 60;
  if (hours === 0) return `${sign}${mins}m`;
  return mins === 0 ? `${sign}${hours}h` : `${sign}${hours}h ${mins}m`;
}

/** A "+1" / "−1" day badge when the zone's calendar day differs from home. */
function dayOffsetBadge(days: number): string | undefined {
  if (days === 0) return undefined;
  return days > 0 ? `+${days}d` : `${days}d`;
}

export function renderZoneRow(host: HTMLElement, model: ZoneRowModel): HTMLElement {
  const root = el("div", "cc-zones");

  for (const zone of model.zones) {
    const clock = cityClock(model.now, zone.timeZone, model.homeZone.timeZone, {
      label: zone.label,
    });
    const card = el("div", "cc-zone");
    card.setAttribute("data-daynight", clock.dayNight);
    card.dataset.flipId = `zone:${zone.id}`;

    const indicator = el("span", "cc-zone__daynight");
    indicator.setAttribute("title", clock.dayNight === "night" ? "Night" : "Day");
    indicator.appendChild(dayNightIcon(clock.dayNight === "night"));
    card.appendChild(indicator);

    const label = el("div", "cc-zone__label", zone.label);
    const badge = dayOffsetBadge(clock.dateOffsetDays);
    if (badge !== undefined) label.appendChild(el("span", "cc-zone__day", badge));
    card.appendChild(label);

    card.appendChild(
      el(
        "div",
        "cc-zone__time",
        formatClock(model.now, zone.timeZone, { hour12: model.hour12 ?? true }),
      ),
    );

    const meta = el("div", "cc-zone__meta", offsetLabel(clock.relativeOffsetMinutes));
    const weather = model.weatherByZone?.[zone.id];
    if (weather !== undefined) {
      meta.appendChild(
        el("span", "cc-zone__weather", `  ${Math.round(weather.temperature)}°`),
      );
    }
    card.appendChild(meta);

    if (model.onReorder !== undefined) {
      makeDashboardReorderable(card, "zones", zone.id, model.onReorder);
    }

    root.appendChild(card);
  }

  host.appendChild(root);
  return root;
}

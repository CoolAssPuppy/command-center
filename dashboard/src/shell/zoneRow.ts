import type { Zone } from "../config/schema";
import { el } from "../render/helpers";
import { cityClock, formatClock } from "../time/clock";
import type { Weather } from "../weather/openMeteo";

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

    root.appendChild(card);
  }

  host.appendChild(root);
  return root;
}

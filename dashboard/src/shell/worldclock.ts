import { el } from "../render/helpers";
import { cityClock, formatClock } from "../time/clock";

/**
 * The world clock is a first-party widget, not a provider feed. It renders each
 * configured city's local time, day or night state, and date offset from the
 * base zone. All computation is in the deterministic time engine.
 */

export interface WorldClockCity {
  label: string;
  timeZone: string;
}

export interface WorldClockModel {
  now: Date;
  baseTimeZone: string;
  cities: WorldClockCity[];
}

function offsetLabel(days: number): string {
  if (days === 0) return "";
  return days > 0 ? `+${String(days)}d` : `${String(days)}d`;
}

export function renderWorldClock(
  host: HTMLElement,
  model: WorldClockModel,
): HTMLElement {
  const root = el("div", "cc-worldclock");
  root.appendChild(el("div", "cc-worldclock__title", "World clock"));

  const list = el("ul", "cc-worldclock__list");
  for (const city of model.cities) {
    const clock = cityClock(model.now, city.timeZone, model.baseTimeZone, {
      label: city.label,
    });
    const row = el("li", "cc-worldclock__city");
    row.setAttribute("data-daynight", clock.dayNight);
    row.appendChild(el("span", "cc-worldclock__label", city.label));
    row.appendChild(
      el("span", "cc-worldclock__time", formatClock(model.now, city.timeZone)),
    );
    const offset = offsetLabel(clock.dateOffsetDays);
    if (offset.length > 0) {
      row.appendChild(el("span", "cc-worldclock__offset", offset));
    }
    list.appendChild(row);
  }
  root.appendChild(list);
  host.appendChild(root);
  return root;
}

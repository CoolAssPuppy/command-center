import type { City } from "../cities/cities";
import { el, svgEl } from "../render/helpers";
import { formatClock } from "../time/clock";
import { daylightState } from "../time/solar";
import type { Weather } from "../weather/openMeteo";

/**
 * The hero row: one block per city showing its skyline, local time, and current
 * weather over a background that reflects the live daylight state. Daylight is a
 * deterministic solar calc, so each block paints immediately; weather fills in
 * when its async fetch resolves, keyed by city id.
 */
export interface CityRowModel {
  now: Date;
  cities: readonly City[];
  weatherByCity?: Record<string, Weather>;
}

export function renderCityRow(host: HTMLElement, model: CityRowModel): HTMLElement {
  const root = el("div", "cc-cityrow");
  for (const city of model.cities) {
    root.appendChild(renderCity(model.now, city, model.weatherByCity?.[city.id]));
  }
  host.appendChild(root);
  return root;
}

function renderCity(now: Date, city: City, weather: Weather | undefined): HTMLElement {
  const card = el("div", "cc-city");
  card.setAttribute("data-daylight", daylightState(now, city.lat, city.lon));

  const svg = svgEl("svg", {
    class: "cc-city__skyline",
    viewBox: "0 0 300 64",
    preserveAspectRatio: "none",
    "aria-hidden": "true",
  });
  svg.appendChild(svgEl("path", { d: city.skyline, class: "cc-city__skyline-path" }));
  card.appendChild(svg);

  const body = el("div", "cc-city__body");
  body.appendChild(el("div", "cc-city__name", city.label));
  body.appendChild(el("div", "cc-city__time", formatClock(now, city.timeZone)));

  const meta = el("div", "cc-city__meta");
  if (weather !== undefined) {
    const icon = el("span", "cc-city__weather-icon");
    icon.setAttribute("data-icon", weather.icon);
    meta.appendChild(icon);
    meta.appendChild(
      el("span", "cc-city__temp", `${String(Math.round(weather.temperature))}°`),
    );
    meta.appendChild(el("span", "cc-city__condition", weather.condition));
  }
  body.appendChild(meta);

  card.appendChild(body);
  return card;
}

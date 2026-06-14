import type { City } from "../cities/cities";
import { el } from "../render/helpers";
import { formatClock, zonedTime } from "../time/clock";
import { daylightState, phaseLabel } from "../time/solar";
import type { Weather } from "../weather/openMeteo";

/**
 * The hero row: one square per city showing its desaturated skyline, local time,
 * and current weather. The daylight state (a deterministic solar calc) tints the
 * scrim so the row reads as a gradient of the day; weather fills in when its
 * async fetch resolves, keyed by city id.
 */
export interface CityRowModel {
  now: Date;
  cities: readonly City[];
  weatherByCity?: Record<string, Weather>;
}

const ASSET_BASE = import.meta.env.BASE_URL;

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

  const photo = el("img", "cc-city__photo");
  photo.setAttribute("src", `${ASSET_BASE}${city.photo}`);
  photo.setAttribute("alt", "");
  photo.setAttribute("loading", "lazy");
  card.appendChild(photo);

  card.appendChild(el("div", "cc-city__scrim"));

  const body = el("div", "cc-city__body");

  const eyebrow = el("div", "cc-city__eyebrow");
  eyebrow.appendChild(el("span", "cc-city__dot"));
  eyebrow.appendChild(
    el("span", "cc-city__phase", phaseLabel(zonedTime(now, city.timeZone).hour)),
  );
  body.appendChild(eyebrow);

  body.appendChild(el("div", "cc-city__name", city.label));
  body.appendChild(el("div", "cc-city__time", formatClock(now, city.timeZone)));

  const meta = el("div", "cc-city__meta");
  if (weather !== undefined) {
    meta.appendChild(
      el("span", "cc-city__temp", `${String(Math.round(weather.temperature))}°`),
    );
    meta.appendChild(el("span", "cc-city__condition", weather.condition));
  }
  body.appendChild(meta);

  card.appendChild(body);
  return card;
}

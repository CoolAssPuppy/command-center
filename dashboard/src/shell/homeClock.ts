import type { Zone } from "../config/schema";
import { el } from "../render/helpers";
import { formatClock, zonedTime } from "../time/clock";
import { phaseLabel } from "../time/solar";
import type { DailyForecast } from "../weather/openMeteo";
import { renderForecast } from "./forecast";

/**
 * The centered, prominent home clock: a greeting, the big current time for the
 * home zone, the date plus place beneath it, and an optional multi-day forecast
 * strip. Pure and deterministic; the instant is always passed in so the same
 * moment renders the same way.
 */
export interface HomeClockModel {
  now: Date;
  zone: Zone;
  name?: string;
  hour12?: boolean;
  /** Current conditions for the home zone, shown beneath the date when set. */
  currentWeather?: { temperature: number; condition: string };
  /** Multi-day forecast for the home zone, shown beneath the clock when set. */
  forecast?: DailyForecast[];
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
  root.dataset.flipId = "home-clock";
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

  if (model.currentWeather !== undefined) {
    const weather = el("div", "cc-home__weather");
    weather.appendChild(
      el("span", "cc-home__temp", `${String(Math.round(model.currentWeather.temperature))}°`),
    );
    weather.appendChild(el("span", "cc-home__cond", model.currentWeather.condition));
    root.appendChild(weather);
  }

  if (model.forecast !== undefined && model.forecast.length > 0) {
    renderForecast(root, { daily: model.forecast });
  }

  host.appendChild(root);
  return root;
}

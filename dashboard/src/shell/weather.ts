import { el } from "../render/helpers";
import type { Weather } from "../weather/openMeteo";

/**
 * The weather summary. When data is present it shows temperature, condition,
 * and a high/low range. When absent it shows a calm skeleton so the layout
 * never jumps while the async fetch is in flight.
 */
export function renderWeather(
  host: HTMLElement,
  weather: Weather | undefined,
): HTMLElement {
  const root = el("div", "cc-weather");

  if (weather === undefined) {
    root.setAttribute("data-loading", "true");
    root.appendChild(el("span", "cc-weather__skeleton", ""));
    host.appendChild(root);
    return root;
  }

  const degree = weather.unit === "fahrenheit" ? "°F" : "°C";
  const icon = el("span", "cc-weather__icon");
  icon.setAttribute("data-icon", weather.icon);
  root.appendChild(icon);
  root.appendChild(
    el("span", "cc-weather__temp", `${String(Math.round(weather.temperature))}${degree}`),
  );
  root.appendChild(el("span", "cc-weather__condition", weather.condition));

  if (weather.high !== undefined && weather.low !== undefined) {
    root.appendChild(
      el(
        "span",
        "cc-weather__range",
        `${String(Math.round(weather.high))}${degree} / ${String(Math.round(weather.low))}${degree}`,
      ),
    );
  }
  host.appendChild(root);
  return root;
}

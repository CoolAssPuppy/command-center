import { el } from "../render/helpers";
import type { DailyForecast } from "../weather/openMeteo";
import { weatherIcon } from "../weather/weatherIcons";

/**
 * A compact multi-day forecast strip: one column per day with a weekday label,
 * a minimalist weather icon, and the high over the low. Today reads "Today".
 */
export interface ForecastModel {
  daily: DailyForecast[];
}

function weekdayLabel(date: string, index: number): string {
  if (index === 0) return "Today";
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(parsed);
}

export function renderForecast(host: HTMLElement, model: ForecastModel): HTMLElement {
  const root = el("div", "cc-forecast");
  model.daily.forEach((day, index) => {
    const column = el("div", "cc-forecast__day");
    column.appendChild(el("span", "cc-forecast__label", weekdayLabel(day.date, index)));

    const icon = el("span", "cc-forecast__icon");
    icon.setAttribute("title", day.condition);
    icon.appendChild(weatherIcon(day.icon));
    column.appendChild(icon);

    const temps = el("span", "cc-forecast__temps");
    temps.appendChild(el("span", "cc-forecast__high", `${String(Math.round(day.high))}°`));
    temps.appendChild(el("span", "cc-forecast__low", `${String(Math.round(day.low))}°`));
    column.appendChild(temps);

    root.appendChild(column);
  });
  host.appendChild(root);
  return root;
}

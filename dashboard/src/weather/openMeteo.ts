import { z } from "zod";

import { firstIssue, type ParseResult } from "../domain/feed";

/**
 * The weather client. It is the dashboard's only first-party network call, and
 * it speaks to exactly one host, Open-Meteo, which needs no API key. The
 * content security policy in the new tab page allows connect-src to this host
 * only. See docs/06-safari-extension.md and docs/07-dashboard-ui.md.
 *
 * The fetch function is injected so the client is tested without a network and
 * without coupling to any global. No token or secret is ever sent.
 */

const FORECAST_BASE = "https://api.open-meteo.com/v1/forecast";

export type WeatherUnits = "fahrenheit" | "celsius";

export interface WeatherLocation {
  label: string;
  lat: number;
  lon: number;
}

export interface Weather {
  temperature: number;
  unit: WeatherUnits;
  code: number;
  condition: string;
  icon: string;
  high?: number;
  low?: number;
  sunrise?: string;
  sunset?: string;
}

/** The minimal shape of a fetch response this client uses. */
export interface FetchResponseLike {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

export type FetchLike = (url: string) => Promise<FetchResponseLike>;

export interface WeatherDeps {
  fetch: FetchLike;
}

export function buildForecastUrl(
  location: WeatherLocation,
  units: WeatherUnits,
): string {
  const url = new URL(FORECAST_BASE);
  url.searchParams.set("latitude", String(location.lat));
  url.searchParams.set("longitude", String(location.lon));
  url.searchParams.set("current", "temperature_2m,weather_code");
  url.searchParams.set(
    "daily",
    "temperature_2m_max,temperature_2m_min,sunrise,sunset",
  );
  url.searchParams.set("temperature_unit", units);
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "1");
  return url.toString();
}

/**
 * Map a WMO weather code to a human condition and an icon name the theme paints.
 * Unknown codes fall back rather than throw, so a new code never breaks render.
 */
export function describeWeatherCode(code: number): {
  condition: string;
  icon: string;
} {
  switch (code) {
    case 0:
      return { condition: "Clear", icon: "sun" };
    case 1:
      return { condition: "Mainly clear", icon: "sun" };
    case 2:
      return { condition: "Partly cloudy", icon: "cloud-sun" };
    case 3:
      return { condition: "Overcast", icon: "cloud" };
    case 45:
    case 48:
      return { condition: "Fog", icon: "fog" };
    case 51:
    case 53:
    case 55:
      return { condition: "Drizzle", icon: "drizzle" };
    case 56:
    case 57:
      return { condition: "Freezing drizzle", icon: "sleet" };
    case 61:
    case 63:
    case 65:
      return { condition: "Rain", icon: "rain" };
    case 66:
    case 67:
      return { condition: "Freezing rain", icon: "sleet" };
    case 71:
    case 73:
    case 75:
    case 77:
      return { condition: "Snow", icon: "snow" };
    case 80:
    case 81:
    case 82:
      return { condition: "Rain showers", icon: "rain" };
    case 85:
    case 86:
      return { condition: "Snow showers", icon: "snow" };
    case 95:
      return { condition: "Thunderstorm", icon: "storm" };
    case 96:
    case 99:
      return { condition: "Thunderstorm with hail", icon: "storm" };
    default:
      return { condition: "Unknown", icon: "cloud" };
  }
}

const ResponseSchema = z.object({
  current: z.object({
    temperature_2m: z.number(),
    weather_code: z.number(),
  }),
  daily: z
    .object({
      temperature_2m_max: z.array(z.number()),
      temperature_2m_min: z.array(z.number()),
      sunrise: z.array(z.string()),
      sunset: z.array(z.string()),
    })
    .optional(),
});

export async function fetchWeather(
  location: WeatherLocation,
  units: WeatherUnits,
  deps: WeatherDeps,
): Promise<ParseResult<Weather>> {
  const url = buildForecastUrl(location, units);

  let body: unknown;
  try {
    const response = await deps.fetch(url);
    if (!response.ok) {
      return { ok: false, error: `weather request failed (${response.status})` };
    }
    body = await response.json();
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "weather request failed";
    return { ok: false, error: message };
  }

  const parsed = ResponseSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error, "invalid weather") };
  }

  const { current, daily } = parsed.data;
  const described = describeWeatherCode(current.weather_code);
  const weather: Weather = {
    temperature: current.temperature_2m,
    unit: units,
    code: current.weather_code,
    condition: described.condition,
    icon: described.icon,
  };

  const high = daily?.temperature_2m_max[0];
  const low = daily?.temperature_2m_min[0];
  const sunrise = daily?.sunrise[0];
  const sunset = daily?.sunset[0];
  if (high !== undefined) weather.high = high;
  if (low !== undefined) weather.low = low;
  if (sunrise !== undefined) weather.sunrise = sunrise;
  if (sunset !== undefined) weather.sunset = sunset;

  return { ok: true, value: weather };
}

import { describe, expect, it, vi } from "vitest";

import {
  buildForecastUrl,
  describeWeatherCode,
  fetchWeather,
  type FetchLike,
  type FetchResponseLike,
} from "./openMeteo";

const SF = { label: "San Francisco", lat: 37.7749, lon: -122.4194 };

function jsonResponse(
  body: unknown,
  init: { ok?: boolean; status?: number } = {},
): FetchResponseLike {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: () => Promise.resolve(body),
  };
}

const goodBody = {
  current: { temperature_2m: 63.4, weather_code: 3 },
  daily: {
    temperature_2m_max: [68.2, 70.0],
    temperature_2m_min: [54.1, 55.0],
    sunrise: ["2026-06-14T05:48", "2026-06-15T05:48"],
    sunset: ["2026-06-14T20:31", "2026-06-15T20:32"],
  },
};

describe("buildForecastUrl", () => {
  it("targets the Open-Meteo host with the location and units", () => {
    const url = buildForecastUrl(SF, "fahrenheit");

    expect(url.startsWith("https://api.open-meteo.com/v1/forecast")).toBe(true);
    const params = new URL(url).searchParams;
    expect(params.get("latitude")).toBe("37.7749");
    expect(params.get("longitude")).toBe("-122.4194");
    expect(params.get("temperature_unit")).toBe("fahrenheit");
  });
});

describe("describeWeatherCode", () => {
  it("maps WMO codes to a human condition and an icon", () => {
    expect(describeWeatherCode(0)).toEqual({ condition: "Clear", icon: "sun" });
    expect(describeWeatherCode(3)).toEqual({ condition: "Overcast", icon: "cloud" });
    expect(describeWeatherCode(65).icon).toBe("rain");
    expect(describeWeatherCode(95).icon).toBe("storm");
  });

  it("falls back for an unknown code rather than throwing", () => {
    expect(describeWeatherCode(999).condition).toBe("Unknown");
  });
});

describe("fetchWeather", () => {
  it("parses a successful response into the weather model", async () => {
    const fetchLike: FetchLike = vi.fn(() => Promise.resolve(jsonResponse(goodBody)));

    const result = await fetchWeather(SF, "fahrenheit", { fetch: fetchLike });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({
      temperature: 63.4,
      unit: "fahrenheit",
      code: 3,
      condition: "Overcast",
      icon: "cloud",
      high: 68.2,
      low: 54.1,
      sunrise: "2026-06-14T05:48",
      sunset: "2026-06-14T20:31",
    });
  });

  it("only calls the Open-Meteo host", async () => {
    const fetchLike = vi.fn((_url: string) =>
      Promise.resolve(jsonResponse(goodBody)),
    );

    await fetchWeather(SF, "celsius", { fetch: fetchLike });

    const calledUrl = fetchLike.mock.calls[0]?.[0];
    expect(calledUrl).toContain("api.open-meteo.com");
  });

  it("returns an error result on a non-ok HTTP status", async () => {
    const fetchLike: FetchLike = () =>
      Promise.resolve(jsonResponse({}, { ok: false, status: 503 }));

    const result = await fetchWeather(SF, "fahrenheit", { fetch: fetchLike });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("503");
  });

  it("returns an error result on a malformed body, never a partial model", async () => {
    const fetchLike: FetchLike = () =>
      Promise.resolve(jsonResponse({ current: {} }));

    const result = await fetchWeather(SF, "fahrenheit", { fetch: fetchLike });

    expect(result.ok).toBe(false);
  });

  it("returns an error result when the network throws", async () => {
    const fetchLike: FetchLike = () => Promise.reject(new Error("offline"));

    const result = await fetchWeather(SF, "fahrenheit", { fetch: fetchLike });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("offline");
  });

  it("works without a daily block, omitting high, low, and sun times", async () => {
    const fetchLike: FetchLike = () =>
      Promise.resolve(
        jsonResponse({ current: { temperature_2m: 60, weather_code: 0 } }),
      );

    const result = await fetchWeather(SF, "fahrenheit", { fetch: fetchLike });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.high).toBeUndefined();
    expect(result.value.sunrise).toBeUndefined();
    expect(result.value.temperature).toBe(60);
  });
});

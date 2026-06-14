import { getByText, queryByText } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";

import type { City } from "../cities/cities";
import type { Weather } from "../weather/openMeteo";
import { host } from "../test/dom";
import { renderCityRow } from "./cityRow";

afterEach(() => {
  document.body.replaceChildren();
});

const makeCity = (overrides?: Partial<City>): City => ({
  id: "tokyo",
  label: "Tokyo",
  timeZone: "Asia/Tokyo",
  lat: 35.6762,
  lon: 139.6503,
  workingHours: { start: 9, end: 18 },
  photo: "cities/tokyo.jpg",
  ...overrides,
});

const makeWeather = (overrides?: Partial<Weather>): Weather => ({
  temperature: 21.4,
  unit: "celsius",
  code: 0,
  condition: "Clear",
  icon: "sun",
  ...overrides,
});

describe("renderCityRow", () => {
  it("renders a block per city with its name and skyline", () => {
    const root = host();
    renderCityRow(root, {
      now: new Date(Date.UTC(2026, 5, 21, 12, 0, 0)),
      cities: [makeCity(), makeCity({ id: "lisbon", label: "Lisbon", timeZone: "Europe/Lisbon" })],
    });

    expect(getByText(root, "Tokyo")).toBeInTheDocument();
    expect(getByText(root, "Lisbon")).toBeInTheDocument();
    expect(root.querySelectorAll(".cc-city__photo")).toHaveLength(2);
  });

  it("marks the daylight state for the background to style", () => {
    const root = host();
    // Tokyo (lon ~140) at 03:00 UTC is local midday: day.
    renderCityRow(root, {
      now: new Date(Date.UTC(2026, 5, 21, 3, 0, 0)),
      cities: [makeCity()],
    });

    const card = root.querySelector(".cc-city");
    expect(card?.getAttribute("data-daylight")).toBe("day");
  });

  it("shows weather only once it is available for that city", () => {
    const without = host();
    renderCityRow(without, {
      now: new Date(Date.UTC(2026, 5, 21, 3, 0, 0)),
      cities: [makeCity()],
    });
    expect(queryByText(without, "Clear")).toBeNull();

    const withWeather = host();
    renderCityRow(withWeather, {
      now: new Date(Date.UTC(2026, 5, 21, 3, 0, 0)),
      cities: [makeCity()],
      weatherByCity: { tokyo: makeWeather() },
    });
    expect(getByText(withWeather, "Clear")).toBeInTheDocument();
    expect(getByText(withWeather, "21°")).toBeInTheDocument();
  });
});

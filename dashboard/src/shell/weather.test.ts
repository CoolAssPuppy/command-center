import { getByText } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";

import type { Weather } from "../weather/openMeteo";
import { renderWeather } from "./weather";

afterEach(() => {
  document.body.replaceChildren();
});

function host(): HTMLElement {
  const node = document.createElement("div");
  document.body.appendChild(node);
  return node;
}

const weather: Weather = {
  temperature: 63.4,
  unit: "fahrenheit",
  code: 3,
  condition: "Overcast",
  icon: "cloud",
  high: 68.2,
  low: 54.1,
};

describe("renderWeather", () => {
  it("shows a skeleton while data is absent", () => {
    const root = host();
    renderWeather(root, undefined);

    expect(root.querySelector(".cc-weather")?.getAttribute("data-loading")).toBe("true");
  });

  it("shows temperature, condition, and range when present", () => {
    const root = host();
    renderWeather(root, weather);

    expect(getByText(root, "63°F")).toBeInTheDocument();
    expect(getByText(root, "Overcast")).toBeInTheDocument();
    expect(getByText(root, "68°F / 54°F")).toBeInTheDocument();
  });
});

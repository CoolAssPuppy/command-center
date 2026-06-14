import { fireEvent, getByRole, getByText } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { planLayout } from "../dashboard/attention";
import { composeDashboard } from "../dashboard/compose";
import type { Settings } from "../dashboard/payload";
import { makeDashboardPayload } from "../test/dashboard-factories";
import type { Weather } from "../weather/openMeteo";
import { renderDashboard } from "./dashboard";

afterEach(() => {
  document.body.replaceChildren();
});

function host(): HTMLElement {
  const node = document.createElement("div");
  document.body.appendChild(node);
  return node;
}

const LA = "America/Los_Angeles";
// Within the inbox feed's ttl (updatedAt 15:04:05Z); 15:05 UTC is 08:05 in LA.
const NOW = new Date("2026-06-14T15:05:00Z");

const settings: Settings = {
  profile: { name: "Prashant" },
  worldClock: { cities: [{ label: "San Francisco", timeZone: LA }] },
  weather: { location: { label: "SF", lat: 37.77, lon: -122.41 }, units: "fahrenheit" },
};

const weather: Weather = {
  temperature: 63.4,
  unit: "fahrenheit",
  code: 3,
  condition: "Overcast",
  icon: "cloud",
};

function renderFixture(navigate = vi.fn()): { root: HTMLElement; navigate: typeof navigate } {
  const payload = makeDashboardPayload({ settings });
  const cards = planLayout(composeDashboard(payload, NOW));
  const root = host();
  renderDashboard(root, { now: NOW, settings, cards, weather }, { navigate, timeZone: LA });
  return { root, navigate };
}

describe("renderDashboard", () => {
  it("renders the header greeting, weather, world clock, and provider cards", () => {
    const { root } = renderFixture();

    expect(getByText(root, "Good morning, Prashant")).toBeInTheDocument();
    expect(getByText(root, "63°F")).toBeInTheDocument();
    expect(getByText(root, "San Francisco")).toBeInTheDocument();
    expect(getByText(root, "Linear")).toBeInTheDocument();
  });

  it("navigates through the provider action when a row is clicked", () => {
    const { root, navigate } = renderFixture();

    fireEvent.click(getByRole(root, "button", { name: /Crash on cold start/ }));

    expect(navigate).toHaveBeenCalledOnce();
    const url = navigate.mock.calls[0]?.[0] as string;
    expect(url.startsWith("linearbar://open?url=")).toBe(true);
  });

  it("applies theme tokens to the root", () => {
    const { root } = renderFixture();

    expect(root.classList.contains("cc-dashboard")).toBe(true);
    expect(root.style.getPropertyValue("--cc-color-bg").length).toBeGreaterThan(0);
  });
});

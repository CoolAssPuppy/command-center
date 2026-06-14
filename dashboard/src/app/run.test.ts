import { fireEvent, getByRole, getByText } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createMockBridge, mockDashboardPayload } from "../bridge/mock";
import type { ParseResult } from "../domain/feed";
import type { Weather } from "../weather/openMeteo";
import { runDashboard, type RunDeps } from "./run";

afterEach(() => {
  document.body.replaceChildren();
});

function mount(): HTMLElement {
  const node = document.createElement("div");
  document.body.appendChild(node);
  return node;
}

const NOW = new Date("2026-06-14T15:05:00Z");

const weather: Weather = {
  temperature: 63.4,
  unit: "fahrenheit",
  code: 3,
  condition: "Overcast",
  icon: "cloud",
};

function baseDeps(overrides: Partial<RunDeps> = {}): RunDeps {
  return {
    mount: mount(),
    bridge: createMockBridge(),
    now: () => NOW,
    navigate: vi.fn(),
    fetchWeather: () => Promise.resolve<ParseResult<Weather>>({ ok: true, value: weather }),
    loadCache: () => null,
    saveCache: vi.fn(),
    timeZone: "America/Los_Angeles",
    ...overrides,
  };
}

describe("runDashboard", () => {
  it("renders live bridge data, caches it, and shows weather", async () => {
    const saveCache = vi.fn();
    const deps = baseDeps({ saveCache });

    await runDashboard(deps);

    expect(getByText(deps.mount, "Good morning, Prashant")).toBeInTheDocument();
    expect(getByText(deps.mount, "Linear")).toBeInTheDocument();
    expect(getByText(deps.mount, "63°F")).toBeInTheDocument();
    expect(saveCache).toHaveBeenCalledOnce();
  });

  it("wires provider actions to navigate", async () => {
    const navigate = vi.fn();
    const deps = baseDeps({ navigate });

    await runDashboard(deps);
    fireEvent.click(getByRole(deps.mount, "button", { name: /Crash on cold start/ }));

    expect(navigate).toHaveBeenCalledOnce();
  });

  it("paints from cache and stays up when the bridge fails", async () => {
    const saveCache = vi.fn();
    const deps = baseDeps({
      loadCache: () => mockDashboardPayload(),
      bridge: { getDashboard: () => Promise.reject(new Error("offline")) },
      saveCache,
    });

    await runDashboard(deps);

    expect(getByText(deps.mount, "Linear")).toBeInTheDocument();
    expect(saveCache).not.toHaveBeenCalled(); // bridge failed, nothing to cache
  });

  it("skips the weather fetch when no location is configured", async () => {
    const fetchWeather = vi.fn(() =>
      Promise.resolve<ParseResult<Weather>>({ ok: true, value: weather }),
    );
    const payload = mockDashboardPayload();
    delete payload.settings?.weather;

    await runDashboard(baseDeps({ bridge: createMockBridge(payload), fetchWeather }));

    expect(fetchWeather).not.toHaveBeenCalled();
  });
});

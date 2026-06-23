import { afterEach, describe, expect, it, vi } from "vitest";

import { defaultConfig } from "../config/defaults";
import { createConfigStore, memoryArea } from "../config/store";
import type { ParseResult } from "../domain/result";
import { host } from "../test/dom";
import type { Weather, WeatherLocation, WeatherUnits } from "../weather/openMeteo";
import { runDashboard, type RunDeps } from "./run";

afterEach(() => {
  document.body.replaceChildren();
});

const okWeather = (temperature: number): ParseResult<Weather> => ({
  ok: true,
  value: { temperature, unit: "fahrenheit", code: 0, condition: "Clear", icon: "sun" },
});

const baseDeps = (mount: HTMLElement): RunDeps => ({
  mount,
  store: createConfigStore(memoryArea(), memoryArea(), {
    fallback: () => defaultConfig({ timeZone: "America/New_York" }),
  }),
  now: () => new Date(Date.UTC(2026, 5, 15, 16, 0, 0)),
  navigate: () => {},
  fetchWeather: (_location: WeatherLocation, _units: WeatherUnits) =>
    Promise.resolve(okWeather(70)),
  loadCache: () => undefined,
  saveCache: () => {},
  reducedMotion: true,
});

describe("runDashboard", () => {
  it("paints the home clock and zone row from the stored config", async () => {
    const mount = host();
    await runDashboard(baseDeps(mount));

    expect(mount.querySelector(".cc-home__time")).not.toBeNull();
    expect(mount.querySelectorAll(".cc-zone").length).toBeGreaterThan(0);
  });

  it("fills in weather for located zones, then repaints", async () => {
    const mount = host();
    await runDashboard(baseDeps(mount));
    expect(mount.querySelector(".cc-zone__weather")?.textContent).toContain("70°");
  });

  it("paints instantly from the cache before storage resolves", async () => {
    const mount = host();
    const cached = defaultConfig({ timeZone: "Europe/Lisbon" });
    let painted = false;
    await runDashboard({
      ...baseDeps(mount),
      loadCache: () => {
        return cached;
      },
      saveCache: () => {
        // The cache must have already produced a first paint by now.
        painted = mount.querySelector(".cc-home__time") !== null;
      },
    });
    expect(painted).toBe(true);
  });

  it("registers a minute ticker when one is provided", async () => {
    const mount = host();
    const scheduleTick = vi.fn();
    await runDashboard({ ...baseDeps(mount), scheduleTick });
    expect(scheduleTick).toHaveBeenCalledOnce();
  });
});

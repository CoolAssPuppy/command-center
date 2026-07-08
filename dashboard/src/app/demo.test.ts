import { afterEach, describe, expect, it } from "vitest";

import {
  demoCombinedCalendars,
  demoNews,
  demoResultFor,
  demoStocks,
  demoWeatherFor,
  isDemoMode,
  setDemoMode,
} from "./demo";

const NOW = new Date("2026-06-25T08:00:00Z");

afterEach(() => {
  localStorage.clear();
});

describe("screenshot mode flag", () => {
  it("turns on and off through localStorage", () => {
    expect(isDemoMode()).toBe(false);
    setDemoMode(true);
    expect(isDemoMode()).toBe(true);
    setDemoMode(false);
    expect(isDemoMode()).toBe(false);
  });
});

describe("demo integration data", () => {
  it("anchors the next meeting to now with a join link the lane can use", () => {
    const result = demoResultFor("google-calendar", NOW);
    const meeting = result.items?.find((item) => item.joinUrl !== undefined);
    expect(meeting?.startMs).toBeGreaterThan(NOW.getTime());
    expect(meeting?.startMs).toBeLessThanOrEqual(NOW.getTime() + 60 * 60 * 1000);
    expect(meeting?.joinUrl).toMatch(/^https:\/\//);
    expect(meeting?.conferenceProvider).toBe("meet");
  });

  it("includes finished and all-day events for the calendar card to fold", () => {
    const items = demoResultFor("google-calendar", NOW).items ?? [];
    expect(items.some((item) => item.isAllDay === true)).toBe(true);
    expect(items.filter((item) => item.isAllDay === true).length).toBeGreaterThan(2);
    expect(items.some((item) => item.endMs !== undefined && item.endMs < NOW.getTime())).toBe(true);
  });

  it("uses the same anchored events for combined calendars", () => {
    const combined = demoCombinedCalendars(NOW);
    const google = demoResultFor("google-calendar", NOW);
    expect(combined.status).toBe("ok");
    const combinedMeeting = combined.items?.find((item) => item.joinUrl !== undefined);
    const googleMeeting = google.items?.find((item) => item.joinUrl !== undefined);
    expect(combinedMeeting?.startMs).toBe(googleMeeting?.startMs);
  });

  it("flags review-requested pull requests as urgent so the lane lifts them", () => {
    const items = demoResultFor("github", NOW).items ?? [];
    expect(items.length).toBeGreaterThan(0);
    expect(items.some((item) => item.tone === "urgent" && item.url !== undefined)).toBe(true);
  });

  it("gives Linear items type glyphs across issues, projects, and initiatives", () => {
    const icons = (demoResultFor("linear", NOW).items ?? []).map((item) => item.icon);
    expect(icons).toContain("linear-issue");
    expect(icons).toContain("linear-project");
    expect(icons).toContain("linear-initiative");
  });

  it("serves task fields for the dedicated task sources", () => {
    for (const service of ["google-tasks", "todoist"]) {
      const items = demoResultFor(service, NOW).items ?? [];
      expect(items.every((item) => item.task !== undefined)).toBe(true);
    }
  });

  it("switches Notion between notes and tasks by role", () => {
    const notes = demoResultFor("notion", NOW).items ?? [];
    const tasks = demoResultFor("notion", NOW, "tasks").items ?? [];
    expect(notes.every((item) => item.task === undefined)).toBe(true);
    expect(tasks.every((item) => item.task !== undefined)).toBe(true);
  });
});

describe("demo weather", () => {
  it("returns a current reading and a five-day forecast", () => {
    const weather = demoWeatherFor(0, NOW, "celsius");
    expect(weather.unit).toBe("celsius");
    expect(weather.daily).toHaveLength(5);
    expect(weather.daily?.[0]?.date).toBe("2026-06-25");
    expect(weather.high).toBeGreaterThanOrEqual(weather.low ?? 0);
  });

  it("varies by zone index and honors the unit", () => {
    const celsius = demoWeatherFor(0, NOW, "celsius");
    const fahrenheit = demoWeatherFor(0, NOW, "fahrenheit");
    expect(fahrenheit.temperature).toBeGreaterThan(celsius.temperature);
    expect(demoWeatherFor(1, NOW, "celsius").temperature).not.toBe(celsius.temperature);
  });
});

describe("demo tickers", () => {
  it("includes gainers, a loser, and a currency pair", () => {
    expect(demoStocks.some((quote) => quote.changePercent > 0)).toBe(true);
    expect(demoStocks.some((quote) => quote.changePercent < 0)).toBe(true);
    expect(demoStocks.some((quote) => quote.isForex === true)).toBe(true);
  });

  it("provides headlines with sources", () => {
    expect(demoNews.length).toBeGreaterThan(0);
    expect(demoNews.every((item) => item.title.length > 0 && item.source.length > 0)).toBe(true);
  });
});

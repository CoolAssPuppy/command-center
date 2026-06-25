import { getByRole, getByText } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { defaultConfig } from "../config/defaults";
import { ConfigSchema } from "../config/schema";
import { host } from "../test/dom";
import { renderDashboard } from "./dashboard";

afterEach(() => {
  document.body.replaceChildren();
});

const now = new Date(Date.UTC(2026, 5, 15, 16, 0, 0));

describe("renderDashboard", () => {
  it("renders the home clock and a card for each other zone", () => {
    const config = defaultConfig({ timeZone: "America/New_York" });
    const root = host();
    renderDashboard(root, { now, config }, { navigate: () => {}, reducedMotion: true });

    expect(root.querySelector(".cc-home__time")).not.toBeNull();
    expect(root.querySelectorAll(".cc-zone")).toHaveLength(config.zones.length - 1);
  });

  it("renders cards into columns by (column, order), not config array order", () => {
    const config = ConfigSchema.parse({
      zones: [{ id: "h", label: "Home", timeZone: "UTC", isHome: true }],
      connections: [
        { id: "c1", name: "A", service: "notion" },
        { id: "c2", name: "B", service: "notion" },
        { id: "c3", name: "C", service: "notion" },
      ],
      streams: [
        { id: "s1", title: "First", connectionId: "c1", column: "right", order: 1 },
        { id: "s2", title: "Second", connectionId: "c2", column: "right", order: 0 },
        { id: "s3", title: "Lefty", connectionId: "c3", column: "left", order: 0 },
      ],
    });
    const root = host();
    renderDashboard(root, { now, config }, { navigate: () => {}, reducedMotion: true });

    const titlesIn = (selector: string): string[] =>
      [...root.querySelectorAll(`${selector} .cc-stream__title`)].map((n) => n.textContent);

    // The lane is pinned in the left column; the one left card flows below it.
    expect(root.querySelector(".cc-work__col--left .cc-lane")).not.toBeNull();
    expect(titlesIn(".cc-work__col--left")).toEqual(["Lefty"]);
    // Right column is sorted by order (s2 before s1), not array order (s1, s2).
    expect(titlesIn(".cc-work__col--right")).toEqual(["Second", "First"]);
  });

  it("ignores config array order for the surface (pane reorder is cosmetic)", () => {
    const streams = [
      { id: "s1", title: "First", connectionId: "c1", column: "right", order: 0 },
      { id: "s2", title: "Second", connectionId: "c1", column: "right", order: 1 },
    ];
    const base = {
      zones: [{ id: "h", label: "Home", timeZone: "UTC", isHome: true }],
      connections: [{ id: "c1", name: "A", service: "notion" }],
    };
    const rightTitles = (config: ReturnType<typeof ConfigSchema.parse>): string[] => {
      const root = host();
      renderDashboard(root, { now, config }, { navigate: () => {}, reducedMotion: true });
      return [...root.querySelectorAll(".cc-work__col--right .cc-stream__title")].map(
        (n) => n.textContent,
      );
    };

    const ordered = rightTitles(ConfigSchema.parse({ ...base, streams }));
    const reversed = rightTitles(ConfigSchema.parse({ ...base, streams: [...streams].reverse() }));
    expect(ordered).toEqual(["First", "Second"]);
    expect(reversed).toEqual(ordered);
  });

  it("hides the dock when showDock is false", () => {
    const base = {
      zones: [{ id: "h", label: "Home", timeZone: "UTC", isHome: true }],
      links: [{ id: "l1", title: "Gmail", url: "https://mail.google.com/" }],
    };
    const shown = host();
    renderDashboard(
      shown,
      { now, config: ConfigSchema.parse(base) },
      { navigate: () => {}, reducedMotion: true },
    );
    expect(shown.querySelector(".cc-dock")).not.toBeNull();

    const hidden = host();
    renderDashboard(
      hidden,
      { now, config: ConfigSchema.parse({ ...base, appearance: { showDock: false } }) },
      { navigate: () => {}, reducedMotion: true },
    );
    expect(hidden.querySelector(".cc-dock")).toBeNull();
  });

  it("wires the edit button to the onEdit callback", () => {
    const onEdit = vi.fn();
    const root = host();
    renderDashboard(
      root,
      { now, config: defaultConfig({ timeZone: "UTC" }) },
      { navigate: () => {}, onEdit },
    );

    getByRole(root, "button", { name: "Customize dashboard" }).click();
    expect(onEdit).toHaveBeenCalledOnce();
  });

  it("marks the wallpaper slot disabled by default", () => {
    const root = host();
    renderDashboard(
      root,
      { now, config: defaultConfig({ timeZone: "UTC" }) },
      { navigate: () => {} },
    );
    expect(root.querySelector(".cc-wallpaper")?.getAttribute("data-enabled")).toBe(
      "false",
    );
  });

  it("paints the wallpaper image and Unsplash credit when resolved", () => {
    const config = ConfigSchema.parse({
      wallpaper: { source: "unsplash", terms: ["Lisbon"], scrim: 0.5 },
      zones: [{ id: "h", label: "Home", timeZone: "UTC", isHome: true }],
    });
    const root = host();
    renderDashboard(
      root,
      {
        now,
        config,
        wallpaper: {
          imageUrl: "https://images.unsplash.com/x.jpg",
          authorName: "Ansel",
          authorUrl: "https://unsplash.com/@ansel",
        },
      },
      { navigate: () => {} },
    );
    const wallpaper = root.querySelector<HTMLElement>(".cc-wallpaper");
    expect(wallpaper?.getAttribute("data-enabled")).toBe("true");
    expect(wallpaper?.style.getPropertyValue("--cc-wallpaper-image")).toContain(
      "x.jpg",
    );
    expect(root.querySelector(".cc-credit__link")?.textContent).toBe("Ansel");
  });

  it("ignores a wallpaper image with an unsafe url", () => {
    const config = ConfigSchema.parse({
      wallpaper: { source: "unsplash", terms: ["x"], scrim: 0.4 },
      zones: [{ id: "h", label: "Home", timeZone: "UTC", isHome: true }],
    });
    const root = host();
    renderDashboard(
      root,
      { now, config, wallpaper: { imageUrl: "javascript:alert(1)" } },
      { navigate: () => {} },
    );
    expect(root.querySelector(".cc-wallpaper")?.getAttribute("data-enabled")).toBe(
      "false",
    );
  });

  it("greets with the profile name", () => {
    const config = ConfigSchema.parse({
      profile: { name: "Sam" },
      zones: [
        { id: "home", label: "Home", timeZone: "America/New_York", isHome: true },
      ],
    });
    const root = host();
    renderDashboard(root, { now, config }, { navigate: () => {} });
    expect(getByText(root, /Sam\./)).toBeInTheDocument();
  });

  it("shows a ticker hint when news is enabled but has no data", () => {
    const config = ConfigSchema.parse({
      zones: [{ id: "h", label: "Home", timeZone: "UTC", isHome: true }],
      tickers: { news: { enabled: true } },
    });
    const root = host();
    renderDashboard(root, { now, config, tickerNews: [] }, { navigate: () => {} });
    expect(root.querySelector(".cc-ticker__hint")).not.toBeNull();
  });

  it("renders news headlines when ticker data is present", () => {
    const config = ConfigSchema.parse({
      zones: [{ id: "h", label: "Home", timeZone: "UTC", isHome: true }],
      tickers: { news: { enabled: true } },
    });
    const root = host();
    renderDashboard(
      root,
      {
        now,
        config,
        tickerNews: [{ title: "A headline", url: "https://example.com", source: "Hacker News" }],
      },
      { navigate: () => {} },
    );
    expect(root.querySelector(".cc-ticker__headline")?.textContent).toBe("A headline");
    expect(root.querySelector(".cc-ticker__hint")).toBeNull();
  });
});

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
});

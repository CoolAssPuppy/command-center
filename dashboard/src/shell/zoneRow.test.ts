import { getByText } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";

import type { Zone } from "../config/schema";
import { host } from "../test/dom";
import { offsetLabel, renderZoneRow } from "./zoneRow";

afterEach(() => {
  document.body.replaceChildren();
});

const home: Zone = { id: "home", label: "New York", timeZone: "America/New_York" };
const now = new Date(Date.UTC(2026, 5, 15, 16, 0, 0));

describe("offsetLabel", () => {
  it("formats the offset from home", () => {
    expect(offsetLabel(0)).toBe("same time");
    expect(offsetLabel(330)).toBe("+5h 30m");
    expect(offsetLabel(-180)).toBe("−3h");
    expect(offsetLabel(45)).toBe("+45m");
  });
});

describe("renderZoneRow", () => {
  it("renders a card per zone with a day/night state", () => {
    const root = host();
    renderZoneRow(root, {
      now,
      homeZone: home,
      zones: [
        { id: "lisbon", label: "Lisbon", timeZone: "Europe/Lisbon" },
        { id: "tokyo", label: "Tokyo", timeZone: "Asia/Tokyo" },
      ],
    });

    expect(root.querySelectorAll(".cc-zone")).toHaveLength(2);
    expect(getByText(root, "Lisbon")).toBeInTheDocument();
    const cards = [...root.querySelectorAll(".cc-zone")];
    for (const card of cards) {
      expect(["day", "night"]).toContain(card.getAttribute("data-daynight"));
    }
  });

  it("shows the temperature when weather is provided", () => {
    const root = host();
    renderZoneRow(root, {
      now,
      homeZone: home,
      zones: [{ id: "lisbon", label: "Lisbon", timeZone: "Europe/Lisbon" }],
      weatherByZone: {
        lisbon: {
          temperature: 21.4,
          unit: "celsius",
          code: 0,
          condition: "Clear",
          icon: "sun",
        },
      },
    });
    expect(getByText(root, /21°/)).toBeInTheDocument();
  });
});

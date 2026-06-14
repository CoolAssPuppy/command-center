import { getByText } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";

import { CITIES } from "../cities/cities";
import { host } from "../test/dom";
import { renderOverlapTimeline } from "./overlapTimeline";

afterEach(() => {
  document.body.replaceChildren();
});

describe("renderOverlapTimeline", () => {
  it("draws a labelled row with working bands for every city plus a now cursor", () => {
    const root = host();
    renderOverlapTimeline(root, {
      now: new Date(Date.UTC(2026, 5, 15, 16, 0, 0)),
      cities: CITIES,
      referenceTimeZone: "America/New_York",
    });

    for (const city of CITIES) {
      expect(getByText(root, city.label)).toBeInTheDocument();
    }
    expect(root.querySelectorAll(".cc-overlap__track")).toHaveLength(CITIES.length);
    expect(root.querySelectorAll(".cc-overlap__band").length).toBeGreaterThanOrEqual(
      CITIES.length,
    );
    expect(root.querySelector(".cc-overlap__now")).not.toBeNull();
  });
});

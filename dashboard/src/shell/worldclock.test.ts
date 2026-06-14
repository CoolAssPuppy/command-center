import { getByText } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";

import { host } from "../test/dom";

import { renderWorldClock } from "./worldclock";

afterEach(() => {
  document.body.replaceChildren();
});

describe("renderWorldClock", () => {
  it("renders each city with a day or night state", () => {
    const root = host();
    renderWorldClock(root, {
      now: new Date("2026-06-14T16:41:00Z"),
      baseTimeZone: "America/Los_Angeles",
      cities: [
        { label: "San Francisco", timeZone: "America/Los_Angeles" },
        { label: "Bengaluru", timeZone: "Asia/Kolkata" },
      ],
    });

    expect(getByText(root, "San Francisco")).toBeInTheDocument();
    const bengaluru = [...root.querySelectorAll(".cc-worldclock__city")].find((c) =>
      c.textContent?.includes("Bengaluru"),
    );
    expect(bengaluru?.getAttribute("data-daynight")).toBe("night"); // 22:11 local
  });

  it("shows a date offset only when the city is on a different day", () => {
    const root = host();
    renderWorldClock(root, {
      // 23:30 UTC: LA still on the 14th, Kolkata on the 15th
      now: new Date("2026-06-14T23:30:00Z"),
      baseTimeZone: "America/Los_Angeles",
      cities: [{ label: "Bengaluru", timeZone: "Asia/Kolkata" }],
    });

    expect(getByText(root, "+1d")).toBeInTheDocument();
  });
});

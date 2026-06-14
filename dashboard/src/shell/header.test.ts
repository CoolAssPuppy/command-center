import { getByText } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";

import { host } from "../test/dom";

import { renderHeader } from "./header";

afterEach(() => {
  document.body.replaceChildren();
});

const LA = "America/Los_Angeles";

describe("renderHeader", () => {
  it("greets by name based on the local hour", () => {
    const root = host();
    // 17:00 UTC is 10:00 in Los Angeles, the morning
    renderHeader(root, { now: new Date("2026-06-14T17:00:00Z"), timeZone: LA, name: "Prashant" });

    expect(getByText(root, "Good morning, Prashant")).toBeInTheDocument();
  });

  it("shifts the greeting to evening later in the day", () => {
    const root = host();
    // 04:00 UTC is 21:00 the previous day in Los Angeles, the evening
    renderHeader(root, { now: new Date("2026-06-15T04:00:00Z"), timeZone: LA });

    expect(getByText(root, "Good evening")).toBeInTheDocument();
  });

  it("shows a time and a date", () => {
    const root = host();
    renderHeader(root, { now: new Date("2026-06-14T17:00:00Z"), timeZone: LA });

    expect(root.querySelector(".cc-header__time")?.textContent).toMatch(/10:00/);
    expect(root.querySelector(".cc-header__date")?.textContent).toContain("June");
  });
});

import { getByText } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";

import type { Zone } from "../config/schema";
import { host } from "../test/dom";
import { renderHomeClock } from "./homeClock";

afterEach(() => {
  document.body.replaceChildren();
});

const zone: Zone = { id: "home", label: "New York", timeZone: "America/New_York" };
// 16:00 UTC on 2026-06-15 is 12:00 in New York (EDT).
const noonEdt = new Date(Date.UTC(2026, 5, 15, 16, 0, 0));

describe("renderHomeClock", () => {
  it("renders the big time, place, and a daytime phase for the home zone", () => {
    const root = host();
    renderHomeClock(root, { now: noonEdt, zone });

    expect(getByText(root, "12:00 PM")).toBeInTheDocument();
    expect(getByText(root, "New York")).toBeInTheDocument();
    expect(root.querySelector(".cc-home__time")?.getAttribute("data-phase")).toBe(
      "afternoon",
    );
  });

  it("greets by name when one is provided", () => {
    const root = host();
    renderHomeClock(root, { now: noonEdt, zone, name: "Sam" });
    expect(getByText(root, "Good afternoon, Sam.")).toBeInTheDocument();
  });

  it("honors a 24-hour clock", () => {
    const root = host();
    renderHomeClock(root, { now: noonEdt, zone, hour12: false });
    expect(getByText(root, "12:00")).toBeInTheDocument();
  });
});
